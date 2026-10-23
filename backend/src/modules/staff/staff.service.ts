import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, StaffActionStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { isEmail, isMobilePhone } from 'class-validator';
import { PrismaService } from 'database/prisma.service';
import { normalizePermissions } from './permissions';
import { StaffAccessGuard } from './staff-access.guard';
import { StaffAuditService } from './staff-audit.service';

export type Actor = { userId: string; role: Role };

const ADMIN_ROLES: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.ORG_ADMIN, Role.FACILITY_ADMIN];
const PLATFORM_ROLES: Role[] = [Role.SUPER_ADMIN, Role.ADMIN];

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: StaffAuditService,
    private readonly guard: StaffAccessGuard,
  ) {}

  /* ───────────── access checks ───────────── */

  /** Admin of this org (platform admins manage every org). */
  async assertOrgAdmin(actor: Actor, organizationId?: string | null) {
    if (!organizationId) throw new BadRequestException('organizationId requis');
    const user = await this.prisma.user.findUnique({
      where: { id: actor.userId },
      select: { role: true },
    });
    const role = user?.role ?? actor.role;
    if (!ADMIN_ROLES.includes(role)) throw new ForbiddenException('Réservé aux administrateurs');
    if (PLATFORM_ROLES.includes(role)) return;
    const m = await this.prisma.organizationMembership.findUnique({
      where: { userId_organizationId: { userId: actor.userId, organizationId } },
    });
    if (!m || m.role === Role.STAFF) throw new ForbiddenException('Réservé aux administrateurs');
  }

  /* ───────────── me ───────────── */

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        organizationMemberships: { select: { organizationId: true, permissions: true } },
      },
    });
    if (!user) throw new NotFoundException();
    const isStaff = user.role === Role.STAFF;
    return {
      isStaff,
      role: user.role,
      organizations: isStaff
        ? user.organizationMemberships.map((m) => ({
            organizationId: m.organizationId,
            permissions: normalizePermissions(m.permissions),
          }))
        : [],
    };
  }

  /* ───────────── staff CRUD ───────────── */

  async list(organizationId: string) {
    const rows = await this.prisma.organizationMembership.findMany({
      where: { organizationId, role: Role.STAFF },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            fullname: true,
            email: true,
            phoneNumber: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
    });
    const ids = rows.map((r) => r.userId);
    const [pending, last] = await Promise.all([
      this.prisma.staffAction.groupBy({
        by: ['userId'],
        where: { organizationId, userId: { in: ids }, status: StaffActionStatus.PENDING },
        _count: { _all: true },
      }),
      this.prisma.staffAction.groupBy({
        by: ['userId'],
        where: { organizationId, userId: { in: ids } },
        _max: { createdAt: true },
      }),
    ]);
    return rows.map((r) => ({
      id: r.user.id,
      fullname: r.user.fullname,
      email: r.user.email,
      phoneNumber: r.user.phoneNumber,
      isActive: r.user.isActive,
      createdAt: r.user.createdAt,
      permissions: normalizePermissions(r.permissions),
      pendingActions: pending.find((p) => p.userId === r.userId)?._count._all ?? 0,
      lastActionAt: last.find((p) => p.userId === r.userId)?._max.createdAt ?? null,
    }));
  }

  private cleanIdentifier(identifier: string) {
    const raw = (identifier || '').trim();
    if (isEmail(raw)) return { email: raw.toLowerCase(), phoneNumber: null };
    const phone = raw.replace(/\s+/g, '');
    if (isMobilePhone(phone)) return { email: null, phoneNumber: phone };
    throw new BadRequestException('Email ou numéro de téléphone invalide');
  }

  async create(body: {
    organizationId: string;
    fullname: string;
    identifier: string;
    password: string;
    permissions?: unknown;
  }) {
    if (!body.fullname?.trim()) throw new BadRequestException('Nom requis');
    if (!body.password || body.password.length < 8) {
      throw new BadRequestException('Mot de passe : 8 caractères minimum');
    }
    const ident = this.cleanIdentifier(body.identifier);
    const permissions = normalizePermissions(body.permissions) as unknown as Prisma.InputJsonValue;

    const existing = await this.prisma.user.findFirst({
      where: ident.email ? { email: ident.email } : { phoneNumber: ident.phoneNumber },
    });
    if (existing && existing.role !== Role.STAFF) {
      throw new BadRequestException('Ce compte existe déjà avec un autre rôle');
    }
    const password = await bcrypt.hash(body.password, 10);

    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: { fullname: body.fullname.trim(), password, isActive: true, deletedAt: null },
        })
      : await this.prisma.user.create({
          data: {
            ...ident,
            fullname: body.fullname.trim(),
            password,
            role: Role.STAFF,
            isActive: true,
          },
        });

    await this.prisma.organizationMembership.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: body.organizationId } },
      create: {
        userId: user.id,
        organizationId: body.organizationId,
        role: Role.STAFF,
        permissions,
      },
      update: { role: Role.STAFF, permissions },
    });
    this.guard.invalidate(user.id);
    return (await this.list(body.organizationId)).find((s) => s.id === user.id);
  }

  private async membership(userId: string, organizationId: string) {
    const m = await this.prisma.organizationMembership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      include: { user: { select: { role: true } } },
    });
    if (!m || m.user.role !== Role.STAFF) throw new NotFoundException('Employé introuvable');
    return m;
  }

  async update(
    userId: string,
    body: {
      organizationId: string;
      fullname?: string;
      password?: string;
      isActive?: boolean;
      permissions?: unknown;
    },
  ) {
    await this.membership(userId, body.organizationId);
    if (body.permissions !== undefined) {
      await this.prisma.organizationMembership.update({
        where: { userId_organizationId: { userId, organizationId: body.organizationId } },
        data: {
          permissions: normalizePermissions(body.permissions) as unknown as Prisma.InputJsonValue,
        },
      });
    }
    const data: Prisma.UserUpdateInput = {};
    if (body.fullname?.trim()) data.fullname = body.fullname.trim();
    if (body.password) {
      if (body.password.length < 8) throw new BadRequestException('Mot de passe : 8 caractères minimum');
      data.password = await bcrypt.hash(body.password, 10);
      data.accessToken = null;
      data.refreshToken = null;
    }
    if (body.isActive !== undefined) {
      data.isActive = !!body.isActive;
      if (!body.isActive) {
        // Log the employee out right away.
        data.accessToken = null;
        data.refreshToken = null;
      }
    }
    if (Object.keys(data).length) await this.prisma.user.update({ where: { id: userId }, data });
    this.guard.invalidate(userId);
    return (await this.list(body.organizationId)).find((s) => s.id === userId);
  }

  async remove(userId: string, organizationId: string) {
    await this.membership(userId, organizationId);
    await this.prisma.organizationMembership.delete({
      where: { userId_organizationId: { userId, organizationId } },
    });
    const left = await this.prisma.organizationMembership.count({ where: { userId } });
    if (!left) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { isActive: false, accessToken: null, refreshToken: null },
      });
    }
    this.guard.invalidate(userId);
    return { ok: true };
  }

  /* ───────────── actions review ───────────── */

  async listActions(q: {
    organizationId: string;
    status?: string;
    userId?: string;
    module?: string;
    page?: number;
    perPage?: number;
  }) {
    const where: Prisma.StaffActionWhereInput = { organizationId: q.organizationId };
    if (q.status && q.status !== 'ALL' && q.status in StaffActionStatus) {
      where.status = q.status as StaffActionStatus;
    }
    if (q.userId) where.userId = q.userId;
    if (q.module) where.module = q.module;
    const perPage = Math.min(200, Math.max(1, Number(q.perPage) || 50));
    const page = Math.max(1, Number(q.page) || 1);
    const [total, rows] = await Promise.all([
      this.prisma.staffAction.count({ where }),
      this.prisma.staffAction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          user: { select: { id: true, fullname: true, email: true, phoneNumber: true } },
          reviewedBy: { select: { id: true, fullname: true, email: true } },
        },
      }),
    ]);
    return {
      total,
      page,
      perPage,
      data: rows.map((r) => ({ ...r, revertable: this.audit.isRevertable(r) })),
    };
  }

  async summary(organizationId: string) {
    const pending = await this.prisma.staffAction.count({
      where: { organizationId, status: StaffActionStatus.PENDING },
    });
    const hidden = await this.prisma.staffAction.count({
      where: { organizationId, status: StaffActionStatus.PENDING, action: 'HIDE' },
    });
    return { pending, hidden };
  }

  async getAction(id: string) {
    const a = await this.prisma.staffAction.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Action introuvable');
    return a;
  }

  async review(id: string, decision: 'confirm' | 'revert', reviewerId: string, note?: string) {
    const action = await this.getAction(id);
    return decision === 'confirm'
      ? this.audit.confirm(action, reviewerId, note)
      : this.audit.revert(action, reviewerId, note);
  }

  /** Confirm every pending action that does not need a decision (writes), or the given ids. */
  async confirmMany(organizationId: string, reviewerId: string, ids?: string[]) {
    const rows = await this.prisma.staffAction.findMany({
      where: {
        organizationId,
        status: StaffActionStatus.PENDING,
        ...(ids?.length ? { id: { in: ids } } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
    let done = 0;
    const errors: string[] = [];
    for (const r of rows) {
      try {
        await this.audit.confirm(r, reviewerId);
        done++;
      } catch (err) {
        errors.push(`${r.summary || r.id}: ${err instanceof Error ? err.message : err}`);
      }
    }
    return { confirmed: done, errors };
  }
}
