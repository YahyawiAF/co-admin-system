import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Prisma, StaffAction, StaffActionStatus } from '@prisma/client';
import { PrismaService } from 'database/prisma.service';
import { RequestContextStore } from 'common/request-context';
import { JournalService } from '../journal/journal.service';
import { AbonnementService } from '../abonnement/abonnement.service';
import { MemberService } from '../member/member.service';
import { ENTITY_LABEL, EntityType, toJson } from './staff-entities';

/** Fields never restored on revert. */
const SKIP_ON_RESTORE = new Set(['id', 'createdAt', 'updatedAt', 'payments']);

/** Entity types whose changes can be undone automatically. */
const REVERTABLE: EntityType[] = ['journal', 'abonnement', 'memberLedger', 'seatBooking'];

@Injectable()
export class StaffAuditService {
  private readonly logger = new Logger(StaffAuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly moduleRef: ModuleRef,
  ) {}

  /* ───────────────────────── snapshots ───────────────────────── */

  async snapshot(type: EntityType, id?: string | null): Promise<any | null> {
    if (!id) return null;
    try {
      switch (type) {
        case 'journal':
          return toJson(await this.prisma.journal.findUnique({ where: { id } }));
        case 'abonnement':
          return toJson(
            await this.prisma.abonnement.findUnique({
              where: { id },
              include: { payments: true },
            }),
          );
        case 'memberLedger':
          return toJson(await this.prisma.memberLedger.findUnique({ where: { id } }));
        case 'seatBooking':
          return toJson(await this.prisma.seatBooking.findUnique({ where: { id } }));
        case 'bookingRequest':
          return toJson(await this.prisma.bookingRequest.findUnique({ where: { id } }));
        case 'member':
          return toJson(
            await this.prisma.member.findUnique({
              where: { id },
              select: { id: true, firstName: true, lastName: true, phone: true, email: true },
            }),
          );
        default:
          return null;
      }
    } catch {
      return null;
    }
  }

  /** Short human sentence for the review list. */
  private async summarize(type: EntityType, snap: any): Promise<string> {
    if (!snap) return ENTITY_LABEL[type];
    const memberId = snap.memberID || snap.memberId;
    let who: string | null = snap.guestName || null;
    if (!who && snap.firstName) who = [snap.firstName, snap.lastName].filter(Boolean).join(' ');
    if (!who && memberId) {
      const m = await this.prisma.member
        .findUnique({ where: { id: memberId }, select: { firstName: true, lastName: true } })
        .catch(() => null);
      if (m) who = [m.firstName, m.lastName].filter(Boolean).join(' ');
    }
    const amount =
      typeof snap.amountDue === 'number'
        ? snap.amountDue
        : typeof snap.payedAmount === 'number'
          ? snap.payedAmount
          : typeof snap.amount === 'number'
            ? snap.amount
            : null;
    const parts = [
      ENTITY_LABEL[type],
      who,
      snap.serviceName || snap.seatLabel || snap.seatId || null,
      amount != null ? `${amount} DT` : null,
    ].filter(Boolean);
    return parts.join(' · ');
  }

  async record(input: {
    ctx: RequestContextStore;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'HIDE';
    type: EntityType;
    entityId?: string | null;
    method: string;
    before?: any;
    after?: any;
  }) {
    try {
      const summary = await this.summarize(input.type, input.after || input.before);
      await this.prisma.staffAction.create({
        data: {
          organizationId: input.ctx.organizationId || null,
          userId: input.ctx.userId!,
          module: input.ctx.module || 'journal',
          action: input.action,
          entityType: input.type,
          entityId: input.entityId || null,
          method: input.method,
          path: input.ctx.path || '',
          summary,
          before: input.before ?? Prisma.JsonNull,
          after: input.after ?? Prisma.JsonNull,
        },
      });
    } catch (err) {
      this.logger.error(`Could not log staff action: ${err instanceof Error ? err.message : err}`);
    }
  }

  /** Staff "delete" in hide mode: the row disappears for staff, stays for the admin. */
  async hide(ctx: RequestContextStore, type: EntityType, id: string, method: string) {
    const before = await this.snapshot(type, id);
    if (!before) throw new NotFoundException('Élément introuvable');
    const data = { hiddenAt: new Date(), hiddenByUserId: ctx.userId };
    if (type === 'journal') await this.prisma.journal.update({ where: { id }, data });
    else if (type === 'abonnement') await this.prisma.abonnement.update({ where: { id }, data });
    else if (type === 'memberLedger') await this.prisma.memberLedger.update({ where: { id }, data });
    else throw new BadRequestException('Masquage impossible pour cet élément');
    await this.record({ ctx, action: 'HIDE', type, entityId: id, method, before });
    return { id, hidden: true };
  }

  /* ───────────────────────── admin review ───────────────────────── */

  isRevertable(a: Pick<StaffAction, 'action' | 'entityType' | 'entityId' | 'before' | 'status'>) {
    if (a.status !== StaffActionStatus.PENDING) return false;
    if (a.action === 'HIDE') return true;
    if (!REVERTABLE.includes(a.entityType as EntityType)) return false;
    if (a.action === 'CREATE') return !!a.entityId;
    return a.before != null;
  }

  async confirm(action: StaffAction, reviewerId: string, note?: string) {
    this.assertPending(action);
    if (action.action === 'HIDE' && action.entityId) {
      // Admin agrees: delete for real, with the normal side effects.
      await this.realDelete(action.entityType as EntityType, action.entityId);
    }
    return this.close(action.id, StaffActionStatus.CONFIRMED, reviewerId, note);
  }

  async revert(action: StaffAction, reviewerId: string, note?: string) {
    this.assertPending(action);
    if (!this.isRevertable(action)) {
      throw new BadRequestException("Cette action ne peut pas être annulée automatiquement");
    }
    const type = action.entityType as EntityType;
    const id = action.entityId!;
    const before = action.before as any;

    try {
      switch (action.action) {
        case 'HIDE':
          await this.unhide(type, id);
          break;
        case 'CREATE':
          await this.realDelete(type, id);
          break;
        case 'DELETE':
          await this.recreate(type, before);
          break;
        case 'UPDATE':
          await this.restore(type, id, before, action.after as any);
          break;
      }
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException(
          "Impossible d'annuler : la place ou l'élément a été réutilisé entre-temps",
        );
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new BadRequestException("Impossible d'annuler : l'élément n'existe plus");
      }
      throw err;
    }
    return this.close(action.id, StaffActionStatus.REVERTED, reviewerId, note);
  }

  private assertPending(action: StaffAction) {
    if (action.status !== StaffActionStatus.PENDING) {
      throw new BadRequestException('Action déjà traitée');
    }
  }

  private close(id: string, status: StaffActionStatus, reviewerId: string, note?: string) {
    return this.prisma.staffAction.update({
      where: { id },
      data: { status, reviewedAt: new Date(), reviewedById: reviewerId, reviewNote: note || null },
    });
  }

  private async unhide(type: EntityType, id: string) {
    const data = { hiddenAt: null, hiddenByUserId: null };
    if (type === 'journal') await this.prisma.journal.update({ where: { id }, data });
    else if (type === 'abonnement') await this.prisma.abonnement.update({ where: { id }, data });
    else if (type === 'memberLedger') await this.prisma.memberLedger.update({ where: { id }, data });
  }

  private async realDelete(type: EntityType, id: string) {
    const exists = await this.snapshot(type, id);
    if (!exists) return; // already gone
    switch (type) {
      case 'journal':
        await this.moduleRef.get(JournalService, { strict: false }).remove(id);
        return;
      case 'abonnement':
        await this.moduleRef.get(AbonnementService, { strict: false }).remove(id);
        return;
      case 'memberLedger':
        await this.moduleRef.get(MemberService, { strict: false }).removeLedger(id);
        return;
      case 'seatBooking':
        await this.prisma.seatBooking.delete({ where: { id } });
        return;
      default:
        throw new BadRequestException('Suppression impossible pour cet élément');
    }
  }

  private async recreate(type: EntityType, before: any) {
    if (!before?.id) throw new BadRequestException('Aucune copie à restaurer');
    const { payments, ...data } = before;
    switch (type) {
      case 'journal':
        await this.prisma.journal.create({ data });
        return;
      case 'abonnement':
        await this.prisma.abonnement.create({
          data: {
            ...data,
            payments: payments?.length
              ? {
                  create: payments.map(({ abonnementId: _a, ...p }: any) => p),
                }
              : undefined,
          },
        });
        return;
      case 'memberLedger':
        await this.prisma.memberLedger.create({ data });
        return;
      case 'seatBooking':
        await this.prisma.seatBooking.create({ data });
        return;
    }
  }

  /** Put back the fields this action changed (later unrelated edits are kept). */
  private async restore(type: EntityType, id: string, before: any, after: any) {
    const data: Record<string, unknown> = {};
    for (const key of Object.keys(before || {})) {
      if (SKIP_ON_RESTORE.has(key)) continue;
      if (after && JSON.stringify(after[key]) === JSON.stringify(before[key])) continue;
      data[key] = before[key];
    }
    switch (type) {
      case 'journal':
        if (Object.keys(data).length) await this.prisma.journal.update({ where: { id }, data });
        return;
      case 'abonnement': {
        if (Object.keys(data).length) await this.prisma.abonnement.update({ where: { id }, data });
        // Payments added by this action are removed; removed ones come back.
        const beforeIds = new Set((before.payments || []).map((p: any) => p.id));
        const afterIds = new Set((after?.payments || []).map((p: any) => p.id));
        const added = [...afterIds].filter((pid) => !beforeIds.has(pid)) as string[];
        if (added.length) await this.prisma.abonnementPayment.deleteMany({ where: { id: { in: added } } });
        for (const p of before.payments || []) {
          if (!afterIds.has(p.id)) {
            await this.prisma.abonnementPayment.create({ data: p }).catch(() => undefined);
          }
        }
        return;
      }
      case 'memberLedger':
        if (Object.keys(data).length) await this.prisma.memberLedger.update({ where: { id }, data });
        return;
      case 'seatBooking':
        if (Object.keys(data).length) await this.prisma.seatBooking.update({ where: { id }, data });
        return;
    }
  }
}
