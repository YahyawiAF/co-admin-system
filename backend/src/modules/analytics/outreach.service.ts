import { BadRequestException, Injectable } from '@nestjs/common';
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
import { localDayKey } from '../../../common/parse-local-day';
import { PerformanceService } from './performance.service';
import { computeOffers, type AbonnementOffer } from './offers';
import { round1 } from './traffic';

export const OUTREACH_REASONS = [
  'ABO_EXPIRING',
  'ABO_ENDED',
  'UNPAID',
  'INACTIVE',
  'CONVERT',
  'REVIEW',
] as const;
export type OutreachReason = (typeof OUTREACH_REASONS)[number];
export const OUTREACH_CHANNELS = ['WHATSAPP', 'PUSH', 'CALL', 'SKIP'] as const;
export type OutreachChannel = (typeof OUTREACH_CHANNELS)[number];

/** Days a contact keeps the member out of the to-do list for the same reason. */
const SNOOZE_DAYS: Record<OutreachReason, number> = {
  ABO_EXPIRING: 3,
  ABO_ENDED: 7,
  UNPAID: 5,
  INACTIVE: 10,
  CONVERT: 14,
  REVIEW: 30,
};
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
  lastContact: { at: string; channel: string; reason: string } | null;
  snoozed: boolean;
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
    const settings = await this.performance.settings(facilityId);
    const facility = await this.prisma.facility.findUnique({
      where: { id: settings.facilityId },
      select: { name: true },
    });
    const place = facility?.name || 'notre espace';
    const reviewUrl = settings.googleReviewUrl;

    const quietSince = subDays(today, settings.inactiveAlertDays);
    const [abos, owed, offers, regularVisits] = await Promise.all([
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
    ]);

    const drafts = new Map<string, Omit<OutreachItem, 'name' | 'firstName' | 'phone' | 'whatsapp' | 'hasPush' | 'message' | 'lastContact' | 'snoozed'> & { ctx: Record<string, string> }>();
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
      if (r.recent || r.days.size < minDays) continue;
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

    for (const offer of offers.values()) {
      add({
        memberId: offer.memberId,
        reason: 'CONVERT',
        title: `${money(offer.spend)} en passes · ${offer.visitDays} jours`,
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

    const ids = [...drafts.keys()];
    const [people, pushRows, contacts] = await Promise.all([
      this.prisma.member.findMany({
        where: { id: { in: ids } },
        select: { id: true, firstName: true, lastName: true, phone: true },
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
      const snoozed =
        !!sameReason &&
        differenceInCalendarDays(today, sameReason.createdAt) < SNOOZE_DAYS[d.reason];
      const { ctx, ...rest } = d;
      items.push({
        ...rest,
        owed: owedNow,
        name: [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Client',
        firstName,
        phone: p.phone,
        whatsapp: whatsappNumber(p.phone),
        hasPush: pushEnabled && withPush.has(d.memberId),
        message: this.message(d.reason, { ...ctx, firstName, place, owed: owedNow }, d.offer),
        lastContact: last
          ? { at: last.createdAt.toISOString(), channel: last.channel, reason: last.reason }
          : null,
        snoozed,
      });
    }
    items.sort(
      (a, b) =>
        OUTREACH_REASONS.indexOf(a.reason) - OUTREACH_REASONS.indexOf(b.reason) ||
        b.value - a.value,
    );

    return {
      generatedAt: now.toISOString(),
      pushEnabled,
      todo: items.filter((i) => !i.snoozed),
      contacted: items.filter((i) => i.snoozed),
      results: await this.results(today),
    };
  }

  private message(
    reason: OutreachReason,
    c: { [k: string]: string | number; firstName: string; place: string; owed: number },
    offer?: AbonnementOffer,
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
      case 'INACTIVE':
        return `${hi}, ça fait ${c.days} jours qu'on ne vous a pas vu chez ${c.place} ! Votre place vous attend, à bientôt.${debt}`;
      case 'REVIEW':
        return `${hi}, merci pour vos ${c.visits} visites chez ${c.place} ! Si vous aimez l'espace, un petit avis Google nous aiderait énormément (30 secondes) : ${c.url}`;
      case 'CONVERT': {
        if (!offer) return `${hi}, merci pour vos visites chez ${c.place} !`;
        const gain =
          offer.savings >= 1
            ? ` et vous économisez environ ${money(offer.savings)}`
            : '';
        return `${hi}, ces dernières semaines vous avez payé ${money(offer.spend)} en passes chez ${c.place}. Avec l'${offer.plan.name} à ${money(offer.plan.price)}, vous venez autant que vous voulez${gain}. On vous le prépare ?${debt}`;
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
      where: { createdAt: { gte: since }, channel: { not: 'SKIP' } },
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
      return { contacted: 0, won: 0, revenue: 0, byReason: {} as Record<string, { contacted: number; won: number; revenue: number }> };
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
    let won = 0;
    let revenue = 0;
    for (const c of contacts) {
      const r = (byReason[c.reason] ??= { contacted: 0, won: 0, revenue: 0 });
      r.contacted += 1;
      let gain = 0;
      let ok = false;
      if (c.reason === 'INACTIVE') {
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
        won += 1;
        revenue += gain;
      }
    }
    return { contacted: contacts.length, won, revenue: round1(revenue), byReason };
  }

  async log(body: { memberId?: string; reason?: string; channel?: string; message?: string }) {
    const reason = body.reason as OutreachReason;
    const channel = body.channel as OutreachChannel;
    if (!body.memberId) throw new BadRequestException('memberId requis');
    if (!OUTREACH_REASONS.includes(reason)) throw new BadRequestException('Motif invalide');
    if (!OUTREACH_CHANNELS.includes(channel)) throw new BadRequestException('Canal invalide');
    return this.prisma.memberOutreach.create({
      data: {
        memberId: body.memberId,
        reason,
        channel,
        message: body.message?.slice(0, 2000) || null,
      },
    });
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
          : reason === 'CONVERT'
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
