import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { differenceInCalendarDays, format, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PrismaService } from 'database/prisma.service';
import { PushService } from '../push/push.service';
import { localDayKey } from '../../../common/parse-local-day';
import {
  CLIENT_SEGMENTS,
  SEGMENT_LABEL,
  WINDOW_DAYS,
  checkClientRules,
  clientActivity,
  segmentRules,
  type ClientActivity,
  type ClientRules,
  type ClientSegment,
} from './client-segments';
import { MESSAGE_CHANNELS, contactBlock, facilityClientRules } from './contact-limit';
import { memberMessageVars } from './message-vars';
import { draftClientMessage } from './clients-ai';
import { OutreachService, whatsappNumber, type OutreachReason } from './outreach.service';
import { PerformanceService } from './performance.service';
import { round1 } from './traffic';

/** What to do with a client, in a few words (Action suggérée). */
const ACTION_LABEL: Record<OutreachReason, string> = {
  ABO_EXPIRING: 'Rappel de fin d’abonnement',
  ABO_ENDED: 'Proposer de renouveler',
  UNPAID: 'Rappeler l’impayé',
  RECALL: 'Rappeler (date prévue)',
  INACTIVE: 'Message de retour',
  NEW_NOT_BACK: 'Petit rappel (pas revenu)',
  TOP_UP: 'Proposer de compléter l’abonnement',
  CONVERT: 'Proposer un abonnement',
  REVIEW: 'Demander un avis Google',
  FOLLOW_UP: 'Rappel promis',
  WELCOME: 'Message de bienvenue',
  NEWS: 'Donner des nouvelles',
  WINBACK: 'Offre de retour',
};

/** Clients page only: occasional clients get news after this many days away. */
const NEWS_AFTER_DAYS = 14;
/** Inactive clients get a comeback offer until this many days away. */
const WINBACK_UNTIL_DAYS = 60;
/** Clients-page reasons wait this long after any contact. */
const EXTRA_QUIET_DAYS = 30;

/** Messages meant to bring the client back (the others: debts, offers, reviews…). */
const COME_BACK_REASONS = new Set<OutreachReason>(['INACTIVE', 'NEW_NOT_BACK', 'RECALL', 'WELCOME', 'NEWS', 'WINBACK']);

export const CLIENT_TODO = ['ABO', 'AT_RISK', 'NEW', 'INACTIVE', 'OTHER'] as const;
export type ClientTodo = (typeof CLIENT_TODO)[number];
const TODO_LABEL: Record<ClientTodo, string> = {
  ABO: 'abonnements à renouveler',
  AT_RISK: 'habitués s’éloignent',
  NEW: 'nouveaux à accueillir',
  INACTIVE: 'inactifs à faire revenir',
  OTHER: 'autres relances (impayés, offres…)',
};

type AboStatus = { status: 'ACTIVE' | 'EXPIRED'; name: string; end: string | null };

export type ClientListRow = {
  memberId: string;
  name: string;
  phone: string | null;
  segment: ClientSegment;
  why: string;
  lastVisit: string;
  daysSinceLast: number;
  visits30: number;
  abonnement: AboStatus | null;
  lastContact: { at: string; channel: string } | null;
  action: { reason: OutreachReason; label: string } | null;
  /** Why no message now: « Ne pas contacter » or the 1-message-per-N-days limit */
  blocked: string | null;
  todo: ClientTodo | null;
};

const name = (p: { firstName: string | null; lastName: string | null }) =>
  [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Client';

@Injectable()
export class ClientsService {
  private ai: Anthropic | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly outreach: OutreachService,
    private readonly performance: PerformanceService,
    private readonly push: PushService,
  ) {}

  private async context(facilityId?: string) {
    const settings = await this.performance.settings(facilityId);
    const facility = await this.prisma.facility.findUnique({
      where: { id: settings.facilityId },
      select: { name: true, organizationId: true, clientRules: true },
    });
    return {
      facilityId: settings.facilityId,
      organizationId: facility?.organizationId ?? null,
      place: facility?.name || 'notre espace',
      rules: await facilityClientRules(this.prisma, settings.facilityId),
    };
  }

  async rules(facilityId?: string) {
    const { rules } = await this.context(facilityId);
    return { rules, labels: SEGMENT_LABEL, describe: segmentRules(rules) };
  }

  async updateRules(facilityId: string | undefined, body: Partial<Record<keyof ClientRules, unknown>>) {
    const ctx = await this.context(facilityId);
    let next: ClientRules;
    try {
      next = checkClientRules(body, ctx.rules);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    await this.prisma.facility.update({ where: { id: ctx.facilityId }, data: { clientRules: next } });
    return this.rules(ctx.facilityId);
  }

  /** Every client with at least one visit: group, abonnement, last contact, suggested action. */
  private async build(facilityId?: string) {
    const now = new Date();
    const today = startOfDay(now);
    const ctx = await this.context(facilityId);
    const [members, visits, abos, contacts, relances] = await Promise.all([
      this.prisma.member.findMany({
        where: { deletedAt: null, ...(ctx.organizationId ? { organizationId: ctx.organizationId } : {}) },
        select: { id: true, firstName: true, lastName: true, phone: true, doNotContact: true },
      }),
      this.prisma.journal.findMany({
        where: { memberID: { not: null }, isReservation: false, hiddenAt: null },
        select: { memberID: true, registredTime: true },
      }),
      this.prisma.abonnement.findMany({
        where: { isReservation: false, hiddenAt: null },
        orderBy: { registredDate: 'desc' },
        select: {
          memberID: true,
          registredDate: true,
          leaveDate: true,
          terminatedAt: true,
          serviceName: true,
          price: { select: { name: true } },
        },
      }),
      this.prisma.memberOutreach.findMany({
        where: { channel: { not: 'SKIP' } },
        orderBy: { createdAt: 'desc' },
        distinct: ['memberId'],
        select: { memberId: true, createdAt: true, channel: true },
      }),
      this.outreach.list(ctx.facilityId),
    ]);
    const lastMessages = await this.prisma.memberOutreach.findMany({
      where: { channel: { in: MESSAGE_CHANNELS } },
      orderBy: { createdAt: 'desc' },
      distinct: ['memberId'],
      select: { memberId: true, createdAt: true },
    });

    const byMember = new Map<string, Date[]>();
    for (const v of visits) {
      const list = byMember.get(v.memberID!) ?? [];
      list.push(v.registredTime);
      byMember.set(v.memberID!, list);
    }
    const aboOf = new Map<string, AboStatus>();
    for (const a of abos) {
      if (aboOf.get(a.memberID)?.status === 'ACTIVE') continue;
      const ended = a.terminatedAt ?? (a.leaveDate && a.leaveDate < today ? a.leaveDate : null);
      const label = a.serviceName || a.price?.name || 'Abonnement';
      if (!ended) aboOf.set(a.memberID, { status: 'ACTIVE', name: label, end: a.leaveDate ? localDayKey(a.leaveDate) : null });
      else if (!aboOf.has(a.memberID)) aboOf.set(a.memberID, { status: 'EXPIRED', name: label, end: localDayKey(ended) });
    }
    const contactOf = new Map(contacts.map((c) => [c.memberId, c]));
    const messageOf = new Map(lastMessages.map((c) => [c.memberId, c.createdAt]));
    const todoItem = new Map(relances.todo.map((i) => [i.memberId, i]));

    const rows: ClientListRow[] = [];
    const activity = new Map<string, ClientActivity>();
    for (const m of members) {
      const a = clientActivity(byMember.get(m.id) ?? [], now, ctx.rules);
      if (!a) continue;
      activity.set(m.id, a);
      const contact = contactOf.get(m.id);
      const msgAt = messageOf.get(m.id);
      const msgDays = msgAt ? differenceInCalendarDays(today, msgAt) : null;
      let blocked: string | null = null;
      if (m.doNotContact) blocked = 'Ne pas contacter';
      else if (msgDays !== null && msgDays < ctx.rules.messageGapDays) {
        blocked = msgDays === 0 ? 'Contacté aujourd’hui' : `Contacté il y a ${msgDays} j`;
      }

      let reason: OutreachReason | null = todoItem.get(m.id)?.reason ?? null;
      const quiet = !contact || differenceInCalendarDays(today, contact.createdAt) >= EXTRA_QUIET_DAYS;
      if (!reason && quiet) {
        if (a.segment === 'NEW' && a.visitDays === 1 && a.daysSinceFirst <= 2) reason = 'WELCOME';
        else if (a.segment === 'OCCASIONAL' && a.daysSinceLast >= NEWS_AFTER_DAYS) reason = 'NEWS';
        else if (a.segment === 'INACTIVE' && a.daysSinceLast <= WINBACK_UNTIL_DAYS) reason = 'WINBACK';
        else if (a.segment === 'AT_RISK') reason = 'INACTIVE';
      }
      const action = reason ? { reason, label: ACTION_LABEL[reason] } : null;
      const todo: ClientTodo | null =
        !action || blocked
          ? null
          : reason === 'ABO_EXPIRING' || reason === 'ABO_ENDED'
            ? 'ABO'
            : COME_BACK_REASONS.has(reason!) && (a.segment === 'AT_RISK' || a.segment === 'NEW' || a.segment === 'INACTIVE')
              ? a.segment
              : 'OTHER';
      rows.push({
        memberId: m.id,
        name: name(m),
        phone: m.phone,
        segment: a.segment,
        why: a.why,
        lastVisit: a.last,
        daysSinceLast: a.daysSinceLast,
        visits30: a.visits30,
        abonnement: aboOf.get(m.id) ?? null,
        lastContact: contact ? { at: contact.createdAt.toISOString(), channel: contact.channel } : null,
        action,
        blocked,
        todo,
      });
    }
    return { ctx, rows, activity, relances };
  }

  async list(opts: {
    facilityId?: string;
    segment?: string;
    abo?: string;
    todo?: string;
    q?: string;
    page?: number;
    perPage?: number;
  }) {
    const { ctx, rows } = await this.build(opts.facilityId);
    const counts = Object.fromEntries([['ALL', rows.length], ...CLIENT_SEGMENTS.map((s) => [s, 0])]) as Record<
      'ALL' | ClientSegment,
      number
    >;
    const abos = { ACTIVE: 0, EXPIRED: 0 };
    const todo = Object.fromEntries(CLIENT_TODO.map((t) => [t, 0])) as Record<ClientTodo, number>;
    for (const r of rows) {
      counts[r.segment]++;
      if (r.abonnement) abos[r.abonnement.status]++;
      if (r.todo) todo[r.todo]++;
    }

    const segment = (CLIENT_SEGMENTS as readonly string[]).includes(opts.segment || '') ? opts.segment : null;
    const abo = ['ACTIVE', 'EXPIRED', 'NONE'].includes(opts.abo || '') ? opts.abo : null;
    const todoFilter = opts.todo === 'ALL' || (CLIENT_TODO as readonly string[]).includes(opts.todo || '') ? opts.todo : null;
    const q = (opts.q || '').trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    const filtered = rows.filter(
      (r) =>
        (!segment || r.segment === segment) &&
        (!abo || (abo === 'NONE' ? !r.abonnement : r.abonnement?.status === abo)) &&
        (!todoFilter || (todoFilter === 'ALL' ? !!r.todo : r.todo === todoFilter)) &&
        (!q || r.name.toLowerCase().includes(q) || (digits.length >= 3 && (r.phone || '').replace(/\D/g, '').includes(digits))),
    );
    // Clients to contact first (in the order of the to-do band), then the most recent visits
    const rank = (r: ClientListRow) => (r.todo ? CLIENT_TODO.indexOf(r.todo) : CLIENT_TODO.length);
    filtered.sort((a, b) => rank(a) - rank(b) || a.daysSinceLast - b.daysSinceLast || a.name.localeCompare(b.name, 'fr'));

    const perPage = Math.min(100, Math.max(5, opts.perPage || 20));
    const lastPage = Math.max(1, Math.ceil(filtered.length / perPage));
    const page = Math.min(lastPage, Math.max(1, opts.page || 1));
    return {
      generatedAt: new Date().toISOString(),
      rules: ctx.rules,
      describe: segmentRules(ctx.rules),
      counts,
      abos,
      /** Came at least once in the last 30 days */
      recent30: rows.filter((r) => r.daysSinceLast < WINDOW_DAYS).length,
      todo: CLIENT_TODO.filter((t) => todo[t] > 0).map((t) => ({ key: t, label: TODO_LABEL[t], count: todo[t] })),
      todoTotal: rows.filter((r) => r.todo).length,
      total: filtered.length,
      page,
      lastPage,
      rows: filtered.slice((page - 1) * perPage, page * perPage),
    };
  }

  /** Member ids of a client group (campaigns), without « Ne pas contacter ». */
  async segmentIds(segment: ClientSegment, facilityId?: string) {
    const { rows } = await this.build(facilityId);
    return rows.filter((r) => r.segment === segment && r.blocked !== 'Ne pas contacter').map((r) => r.memberId);
  }

  /** Clients per group that a campaign could reach (without « Ne pas contacter »). */
  async segmentCounts(facilityId?: string) {
    const { rows } = await this.build(facilityId);
    const out = Object.fromEntries(CLIENT_SEGMENTS.map((s) => [s, 0])) as Record<ClientSegment, number>;
    for (const r of rows) if (r.blocked !== 'Ne pas contacter') out[r.segment]++;
    return out;
  }

  /** Client file: who, why this group, visits, abonnements, payments, contacts, message ready to send. */
  async client(memberId: string, facilityId?: string) {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        createdAt: true,
        heardFrom: true,
        profileType: true,
        awayReason: true,
        pwaInstalledAt: true,
        doNotContact: true,
        doNotContactAt: true,
        staffNote: true,
        deletedAt: true,
      },
    });
    if (!member || member.deletedAt) throw new NotFoundException('Client introuvable');
    const { ctx, rows, activity, relances } = await this.build(facilityId);
    const row = rows.find((r) => r.memberId === memberId) ?? null;
    const a = activity.get(memberId) ?? null;
    const [visits, abos, payments, history, push, vars] = await Promise.all([
      this.prisma.journal.findMany({
        where: { memberID: memberId, isReservation: false, hiddenAt: null },
        orderBy: { registredTime: 'desc' },
        take: 60,
        select: { registredTime: true, serviceName: true, payedAmount: true, paidAmount: true, isPayed: true },
      }),
      this.prisma.abonnement.findMany({
        where: { memberID: memberId, isReservation: false, hiddenAt: null },
        orderBy: { registredDate: 'desc' },
        take: 20,
        select: {
          id: true,
          registredDate: true,
          leaveDate: true,
          terminatedAt: true,
          serviceName: true,
          amountDue: true,
          payedAmount: true,
          price: { select: { name: true } },
          payments: { select: { amount: true, paidAt: true } },
        },
      }),
      this.prisma.journal.findMany({
        where: { memberID: memberId, hiddenAt: null, paidAmount: { gt: 0 } },
        orderBy: { registredTime: 'desc' },
        take: 20,
        select: { registredTime: true, paidAt: true, paidAmount: true, serviceName: true },
      }),
      this.outreach.history(memberId),
      this.prisma.pushSubscription.count({ where: { memberId } }),
      memberMessageVars(this.prisma, [memberId], ctx.place),
    ]);
    const item = relances.todo.find((i) => i.memberId === memberId);
    const reason = row?.action?.reason ?? null;
    const message = reason
      ? item?.reason === reason
        ? item.message
        : this.outreach.draft(reason, { firstName: member.firstName?.trim() || '', place: ctx.place, days: String(a?.daysSinceLast ?? '') })
      : '';
    const blockedWhy = await contactBlock(this.prisma, memberId, 'WHATSAPP', { gapDays: ctx.rules.messageGapDays, reason: reason ?? undefined });

    const paid = [
      ...payments.map((p) => ({ at: (p.paidAt ?? p.registredTime).toISOString(), amount: round1(p.paidAmount), label: p.serviceName || 'Visite' })),
      ...abos.flatMap((ab) =>
        ab.payments.map((p) => ({ at: p.paidAt.toISOString(), amount: round1(p.amount), label: ab.serviceName || ab.price?.name || 'Abonnement' })),
      ),
    ]
      .sort((x, y) => y.at.localeCompare(x.at))
      .slice(0, 20);
    const visitDays = [...new Set(visits.map((v) => localDayKey(v.registredTime)))];

    return {
      memberId,
      name: name(member),
      firstName: member.firstName?.trim() || '',
      phone: member.phone,
      email: member.email,
      whatsapp: whatsappNumber(member.phone),
      hasPush: this.push.isEnabled() && push > 0,
      hasApp: !!member.pwaInstalledAt,
      since: member.createdAt.toISOString(),
      heardFrom: member.heardFrom,
      profileType: member.profileType,
      awayReason: member.awayReason,
      doNotContact: member.doNotContact,
      staffNote: member.staffNote,
      segment: row?.segment ?? null,
      why: row?.why ?? 'Jamais venu',
      rule: row ? segmentRules(ctx.rules)[row.segment] : null,
      stats: a
        ? {
            total: a.visitDays,
            visits30: a.visits30,
            perWeek: round1((a.visits30 / WINDOW_DAYS) * 7),
            first: a.first,
            last: a.last,
          }
        : null,
      visits: visitDays.slice(0, 30),
      abonnements: abos.map((ab) => ({
        id: ab.id,
        name: ab.serviceName || ab.price?.name || 'Abonnement',
        from: ab.registredDate.toISOString(),
        until: (ab.terminatedAt ?? ab.leaveDate)?.toISOString() ?? null,
        active: !ab.terminatedAt && (!ab.leaveDate || ab.leaveDate >= startOfDay(new Date())),
        amount: round1(ab.amountDue ?? ab.payedAmount ?? 0),
        paid: round1(ab.payedAmount ?? 0),
      })),
      payments: paid,
      contacts: history.contacts,
      action: row?.action ?? null,
      message,
      vars: vars.get(memberId) ?? {},
      /** Why a message can't be sent now (null = OK) */
      blocked: blockedWhy,
      messageGapDays: ctx.rules.messageGapDays,
    };
  }

  /** « Autre version (IA) »: Claude writes the message from this client's facts and the offer picked by staff. */
  async draft(memberId: string, body: { reason?: string; promotionId?: string | null; previous?: string | null }, facilityId?: string) {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
      throw new BadRequestException("IA non configurée : ajoutez ANTHROPIC_API_KEY dans le fichier .env du backend.");
    }
    const file = await this.client(memberId, facilityId);
    const reason = (body.reason as OutreachReason) || file.action?.reason;
    let offer: string | null = null;
    if (body.promotionId) {
      const now = new Date();
      const promo = await this.prisma.promotion.findFirst({
        where: { id: body.promotionId, isActive: true, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        select: { title: true, description: true },
      });
      if (!promo) throw new BadRequestException('Cette promotion n’est plus active');
      offer = promo.description ? `${promo.title} — ${promo.description}` : promo.title;
    }
    const ctx = await this.context(facilityId);
    // Org-level keys (not scoped to a workspace) must name the workspace on every request
    const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
    this.ai ??= new Anthropic(workspaceId ? { defaultHeaders: { 'anthropic-workspace-id': workspaceId } } : {});
    const abo = file.abonnements[0];
    try {
      const message = await draftClientMessage(this.ai, {
        place: ctx.place,
        firstName: file.firstName,
        goal: reason ? ACTION_LABEL[reason] : 'Prendre des nouvelles',
        situation: file.segment ? `${SEGMENT_LABEL[file.segment]} — ${file.why}` : file.why,
        lastVisit: file.stats ? format(new Date(`${file.stats.last}T12:00:00`), 'EEEE d MMMM', { locale: fr }) : null,
        visits30: file.stats?.visits30 ?? 0,
        abonnement: abo
          ? `${abo.name}, ${abo.active ? 'en cours' : 'terminé'}${abo.until ? ` (fin ${format(new Date(abo.until), 'd MMMM', { locale: fr })})` : ''}`
          : null,
        offer,
        previous: body.previous?.slice(0, 1000) || null,
      });
      return { message };
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
        throw new BadRequestException('Clé IA refusée : vérifiez ANTHROPIC_API_KEY dans le fichier .env du backend. Le message prêt reste utilisable.');
      }
      if (e instanceof Anthropic.APIError) throw new BadRequestException(`IA indisponible (${e.status ?? 'réseau'}). Réessayez.`);
      throw new BadRequestException((e as Error).message);
    }
  }

  async update(memberId: string, body: { doNotContact?: boolean; staffNote?: string | null }) {
    const m = await this.prisma.member.findUnique({ where: { id: memberId }, select: { id: true, doNotContact: true } });
    if (!m) throw new NotFoundException('Client introuvable');
    const data: { doNotContact?: boolean; doNotContactAt?: Date | null; staffNote?: string | null } = {};
    if (typeof body.doNotContact === 'boolean' && body.doNotContact !== m.doNotContact) {
      data.doNotContact = body.doNotContact;
      data.doNotContactAt = body.doNotContact ? new Date() : null;
    }
    if (body.staffNote !== undefined) {
      const note = (body.staffNote ?? '').trim();
      if (note.length > 1000) throw new BadRequestException('Note trop longue (1000 caractères max)');
      data.staffNote = note || null;
    }
    await this.prisma.member.update({ where: { id: memberId }, data });
    return { ok: true };
  }
}
