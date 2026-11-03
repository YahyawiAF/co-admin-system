import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';
import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  format,
  startOfDay,
  subDays,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { MemberService } from '../member/member.service';
import { PushService } from '../push/push.service';
import { localDayKey, parseLocalDay } from '../../../common/parse-local-day';
import { PerformanceService } from './performance.service';
import { computeOffers, computeTopUps, type AbonnementOffer, type TopUpOffer } from './offers';
import { round1 } from './traffic';
import { NewcomersService } from './newcomers.service';

export const OUTREACH_REASONS = [
  'ABO_EXPIRING',
  'ABO_ENDED',
  'UNPAID',
  'RECALL',
  'INACTIVE',
  'NEW_NOT_BACK',
  'TOP_UP',
  'CONVERT',
  'REVIEW',
  'FOLLOW_UP',
] as const;
export type OutreachReason = (typeof OUTREACH_REASONS)[number];
/** How the member was reached. PERSON = at the desk, GROUP = WhatsApp group or status (one post, many people). */
export const OUTREACH_CHANNELS = ['WHATSAPP', 'PUSH', 'CALL', 'PERSON', 'INSTAGRAM', 'GROUP', 'SKIP'] as const;
export type OutreachChannel = (typeof OUTREACH_CHANNELS)[number];

/** Days a contact keeps the member out of the to-do list for the same reason. */
const SNOOZE_DAYS: Record<OutreachReason, number> = {
  ABO_EXPIRING: 3,
  ABO_ENDED: 7,
  UNPAID: 5,
  RECALL: 7,
  INACTIVE: 10,
  NEW_NOT_BACK: 30,
  TOP_UP: 7,
  CONVERT: 14,
  REVIEW: 30,
  FOLLOW_UP: 3,
};
/** Member's answer when staff mark a relance as contacted. */
export const OUTREACH_OUTCOMES = [
  'INTERESTED',
  'OTHER_OFFER',
  'KEEP_TARIF',
  'AWAY',
  'NO_ANSWER',
  'NOT_INTERESTED',
] as const;
export type OutreachOutcome = (typeof OUTREACH_OUTCOMES)[number];
const OUTCOME_LABEL: Record<OutreachOutcome, string> = {
  INTERESTED: 'Intéressé',
  OTHER_OFFER: 'Veut une autre offre',
  KEEP_TARIF: 'Garde le tarif',
  AWAY: 'Parti / en voyage',
  NO_ANSWER: 'Pas de réponse',
  NOT_INTERESTED: 'Pas intéressé',
};
/** "Pas intéressé" keeps the member out of the to-do list this long. */
const NOT_INTERESTED_DAYS = 60;
/** Suivi looks back this far (open relances, auto-closing). */
const SUIVI_DAYS = 90;
/** Why a member stopped coming (Relances, 1 click). */
export const AWAY_REASONS = ['STUDY_HOME', 'PRICE', 'DISTANCE', 'NOISE', 'HOURS', 'OTHER'] as const;
export type AwayReason = (typeof AWAY_REASONS)[number];
/** Contacts whose result is "came back for a visit". */
const VISIT_REASONS = new Set<string>(['INACTIVE', 'NEW_NOT_BACK', 'RECALL']);
/** A newcomer who came once is listed from this many days after the visit, until 30 days. */
const NEW_NOT_BACK_FROM_DAYS = 3;
const NEW_NOT_BACK_TO_DAYS = 30;

/** Days after a contact during which a renewal / visit / payment counts as a result. */
const RESULT_WINDOW_DAYS = 14;

export type OutreachItem = {
  memberId: string;
  name: string;
  firstName: string;
  phone: string | null;
  whatsapp: string | null;
  hasPush: boolean;
  reason: OutreachReason;
  title: string;
  detail: string;
  /** Rough money at stake (DT) — used for sorting. */
  value: number;
  owed: number;
  message: string;
  offer?: AbonnementOffer;
  topUp?: TopUpOffer;
  lastContact: { at: string; channel: string; reason: string } | null;
  snoozed: boolean;
  profileType: string | null;
  awayReason: string | null;
  recallAt: string | null;
  /** Follow-up date reached: what the member answered last time. */
  followUp: { outreachId: string; outcome: string; note: string | null; contactedAt: string; at: string } | null;
};

function money(n: number) {
  return `${Math.round(n * 10) / 10} DT`.replace('.', ',');
}

/** Tunisian numbers: 8 digits → 216XXXXXXXX. */
export function whatsappNumber(phone?: string | null) {
  if (!phone) return null;
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 8) d = `216${d}`;
  return d.length >= 10 ? d : null;
}

function when(d: Date, today: Date) {
  const n = differenceInCalendarDays(d, today);
  if (n === 0) return "aujourd'hui";
  if (n === 1) return 'demain';
  if (n === -1) return 'hier';
  if (n > 1) return `${format(d, 'EEEE d MMMM', { locale: fr })}`;
  return `il y a ${-n} jours`;
}

@Injectable()
export class OutreachService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly members: MemberService,
    private readonly performance: PerformanceService,
    private readonly push: PushService,
    private readonly newcomers: NewcomersService,
  ) {}

  private async owedByMember(today: Date) {
    const [{ members }, openVisits] = await Promise.all([
      this.members.listDebtors(),
      this.prisma.journal.findMany({
        where: { isPayed: false, leaveTime: null, registredTime: { gte: today } },
        select: { id: true },
      }),
    ]);
    const open = new Set(openVisits.map((v) => v.id));
    const out = new Map<string, { amount: number; oldest: Date | null }>();
    for (const m of members) {
      let amount = 0;
      let oldest: Date | null = null;
      for (const it of m.items) {
        if (it.settled) continue;
        if (it.source === 'VISIT' && it.journalId && open.has(it.journalId)) continue;
        amount += it.amount;
        const d = new Date(it.date);
        if (!oldest || d < oldest) oldest = d;
      }
      if (amount > 0.009) out.set(m.memberId, { amount: round1(amount), oldest });
    }
    return out;
  }

  async list(facilityId?: string) {
    const now = new Date();
    const today = startOfDay(now);
    await this.autoClose(today);
    const settings = await this.performance.settings(facilityId);
    const facility = await this.prisma.facility.findUnique({
      where: { id: settings.facilityId },
      select: { name: true },
    });
    const place = facility?.name || 'notre espace';
    const reviewUrl = settings.googleReviewUrl;

    const quietSince = subDays(today, settings.inactiveAlertDays);
    const [abos, owed, offers, regularVisits, topUps, newcomers, waiting] = await Promise.all([
      this.prisma.abonnement.findMany({
        where: { isReservation: false, leaveDate: { gte: subDays(today, 14) } },
        select: {
          memberID: true,
          registredDate: true,
          leaveDate: true,
          serviceName: true,
          amountDue: true,
          listPrice: true,
          price: { select: { name: true, price: true } },
        },
      }),
      this.owedByMember(today),
      computeOffers(this.prisma, null, now),
      this.prisma.journal.findMany({
        where: {
          registredTime: { gte: subDays(quietSince, 28) },
          isReservation: false,
          memberID: { not: null },
        },
        select: { memberID: true, registredTime: true, payedAmount: true },
      }),
      computeTopUps(this.prisma, now),
      this.newcomers.newcomers(now),
      this.prisma.member.findMany({
        where: { recallAt: { not: null, gte: subDays(today, 14) }, deletedAt: null },
        select: { id: true, recallAt: true, awayReason: true },
      }),
    ]);
    /** Recall date still ahead: the member said why they are away, leave them alone until then. */
    const recallLater = new Set(waiting.filter((w) => w.recallAt! > endOfDay(today)).map((w) => w.id));

    const drafts = new Map<string, Omit<OutreachItem, 'name' | 'firstName' | 'phone' | 'whatsapp' | 'hasPush' | 'message' | 'lastContact' | 'snoozed' | 'profileType' | 'awayReason' | 'recallAt' | 'followUp'> & { ctx: Record<string, string> }>();
    const add = (d: Parameters<typeof drafts.set>[1]) => {
      const cur = drafts.get(d.memberId);
      if (!cur || OUTREACH_REASONS.indexOf(d.reason) < OUTREACH_REASONS.indexOf(cur.reason)) {
        drafts.set(d.memberId, d);
      }
    };

    const latest = new Map<string, (typeof abos)[number]>();
    for (const a of abos) {
      const cur = latest.get(a.memberID);
      if (!cur || a.leaveDate! > cur.leaveDate!) latest.set(a.memberID, a);
    }
    for (const a of latest.values()) {
      const name = a.serviceName || a.price?.name || 'abonnement';
      const value = a.amountDue ?? a.listPrice ?? a.price?.price ?? 0;
      const end = a.leaveDate!;
      if (a.registredDate <= now && end >= today && end <= endOfDay(addDays(today, 3))) {
        add({
          memberId: a.memberID,
          reason: 'ABO_EXPIRING',
          title: `Abonnement se termine ${when(end, today)}`,
          detail: name,
          value,
          owed: 0,
          ctx: { plan: name, when: when(end, today) },
        });
      } else if (end < today) {
        add({
          memberId: a.memberID,
          reason: 'ABO_ENDED',
          title: `Abonnement terminé ${when(end, today)}`,
          detail: `${name} · pas renouvelé`,
          value,
          owed: 0,
          ctx: { plan: name, when: when(end, today) },
        });
      }
    }

    for (const [memberId, o] of owed) {
      const days = o.oldest ? differenceInCalendarDays(today, o.oldest) : 0;
      add({
        memberId,
        reason: 'UNPAID',
        title: `Doit ${money(o.amount)}`,
        detail: days > 0 ? `Depuis ${days} jour${days > 1 ? 's' : ''}` : "Depuis aujourd'hui",
        value: o.amount,
        owed: o.amount,
        ctx: { amount: money(o.amount) },
      });
    }

    const regular = new Map<string, { days: Set<string>; recent: boolean; last: Date; spend: number }>();
    for (const v of regularVisits) {
      const id = v.memberID!;
      let r = regular.get(id);
      if (!r) {
        r = { days: new Set(), recent: false, last: v.registredTime, spend: 0 };
        regular.set(id, r);
      }
      if (v.registredTime >= quietSince) r.recent = true;
      else {
        r.days.add(localDayKey(v.registredTime));
        r.spend += v.payedAmount || 0;
      }
      if (v.registredTime > r.last) r.last = v.registredTime;
    }
    const minDays = Math.max(4, Math.round(settings.regularVisitsPerWeek * 4 * 0.75));
    for (const [memberId, r] of regular) {
      if (r.recent || r.days.size < minDays || recallLater.has(memberId)) continue;
      const days = differenceInCalendarDays(today, r.last);
      add({
        memberId,
        reason: 'INACTIVE',
        title: `Habitué absent depuis ${days} jours`,
        detail: `Venait ~${round1(r.days.size / 4)} fois/semaine`,
        value: round1(r.spend),
        owed: 0,
        ctx: { days: String(days) },
      });
    }

    for (const w of waiting) {
      if (w.recallAt! > endOfDay(today)) continue;
      add({
        memberId: w.id,
        reason: 'RECALL',
        title: `À rappeler ${when(w.recallAt!, today)}`,
        detail: w.awayReason === 'STUDY_HOME' ? 'Révisait à la maison' : 'Rappel prévu',
        value: 0,
        owed: 0,
        ctx: { away: w.awayReason || '' },
      });
    }

    for (const n of newcomers) {
      const days = differenceInCalendarDays(today, n.first);
      if (n.back || n.visitDays > 1 || days < NEW_NOT_BACK_FROM_DAYS || days > NEW_NOT_BACK_TO_DAYS) continue;
      if (recallLater.has(n.memberId)) continue;
      add({
        memberId: n.memberId,
        reason: 'NEW_NOT_BACK',
        title: `Venu une fois · ${when(n.first, today)}`,
        detail: n.appDay1 || n.hasApp ? "A l'app" : "Sans l'app",
        value: 0,
        owed: 0,
        ctx: {},
      });
    }

    for (const t of topUps.values()) {
      add({
        memberId: t.memberId,
        reason: 'TOP_UP',
        title: t.headline,
        detail: `${t.visitDays} jour${t.visitDays > 1 ? 's' : ''} de visite depuis le ${format(parseLocalDay(t.firstVisit), 'd MMM', { locale: fr })}`,
        value: t.plan.price,
        owed: 0,
        topUp: t,
        ctx: {},
      });
    }

    for (const offer of offers.values()) {
      add({
        memberId: offer.memberId,
        reason: 'CONVERT',
        title: offer.observed,
        detail: offer.headline,
        value: offer.plan.price,
        owed: 0,
        offer,
        ctx: {},
      });
    }

    if (reviewUrl) {
      for (const r of await this.reviewCandidates(today, settings.reviewAfterVisits)) {
        add({
          memberId: r.memberId,
          reason: 'REVIEW',
          title: `Fidèle · ${r.visits} visites`,
          detail: 'Demander un avis Google',
          value: 0,
          owed: 0,
          ctx: { visits: String(r.visits), url: reviewUrl },
        });
      }
    }

    /** Answers recorded on relances: due ones come back, the others wait in Suivi. */
    const answers = await this.prisma.memberOutreach.findMany({
      where: {
        outcome: { not: null },
        campaignId: null,
        createdAt: { gte: subDays(today, SUIVI_DAYS) },
        OR: [{ closedAt: null }, { closedResult: 'LOST', outcome: 'NOT_INTERESTED' }],
      },
      orderBy: { createdAt: 'desc' },
    });
    const held = new Set<string>();
    const due = new Map<string, (typeof answers)[number]>();
    for (const a of answers) {
      if (held.has(a.memberId) || due.has(a.memberId)) continue;
      if (a.closedAt) {
        if (differenceInCalendarDays(today, a.createdAt) < NOT_INTERESTED_DAYS) held.add(a.memberId);
      } else if (!a.followUpAt || a.followUpAt > endOfDay(today)) {
        held.add(a.memberId);
      } else {
        due.set(a.memberId, a);
      }
    }
    for (const [memberId, a] of due) {
      if (drafts.has(memberId)) continue;
      const said = OUTCOME_LABEL[a.outcome as OutreachOutcome] ?? a.outcome;
      add({
        memberId,
        reason: 'FOLLOW_UP',
        title: `Rappel prévu ${when(a.followUpAt!, today)}`,
        detail: `A dit « ${said} »${a.note ? ` · ${a.note}` : ''}`,
        value: 0,
        owed: 0,
        ctx: {},
      });
    }

    const ids = [...drafts.keys()];
    const [people, pushRows, contacts] = await Promise.all([
      this.prisma.member.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          profileType: true,
          awayReason: true,
          recallAt: true,
        },
      }),
      this.prisma.pushSubscription.groupBy({
        by: ['memberId'],
        where: { memberId: { in: ids } },
        _count: true,
      }),
      this.prisma.memberOutreach.findMany({
        where: { memberId: { in: ids }, createdAt: { gte: subDays(today, 30) } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const person = new Map(people.map((p) => [p.id, p]));
    const withPush = new Set(pushRows.map((p) => p.memberId));
    const pushEnabled = this.push.isEnabled();

    const items: OutreachItem[] = [];
    for (const d of drafts.values()) {
      const p = person.get(d.memberId);
      if (!p) continue;
      const firstName = p.firstName?.trim() || '';
      const owedNow = owed.get(d.memberId)?.amount ?? 0;
      const mine = contacts.filter((c) => c.memberId === d.memberId);
      const last = mine[0];
      const sameReason = mine.find((c) => c.reason === d.reason);
      const answer = due.get(d.memberId);
      const snoozed =
        held.has(d.memberId) ||
        (!answer &&
          !!sameReason &&
          differenceInCalendarDays(today, sameReason.createdAt) < SNOOZE_DAYS[d.reason]);
      const { ctx, ...rest } = d;
      items.push({
        ...rest,
        owed: owedNow,
        name: [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Client',
        firstName,
        phone: p.phone,
        whatsapp: whatsappNumber(p.phone),
        hasPush: pushEnabled && withPush.has(d.memberId),
        message: this.message(d.reason, { ...ctx, firstName, place, owed: owedNow }, d.offer, d.topUp),
        lastContact: last
          ? { at: last.createdAt.toISOString(), channel: last.channel, reason: last.reason }
          : null,
        snoozed,
        profileType: p.profileType,
        awayReason: p.awayReason,
        recallAt: p.recallAt ? p.recallAt.toISOString() : null,
        followUp: answer
          ? {
              outreachId: answer.id,
              outcome: answer.outcome!,
              note: answer.note,
              contactedAt: answer.createdAt.toISOString(),
              at: answer.followUpAt!.toISOString(),
            }
          : null,
      });
    }
    // Promised call-backs first, then by reason and money at stake
    items.sort(
      (a, b) =>
        Number(!!b.followUp) - Number(!!a.followUp) ||
        OUTREACH_REASONS.indexOf(a.reason) - OUTREACH_REASONS.indexOf(b.reason) ||
        b.value - a.value,
    );

    return {
      generatedAt: now.toISOString(),
      pushEnabled,
      todo: items.filter((i) => !i.snoozed),
      contacted: items.filter((i) => i.snoozed),
      results: await this.results(today),
      awayReasons: await this.awayStats(today),
    };
  }

  /**
   * Finance → Nouveaux list: newcomers of the last `days` days, newest first, paginated.
   * NOT_BACK = one visit day, 3+ days ago (to relance) · NEW = first visit < 3 days ago · BACK = came again.
   */
  async newcomersList(opts: { status?: string; days?: number; page?: number; perPage?: number }) {
    const now = new Date();
    const today = startOfDay(now);
    const days = Math.min(180, Math.max(7, opts.days || 30));
    const perPage = Math.min(100, Math.max(5, opts.perPage || 20));
    const all = (await this.newcomers.newcomers(now))
      .filter((n) => n.first >= subDays(today, days - 1))
      .sort((a, b) => b.first.getTime() - a.first.getTime());
    const statusOf = (n: (typeof all)[number]) =>
      n.visitDays > 1 || n.back
        ? 'BACK'
        : differenceInCalendarDays(today, n.first) >= NEW_NOT_BACK_FROM_DAYS
          ? 'NOT_BACK'
          : 'NEW';
    const counts = { ALL: all.length, NOT_BACK: 0, NEW: 0, BACK: 0 } as Record<string, number>;
    for (const n of all) counts[statusOf(n)]++;
    const status = ['NOT_BACK', 'NEW', 'BACK'].includes(opts.status || '') ? opts.status! : 'ALL';
    const filtered = status === 'ALL' ? all : all.filter((n) => statusOf(n) === status);
    const lastPage = Math.max(1, Math.ceil(filtered.length / perPage));
    const page = Math.min(lastPage, Math.max(1, opts.page || 1));
    const slice = filtered.slice((page - 1) * perPage, page * perPage);
    const ids = slice.map((n) => n.memberId);

    const settings = await this.performance.settings();
    const facility = await this.prisma.facility.findUnique({
      where: { id: settings.facilityId },
      select: { name: true },
    });
    const place = facility?.name || 'notre espace';
    const [people, contacts] = await Promise.all([
      this.prisma.member.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          profileType: true,
          heardFrom: true,
          awayReason: true,
          recallAt: true,
        },
      }),
      this.prisma.memberOutreach.findMany({
        where: { memberId: { in: ids }, channel: { not: 'SKIP' } },
        orderBy: { createdAt: 'desc' },
        select: { memberId: true, createdAt: true, channel: true, reason: true },
      }),
    ]);
    const person = new Map(people.map((p) => [p.id, p]));
    const rows = slice.map((n) => {
      const p = person.get(n.memberId);
      const firstName = p?.firstName?.trim() || '';
      const last = contacts.find((c) => c.memberId === n.memberId);
      const stayHours = n.firstLeave
        ? Math.round(((n.firstLeave.getTime() - n.first.getTime()) / 3_600_000) * 10) / 10
        : null;
      return {
        memberId: n.memberId,
        name: [p?.firstName, p?.lastName].filter(Boolean).join(' ') || 'Client',
        phone: p?.phone ?? null,
        whatsapp: whatsappNumber(p?.phone),
        first: n.first.toISOString(),
        firstService: n.firstService,
        stayHours,
        visitDays: n.visitDays,
        last: n.last.toISOString(),
        status: statusOf(n),
        hasApp: n.hasApp,
        profileType: p?.profileType ?? null,
        heardFrom: p?.heardFrom ?? null,
        awayReason: p?.awayReason ?? null,
        recallAt: p?.recallAt ? p.recallAt.toISOString() : null,
        lastContact: last ? { at: last.createdAt.toISOString(), channel: last.channel } : null,
        message: this.message('NEW_NOT_BACK', { firstName, place, owed: 0 }),
      };
    });
    return {
      rows,
      counts,
      meta: { currentPage: page, lastPage, perPage, total: filtered.length },
    };
  }

  /** Answers to "pourquoi tu ne viens plus ?" over the last 90 days. */
  private async awayStats(today: Date) {
    const rows = await this.prisma.member.groupBy({
      by: ['awayReason'],
      where: { awayReason: { not: null }, awayReasonAt: { gte: subDays(today, 90) } },
      _count: true,
    });
    return Object.fromEntries(rows.map((r) => [r.awayReason!, r._count])) as Record<string, number>;
  }

  /** Next exam period start (owner calendar) minus 2 weeks, else mid-December / +45 days. */
  private async studyRecallDate(now: Date) {
    const exams = await this.prisma.advisorFact.findFirst({
      where: { kind: 'PERIOD', tag: 'exams', startDate: { gt: addDays(now, 7) } },
      orderBy: { startDate: 'asc' },
      select: { startDate: true },
    });
    if (exams?.startDate) return startOfDay(subDays(exams.startDate, 14));
    return startOfDay(addDays(now, 45));
  }

  /** Save why the member stopped coming; "révise à la maison" schedules a recall before exams. */
  async setAwayReason(body: { memberId?: string; reason?: string | null; recallAt?: string | null }) {
    if (!body.memberId) throw new BadRequestException('memberId requis');
    const now = new Date();
    if (!body.reason) {
      await this.prisma.member.update({
        where: { id: body.memberId },
        data: { awayReason: null, awayReasonAt: null, recallAt: null },
      });
      return { memberId: body.memberId, awayReason: null, recallAt: null };
    }
    if (!AWAY_REASONS.includes(body.reason as AwayReason)) throw new BadRequestException('Raison invalide');
    let recallAt: Date | null = null;
    if (body.recallAt) {
      recallAt = parseLocalDay(body.recallAt.slice(0, 10));
    } else if (body.reason === 'STUDY_HOME') {
      recallAt = await this.studyRecallDate(now);
    }
    const m = await this.prisma.member.update({
      where: { id: body.memberId },
      data: { awayReason: body.reason, awayReasonAt: now, recallAt },
      select: { id: true, awayReason: true, recallAt: true },
    });
    return { memberId: m.id, awayReason: m.awayReason, recallAt: m.recallAt?.toISOString() ?? null };
  }

  private message(
    reason: OutreachReason,
    c: { [k: string]: string | number; firstName: string; place: string; owed: number },
    offer?: AbonnementOffer,
    topUp?: TopUpOffer,
  ) {
    const hi = c.firstName ? `Bonjour ${c.firstName}` : 'Bonjour';
    const debt =
      c.owed > 0.009 && reason !== 'UNPAID'
        ? ` Petit rappel : il reste ${money(c.owed)} à régler.`
        : '';
    switch (reason) {
      case 'ABO_EXPIRING':
        return `${hi}, votre ${c.plan} chez ${c.place} se termine ${c.when}. Vous pouvez le renouveler à l'accueil ou en répondant à ce message pour garder votre place.${debt}`;
      case 'ABO_ENDED':
        return `${hi}, votre ${c.plan} chez ${c.place} s'est terminé ${c.when}. On serait ravis de vous revoir ! Vous pouvez le renouveler à l'accueil quand vous voulez.${debt}`;
      case 'UNPAID':
        return `${hi}, petit rappel de ${c.place} : il reste ${c.amount} à régler. Vous pouvez payer lors de votre prochain passage. Merci !`;
      case 'NEW_NOT_BACK':
        return `${hi}, merci d'être passé(e) chez ${c.place} ! Ta place t'attend : reviens quand tu veux, on sera ravis de te revoir.${debt}`;
      case 'RECALL':
        return c.away === 'STUDY_HOME'
          ? `${hi}, les révisions arrivent ! ${c.place} t'attend avec un espace calme pour bosser. On te garde ta place ?${debt}`
          : `${hi}, ça fait un moment ! ${c.place} t'attend, on serait ravis de te revoir.${debt}`;
      case 'INACTIVE':
        return `${hi}, ça fait ${c.days} jours qu'on ne vous a pas vu chez ${c.place} ! Votre place vous attend, à bientôt.${debt}`;
      case 'TOP_UP': {
        if (!topUp) return `${hi}, merci pour vos visites chez ${c.place} !`;
        return topUp.remaining <= 0
          ? `${hi}, vous avez déjà payé ${money(topUp.paid)} en passes ces ${topUp.plan.periodDays} derniers jours chez ${c.place}, c'est autant que l'${topUp.plan.name} (${money(topUp.plan.price)}). On vous le passe en abonnement sans rien payer de plus ?${debt}`
          : `${hi}, vous avez déjà payé ${money(topUp.paid)} en passes ces ${topUp.plan.periodDays} derniers jours chez ${c.place}. Pour seulement ${money(topUp.remaining)} de plus, vous passez à l'${topUp.plan.name} (${money(topUp.plan.price)}) : vos passes sont déduits. On vous le prépare ?${debt}`;
      }
      case 'FOLLOW_UP':
        return `${hi}, je reviens vers vous comme convenu de la part de ${c.place}. Vous avez pu y réfléchir ?${debt}`;
      case 'REVIEW':
        return `${hi}, merci pour vos ${c.visits} visites chez ${c.place} ! Si vous aimez l'espace, un petit avis Google nous aiderait énormément (30 secondes) : ${c.url}`;
      case 'CONVERT': {
        if (!offer) return `${hi}, merci pour vos visites chez ${c.place} !`;
        const visits = `${offer.visitDays} fois en ${offer.spanDays} jours`;
        const pace = `soit environ ${money(offer.projectedSpend)} par mois à ce rythme`;
        const verdict =
          offer.savings >= 1
            ? `vous économisez environ ${money(offer.savings)} et vous venez autant que vous voulez`
            : offer.savings > -1
              ? `c'est le même prix et vous venez autant que vous voulez`
              : `pour seulement ${money(-offer.savings)} de plus, vous venez tous les jours sans compter`;
        return `${hi}, vous êtes venu(e) ${visits} chez ${c.place} (${money(offer.spend)} en passes), ${pace}. Avec l'${offer.plan.name} à ${money(offer.plan.price)}, ${verdict}. On vous le prépare ?${debt}`;
      }
    }
  }

  /**
   * Regulars worth asking for a Google review: enough paid visits, came in the
   * last 2 weeks, never clicked the link and never asked before.
   */
  private async reviewCandidates(today: Date, minVisits: number) {
    const recent = await this.prisma.journal.findMany({
      where: {
        registredTime: { gte: subDays(today, 14) },
        isReservation: false,
        memberID: { not: null },
      },
      select: { memberID: true },
      distinct: ['memberID'],
    });
    const ids = recent.map((r) => r.memberID!);
    if (!ids.length) return [];
    const [counts, asked, clicked] = await Promise.all([
      this.prisma.journal.groupBy({
        by: ['memberID'],
        where: { memberID: { in: ids }, isPayed: true, isReservation: false },
        _count: true,
      }),
      this.prisma.memberOutreach.findMany({
        where: { memberId: { in: ids }, reason: 'REVIEW' },
        select: { memberId: true },
        distinct: ['memberId'],
      }),
      this.prisma.member.findMany({
        where: { id: { in: ids }, reviewClickedAt: { not: null } },
        select: { id: true },
      }),
    ]);
    const skip = new Set([...asked.map((a) => a.memberId), ...clicked.map((c) => c.id)]);
    return counts
      .filter((c) => c.memberID && !skip.has(c.memberID) && c._count >= minVisits)
      .map((c) => ({ memberId: c.memberID!, visits: c._count }));
  }

  /** Contacts of the last 30 days and what followed within 14 days. */
  private async results(today: Date) {
    const since = subDays(today, 30);
    const rows = await this.prisma.memberOutreach.findMany({
      where: { createdAt: { gte: since }, channel: { not: 'SKIP' }, campaignId: null },
      orderBy: { createdAt: 'asc' },
    });
    const first = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
      const k = `${r.memberId}:${r.reason}`;
      if (!first.has(k)) first.set(k, r);
    }
    const contacts = [...first.values()];
    const ids = [...new Set(contacts.map((c) => c.memberId))];
    if (!ids.length) {
      return {
        contacted: 0,
        won: 0,
        revenue: 0,
        byReason: {} as Record<string, { contacted: number; won: number; revenue: number }>,
        byChannel: {} as Record<string, { contacted: number; won: number; revenue: number }>,
      };
    }
    const clickedRows = await this.prisma.member.findMany({
      where: { id: { in: ids }, reviewClickedAt: { not: null } },
      select: { id: true, reviewClickedAt: true },
    });
    const reviewClicks = new Map(clickedRows.map((m) => [m.id, m.reviewClickedAt]));
    const [abos, visits, aboPayments] = await Promise.all([
      this.prisma.abonnement.findMany({
        where: { memberID: { in: ids }, createdAt: { gte: since } },
        select: { memberID: true, createdAt: true, payedAmount: true, amountDue: true },
      }),
      this.prisma.journal.findMany({
        where: { memberID: { in: ids }, registredTime: { gte: since }, isReservation: false },
        select: { memberID: true, registredTime: true, payedAmount: true, isPayed: true, paidAt: true },
      }),
      this.prisma.abonnementPayment.findMany({
        where: { abonnement: { memberID: { in: ids } }, paidAt: { gte: since } },
        select: { amount: true, paidAt: true, abonnement: { select: { memberID: true } } },
      }),
    ]);
    const inWindow = (d: Date | null | undefined, from: Date) =>
      !!d && d > from && d <= addDays(from, RESULT_WINDOW_DAYS);

    const byReason: Record<string, { contacted: number; won: number; revenue: number }> = {};
    const byChannel: Record<string, { contacted: number; won: number; revenue: number }> = {};
    let won = 0;
    let revenue = 0;
    for (const c of contacts) {
      const r = (byReason[c.reason] ??= { contacted: 0, won: 0, revenue: 0 });
      const ch = (byChannel[c.channel] ??= { contacted: 0, won: 0, revenue: 0 });
      r.contacted += 1;
      ch.contacted += 1;
      let gain = 0;
      let ok = false;
      if (VISIT_REASONS.has(c.reason)) {
        const back = visits.filter((v) => v.memberID === c.memberId && inWindow(v.registredTime, c.createdAt));
        ok = back.length > 0;
        gain = back.reduce((a, v) => a + (v.payedAmount || 0), 0);
      } else if (c.reason === 'REVIEW') {
        const at = reviewClicks.get(c.memberId);
        ok = inWindow(at, c.createdAt);
      } else if (c.reason === 'UNPAID') {
        const paidVisits = visits.filter(
          (v) => v.memberID === c.memberId && v.isPayed && inWindow(v.paidAt, c.createdAt) && v.registredTime < c.createdAt,
        );
        const paidAbos = aboPayments.filter(
          (p) => p.abonnement.memberID === c.memberId && inWindow(p.paidAt, c.createdAt),
        );
        gain =
          paidVisits.reduce((a, v) => a + (v.payedAmount || 0), 0) +
          paidAbos.reduce((a, p) => a + p.amount, 0);
        ok = gain > 0;
      } else {
        const sold = abos.filter((a) => a.memberID === c.memberId && inWindow(a.createdAt, c.createdAt));
        ok = sold.length > 0;
        gain = sold.reduce((a, s) => a + (s.amountDue ?? s.payedAmount ?? 0), 0);
      }
      if (ok) {
        r.won += 1;
        r.revenue = round1(r.revenue + gain);
        ch.won += 1;
        ch.revenue = round1(ch.revenue + gain);
        won += 1;
        revenue += gain;
      }
    }
    return { contacted: contacts.length, won, revenue: round1(revenue), byReason, byChannel };
  }

  async log(body: {
    memberId?: string;
    reason?: string;
    channel?: string;
    message?: string;
    /** "Relance passée": the day it was really done (yyyy-MM-dd, up to SUIVI_DAYS back) */
    contactedAt?: string | null;
  }) {
    const reason = body.reason as OutreachReason;
    const channel = body.channel as OutreachChannel;
    if (!body.memberId) throw new BadRequestException('memberId requis');
    if (!OUTREACH_REASONS.includes(reason)) throw new BadRequestException('Motif invalide');
    if (!OUTREACH_CHANNELS.includes(channel)) throw new BadRequestException('Canal invalide');
    const past = body.contactedAt ? this.pastDay(body.contactedAt) : null;
    if (past && channel === 'SKIP') throw new BadRequestException('Canal invalide');
    const row = await this.prisma.memberOutreach.create({
      data: {
        memberId: body.memberId,
        reason,
        channel,
        message: body.message?.slice(0, 2000) || null,
        ...(past ? { createdAt: past } : {}),
      },
    });
    if (channel !== 'SKIP') {
      if (past) {
        // A past relance only takes over older open ones, never a newer contact
        await this.prisma.memberOutreach.updateMany({
          where: {
            memberId: body.memberId,
            id: { not: row.id },
            closedAt: null,
            channel: { not: 'SKIP' },
            campaignId: null,
            createdAt: { lt: past },
          },
          data: { closedAt: new Date(), closedResult: 'REPLACED' },
        });
        // Abonnement already taken since that day → counted as converted right away
        await this.autoClose(startOfDay(new Date()));
      } else {
        await this.replaceOpen(body.memberId, row.id);
      }
    }
    return this.prisma.memberOutreach.findUniqueOrThrow({ where: { id: row.id } });
  }

  /** A day in the past (not today's future), at most SUIVI_DAYS ago. */
  private pastDay(input: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.slice(0, 10))) throw new BadRequestException('Date invalide');
    const day = parseLocalDay(input.slice(0, 10));
    const today = startOfDay(new Date());
    if (day > today) throw new BadRequestException('La date ne peut pas être dans le futur');
    if (differenceInCalendarDays(today, day) > SUIVI_DAYS) {
      throw new BadRequestException(`Au plus ${SUIVI_DAYS} jours en arrière`);
    }
    return day;
  }

  /** "Relance passée": the first abonnement this member took after that day, if any. */
  async pastCheck(memberId?: string, date?: string) {
    if (!memberId || !date) throw new BadRequestException('Membre et date requis');
    const day = this.pastDay(date);
    const abo = await this.prisma.abonnement.findFirst({
      where: { memberID: memberId, isReservation: false, hiddenAt: null, createdAt: { gt: day } },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true, amountDue: true, payedAmount: true, serviceName: true, price: { select: { name: true } } },
    });
    return {
      abonnement: abo
        ? {
            name: abo.serviceName || abo.price?.name || 'Abonnement',
            at: abo.createdAt!.toISOString(),
            amount: round1(abo.amountDue ?? abo.payedAmount ?? 0),
          }
        : null,
    };
  }

  /** One channel for several people at once (a WhatsApp status, a word to everyone at the desk…). */
  async logMany(body: { items?: Array<{ memberId?: string; reason?: string }>; channel?: string; message?: string }) {
    const items = Array.isArray(body.items) ? body.items.slice(0, 200) : [];
    if (!items.length) throw new BadRequestException('Choisissez au moins une personne');
    if (body.channel === 'SKIP') throw new BadRequestException('Canal invalide');
    const rows = [];
    for (const i of items) rows.push(await this.log({ ...i, channel: body.channel, message: body.message }));
    return { count: rows.length };
  }

  /** What to tell this member when they check in (empty when nothing is due). */
  async forMember(memberId: string, facilityId?: string) {
    const list = await this.list(facilityId);
    const items = list.todo.filter((i) => i.memberId === memberId && !i.snoozed);
    return { items };
  }

  /** One open Suivi per member: a newer contact takes over the older ones. */
  private replaceOpen(memberId: string, keepId: string) {
    return this.prisma.memberOutreach.updateMany({
      where: { memberId, id: { not: keepId }, closedAt: null, channel: { not: 'SKIP' }, campaignId: null },
      data: { closedAt: new Date(), closedResult: 'REPLACED' },
    });
  }

  /**
   * Staff mark a relance as handled: the member's answer, a note, the day to call back.
   * Fills the contact just logged (WhatsApp, push…) when there is one, else records a call.
   */
  async answer(body: {
    memberId?: string;
    reason?: string;
    outreachId?: string;
    outcome?: string;
    note?: string | null;
    followUpAt?: string | null;
    /** How they were reached; given = a new contact (e.g. in person at check-in) */
    channel?: string | null;
  }) {
    if (!body.memberId) throw new BadRequestException('memberId requis');
    if (body.channel && (!OUTREACH_CHANNELS.includes(body.channel as OutreachChannel) || body.channel === 'SKIP')) {
      throw new BadRequestException('Canal invalide');
    }
    const outcome = body.outcome as OutreachOutcome;
    if (!OUTREACH_OUTCOMES.includes(outcome)) throw new BadRequestException('Réponse invalide');
    const now = new Date();
    const lost = outcome === 'NOT_INTERESTED';
    const data = {
      outcome,
      note: body.note?.trim().slice(0, 500) || null,
      followUpAt: !lost && body.followUpAt ? parseLocalDay(body.followUpAt.slice(0, 10)) : null,
      closedAt: lost ? now : null,
      closedResult: lost ? 'LOST' : null,
      closedAuto: false,
    };
    const target = body.channel && !body.outreachId
      ? null
      : body.outreachId
      ? await this.prisma.memberOutreach.findFirst({ where: { id: body.outreachId, memberId: body.memberId } })
      : await this.prisma.memberOutreach.findFirst({
          where: {
            memberId: body.memberId,
            outcome: null,
            closedAt: null,
            campaignId: null,
            channel: { not: 'SKIP' },
            createdAt: { gte: subDays(startOfDay(now), 30) },
          },
          orderBy: { createdAt: 'desc' },
        });
    let row;
    if (target) {
      row = await this.prisma.memberOutreach.update({ where: { id: target.id }, data });
    } else {
      const reason = body.reason as OutreachReason;
      if (!OUTREACH_REASONS.includes(reason)) throw new BadRequestException('Motif invalide');
      row = await this.prisma.memberOutreach.create({
        data: { memberId: body.memberId, reason, channel: body.channel || 'CALL', ...data },
      });
    }
    await this.replaceOpen(body.memberId, row.id);
    return row;
  }

  /** Close a Suivi by hand: converted or not. */
  async close(id: string, result?: string) {
    if (result !== 'WON' && result !== 'LOST') throw new BadRequestException('Résultat invalide');
    return this.prisma.memberOutreach.update({
      where: { id },
      data: { closedAt: new Date(), closedResult: result, closedAuto: false },
    });
  }

  /** Undo a hand-made "Converti" / "Non converti": the relance goes back to the Suivi. */
  async reopen(id: string) {
    const row = await this.prisma.memberOutreach.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Relance introuvable');
    if (!row.closedAt || row.closedResult === 'REPLACED') throw new BadRequestException("Cette relance n'est pas clôturée");
    if (row.closedAuto) {
      throw new BadRequestException('Clôturée toute seule (abonnement ou paiement enregistré) : rien à annuler');
    }
    const reopened = await this.prisma.memberOutreach.update({
      where: { id },
      data: { closedAt: null, closedResult: null, closedAuto: false },
    });
    await this.replaceOpen(row.memberId, id);
    return reopened;
  }

  /** Open relances close themselves when the member takes an abonnement (or pays, for impayés). */
  private async autoClose(today: Date) {
    const open = await this.prisma.memberOutreach.findMany({
      where: {
        closedAt: null,
        campaignId: null,
        channel: { not: 'SKIP' },
        createdAt: { gte: subDays(today, SUIVI_DAYS) },
      },
      select: { id: true, memberId: true, reason: true, createdAt: true },
    });
    if (!open.length) return;
    const ids = [...new Set(open.map((o) => o.memberId))];
    const since = open.reduce((a, o) => (o.createdAt < a ? o.createdAt : a), open[0].createdAt);
    const [abos, aboPayments, paidVisits] = await Promise.all([
      this.prisma.abonnement.findMany({
        where: { memberID: { in: ids }, isReservation: false, createdAt: { gt: since } },
        select: { memberID: true, createdAt: true },
      }),
      this.prisma.abonnementPayment.findMany({
        where: { abonnement: { memberID: { in: ids } }, paidAt: { gt: since } },
        select: { paidAt: true, abonnement: { select: { memberID: true } } },
      }),
      this.prisma.journal.findMany({
        where: { memberID: { in: ids }, isPayed: true, paidAt: { gt: since } },
        select: { memberID: true, paidAt: true, registredTime: true },
      }),
    ]);
    const won = open.filter((o) => {
      if (abos.some((a) => a.memberID === o.memberId && a.createdAt > o.createdAt)) return true;
      if (o.reason !== 'UNPAID') return false;
      return (
        aboPayments.some((p) => p.abonnement.memberID === o.memberId && p.paidAt > o.createdAt) ||
        paidVisits.some(
          (v) => v.memberID === o.memberId && v.paidAt! > o.createdAt && v.registredTime < o.createdAt,
        )
      );
    });
    if (won.length) {
      await this.prisma.memberOutreach.updateMany({
        where: { id: { in: won.map((w) => w.id) } },
        data: { closedAt: new Date(), closedResult: 'WON', closedAuto: true },
      });
    }
  }

  /**
   * Suivi tab: one row per contacted member (latest contact), with what happened since —
   * abonnement taken, visits at the tarif, payment. OPEN = waiting, CLOSED = converted or not.
   */
  async suivi(opts: { status?: string; page?: number; perPage?: number }) {
    const now = new Date();
    const today = startOfDay(now);
    await this.autoClose(today);
    const rows = await this.prisma.memberOutreach.findMany({
      where: {
        campaignId: null,
        channel: { not: 'SKIP' },
        createdAt: { gte: subDays(today, SUIVI_DAYS) },
        OR: [{ closedResult: null }, { closedResult: { not: 'REPLACED' } }],
      },
      orderBy: { createdAt: 'desc' },
    });
    const latest = new Map<string, (typeof rows)[number]>();
    for (const r of rows) if (!latest.has(r.memberId)) latest.set(r.memberId, r);
    const isOpen = (r: (typeof rows)[number]) =>
      !r.closedAt &&
      (!!r.outcome ||
        differenceInCalendarDays(today, r.createdAt) < (SNOOZE_DAYS[r.reason as OutreachReason] ?? 7));
    const isDue = (r: (typeof rows)[number]) => !!r.followUpAt && r.followUpAt <= endOfDay(today);
    const open = [...latest.values()]
      .filter(isOpen)
      .sort(
        (a, b) =>
          Number(isDue(b)) - Number(isDue(a)) ||
          (a.followUpAt?.getTime() ?? Infinity) - (b.followUpAt?.getTime() ?? Infinity) ||
          b.createdAt.getTime() - a.createdAt.getTime(),
      );
    const closed = [...latest.values()]
      .filter((r) => r.closedAt && (r.closedResult === 'WON' || r.closedResult === 'LOST'))
      .sort((a, b) => b.closedAt!.getTime() - a.closedAt!.getTime());
    const status = opts.status === 'CLOSED' ? 'CLOSED' : 'OPEN';
    const list = status === 'OPEN' ? open : closed;
    const perPage = Math.min(100, Math.max(5, opts.perPage || 20));
    const lastPage = Math.max(1, Math.ceil(list.length / perPage));
    const page = Math.min(lastPage, Math.max(1, opts.page || 1));
    const slice = list.slice((page - 1) * perPage, page * perPage);
    const ids = slice.map((r) => r.memberId);
    const since = slice.reduce<Date>((a, r) => (r.createdAt < a ? r.createdAt : a), now);

    const [people, abos, visits] = await Promise.all([
      this.prisma.member.findMany({
        where: { id: { in: ids } },
        select: { id: true, firstName: true, lastName: true, phone: true },
      }),
      this.prisma.abonnement.findMany({
        where: { memberID: { in: ids }, isReservation: false, hiddenAt: null },
        select: {
          memberID: true,
          createdAt: true,
          registredDate: true,
          priceId: true,
          serviceName: true,
          price: { select: { name: true } },
        },
        orderBy: { registredDate: 'asc' },
      }),
      this.prisma.journal.findMany({
        where: { memberID: { in: ids }, isReservation: false, registredTime: { gt: since } },
        select: { memberID: true, registredTime: true, payedAmount: true },
      }),
    ]);
    const person = new Map(people.map((p) => [p.id, p]));
    const won = closed.filter((r) => r.closedResult === 'WON').length;
    return {
      rows: slice.map((r) => {
        const p = person.get(r.memberId);
        const until = r.closedAt ?? now;
        const myAbos = abos.filter((a) => a.memberID === r.memberId);
        const abo = myAbos.find((a) => !!a.createdAt && a.createdAt > r.createdAt && a.createdAt <= until);
        // The abonnement it renews (any offer counts as a renewal)
        const before = abo ? [...myAbos].reverse().find((a) => a.registredDate < abo.registredDate) : undefined;
        const aboName = (a: (typeof abos)[number]) => a.serviceName || a.price?.name || 'Abonnement';
        const mine = visits.filter(
          (v) => v.memberID === r.memberId && v.registredTime > r.createdAt && v.registredTime <= until,
        );
        const lastVisit = mine.reduce<Date | null>((a, v) => (!a || v.registredTime > a ? v.registredTime : a), null);
        return {
          id: r.id,
          memberId: r.memberId,
          name: [p?.firstName, p?.lastName].filter(Boolean).join(' ') || 'Client',
          firstName: p?.firstName?.trim() || '',
          phone: p?.phone ?? null,
          whatsapp: whatsappNumber(p?.phone),
          reason: r.reason,
          channel: r.channel,
          outcome: r.outcome,
          note: r.note,
          contactedAt: r.createdAt.toISOString(),
          followUpAt: r.followUpAt?.toISOString() ?? null,
          due: !r.closedAt && isDue(r),
          closedAt: r.closedAt?.toISOString() ?? null,
          closedResult: r.closedResult,
          closedAuto: r.closedAuto,
          since: {
            abonnement: abo
              ? {
                  name: aboName(abo),
                  at: abo.createdAt!.toISOString(),
                  previousName: before ? aboName(before) : null,
                  otherOffer: !!before && before.priceId !== abo.priceId,
                }
              : null,
            visits: mine.length,
            spent: round1(mine.reduce((a, v) => a + (v.payedAmount || 0), 0)),
            lastVisit: lastVisit?.toISOString() ?? null,
          },
        };
      }),
      counts: {
        OPEN: open.length,
        CLOSED: closed.length,
        due: open.filter(isDue).length,
        won,
      },
      meta: { currentPage: page, lastPage, perPage, total: list.length },
    };
  }

  async sendPush(body: { memberId?: string; reason?: string; message?: string; title?: string }) {
    if (!body.memberId || !body.message?.trim()) {
      throw new BadRequestException('Membre et message requis');
    }
    if (!this.push.isEnabled()) {
      throw new BadRequestException('Notifications push non configurées sur le serveur');
    }
    const subs = await this.prisma.pushSubscription.count({ where: { memberId: body.memberId } });
    if (!subs) throw new BadRequestException("Ce client n'a pas activé les notifications");
    const reason = body.reason as OutreachReason;
    await this.push.sendToMember(body.memberId, {
      title:
        body.title ||
        (reason === 'UNPAID'
          ? 'Petit rappel'
          : reason === 'CONVERT' || reason === 'TOP_UP'
            ? 'Une offre pour vous'
            : reason === 'REVIEW'
              ? 'Votre avis compte'
              : 'On pense à vous'),
      body: body.message.trim(),
      tag: `outreach-${reason || 'msg'}`,
      url: '/m',
    });
    return this.log({ ...body, channel: 'PUSH' });
  }
}
