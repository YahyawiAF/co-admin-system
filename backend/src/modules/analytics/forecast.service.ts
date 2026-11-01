import { BadRequestException, Injectable } from '@nestjs/common';
import { addDays, endOfDay, endOfMonth, format, getDaysInMonth, startOfDay, startOfMonth, startOfWeek, subDays, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PrismaService } from 'database/prisma.service';
import { localDayKey } from '../../../common/parse-local-day';
import { orderUnitPrice } from '../product/order-price';
import {
  buildForecast,
  detectChanges,
  evaluateLevers,
  type ActionRecord,
  type DayFact,
  type DetectedChange,
  type Totals,
} from '../../business-manager-core';
import { PerformanceService } from './performance.service';
import { NewcomersService } from './newcomers.service';
import { OutreachService } from './outreach.service';
import { coworkingLevers, type CoworkingFacts } from './levers-coworking';

const DAY_MS = 86_400_000;
const r1 = (n: number) => Math.round(n * 10) / 10;
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);

/** Answers to « qu'est-ce qui a changé ? » */
export const CHANGE_CAUSES = {
  up: [
    { code: 'SOCIAL', label: 'Publications sur les réseaux' },
    { code: 'EVENT', label: 'Un événement' },
    { code: 'WORD', label: 'Bouche-à-oreille' },
    { code: 'EXAMS', label: "Période d'examens" },
    { code: 'PARTNER', label: 'Partenaire (fac, lycée…)' },
    { code: 'PROMO', label: 'Une promotion' },
    { code: 'UNKNOWN', label: 'Je ne sais pas' },
  ],
  down: [
    { code: 'EXAMS', label: 'Ils révisent chez eux / examens finis' },
    { code: 'HOLIDAY', label: 'Vacances ou jour férié' },
    { code: 'WEATHER', label: 'Météo' },
    { code: 'PRICE', label: 'Prix' },
    { code: 'COMPETITOR', label: 'Un concurrent' },
    { code: 'CLOSED', label: "J'ai moins ouvert" },
    { code: 'UNKNOWN', label: 'Je ne sais pas' },
  ],
} as const;

/** A rise with one of these causes becomes an action, so it gets measured and suggested again. */
const CAUSE_ACTION: Record<string, { title: string; category: string; channels: string[] }> = {
  SOCIAL: { title: 'Publications sur les réseaux', category: 'ACQUISITION', channels: ['INSTAGRAM_POST', 'INSTAGRAM_STORY'] },
  EVENT: { title: 'Événement', category: 'ACQUISITION', channels: [] },
  WORD: { title: 'Bouche-à-oreille', category: 'ACQUISITION', channels: ['WALK_IN'] },
  PARTNER: { title: 'Partenariat (fac, lycée…)', category: 'ACQUISITION', channels: ['PARTNER'] },
  PROMO: { title: 'Promotion', category: 'PROMO', channels: [] },
};

const METRIC_LABEL: Record<string, string> = { newVisitors: 'Nouveaux visiteurs', visits: 'Visites' };

/** Forecast of the month, the « why the gap » split, unexplained changes and the lever map. */
@Injectable()
export class ForecastService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly performance: PerformanceService,
    private readonly newcomers: NewcomersService,
    private readonly outreach: OutreachService,
  ) {}

  // ---------- daily facts ----------

  /** One row per calendar day in [from, to], same money rules as the Finance overview. */
  async dayFacts(from: Date, to: Date): Promise<DayFact[]> {
    const start = startOfDay(from);
    const end = endOfDay(to);
    const [paid, visits, firsts, subs, products] = await Promise.all([
      this.prisma.journal.findMany({
        where: { registredTime: { gte: start, lte: end }, isPayed: true },
        select: { registredTime: true, payedAmount: true },
      }),
      this.prisma.journal.findMany({
        where: { registredTime: { gte: start, lte: end }, isReservation: false },
        select: { registredTime: true },
      }),
      this.prisma.journal.groupBy({
        by: ['memberID'],
        where: { memberID: { not: null }, isReservation: false, hiddenAt: null },
        _min: { registredTime: true },
      }),
      this.prisma.abonnementPayment.findMany({
        where: { paidAt: { gte: start, lte: end } },
        select: { paidAt: true, amount: true },
      }),
      this.prisma.dailyProduct.findMany({
        where: { date: { gte: start, lte: end }, status: { notIn: ['PENDING', 'CANCELLED'] } },
        select: { date: true, quantite: true, unitPrice: true, product: { select: { sellingPrice: true } } },
      }),
    ]);

    const rows = new Map<string, DayFact>();
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const key = localDayKey(d);
      rows.set(key, { key, weekday: d.getDay(), revenueVisits: 0, visits: 0, newVisitors: 0, products: 0, subscriptions: 0 });
    }
    const at = (d: Date | null) => (d ? rows.get(localDayKey(d)) : undefined);
    for (const j of paid) {
      const r = at(j.registredTime);
      if (r) r.revenueVisits += j.payedAmount || 0;
    }
    for (const v of visits) {
      const r = at(v.registredTime);
      if (r) r.visits += 1;
    }
    for (const f of firsts) {
      const first = f._min.registredTime;
      if (!first || first < start || first > end) continue;
      const r = at(first);
      if (r) r.newVisitors += 1;
    }
    for (const p of subs) {
      const r = at(p.paidAt);
      if (r) r.subscriptions += p.amount;
    }
    for (const p of products) {
      const r = at(p.date);
      if (r) r.products += orderUnitPrice(p) * p.quantite;
    }
    return [...rows.values()].map((r) => ({
      ...r,
      revenueVisits: r1(r.revenueVisits),
      products: r1(r.products),
      subscriptions: r1(r.subscriptions),
    }));
  }

  private totals(days: DayFact[]): Totals {
    const s = (f: (d: DayFact) => number) => r1(days.reduce((a, d) => a + f(d), 0));
    return {
      revenueVisits: s((d) => d.revenueVisits),
      visits: s((d) => d.visits),
      newVisitors: s((d) => d.newVisitors),
      products: s((d) => d.products),
      subscriptions: s((d) => d.subscriptions),
    };
  }

  // ---------- subscriptions expected ----------

  /**
   * Abonnements ending in the month (latest per member, not terminated) × last
   * month's renewal rate, plus new subscribers at the pace of the 4 weeks before.
   */
  async subscriptionsOutlook(monthStart: Date) {
    const monthEnd = endOfMonth(monthStart);
    const prevStart = startOfMonth(subMonths(monthStart, 1));
    const prevEnd = endOfMonth(prevStart);
    const abos = await this.prisma.abonnement.findMany({
      where: { isReservation: false, hiddenAt: null },
      select: { id: true, memberID: true, registredDate: true, leaveDate: true, payedAmount: true, listPrice: true, terminatedAt: true },
      orderBy: { registredDate: 'asc' },
    });
    const byMember = new Map<string, typeof abos>();
    for (const a of abos) byMember.set(a.memberID, [...(byMember.get(a.memberID) ?? []), a]);
    const price = (a: (typeof abos)[number]) => a.listPrice ?? a.payedAmount ?? 0;
    const renewed = (a: (typeof abos)[number]) =>
      (byMember.get(a.memberID) ?? []).some(
        (b) =>
          b.id !== a.id &&
          a.leaveDate != null &&
          b.registredDate.getTime() >= a.leaveDate.getTime() - 7 * DAY_MS &&
          b.registredDate.getTime() <= a.leaveDate.getTime() + 14 * DAY_MS,
      );
    const latest = (a: (typeof abos)[number]) => {
      const list = byMember.get(a.memberID) ?? [];
      return !list.some((b) => b.id !== a.id && b.registredDate > a.registredDate);
    };

    const endedPrev = abos.filter((a) => a.leaveDate && a.leaveDate >= prevStart && a.leaveDate <= prevEnd && !a.terminatedAt);
    const renewalRatePct = endedPrev.length >= 3 ? pct(endedPrev.filter(renewed).length, endedPrev.length) : null;
    const ending = abos.filter((a) => a.leaveDate && a.leaveDate >= monthStart && a.leaveDate <= monthEnd && !a.terminatedAt && latest(a));
    const endingValue = r1(ending.reduce((s, a) => s + price(a), 0));

    // First abonnement of a member, started in the 28 days before the month
    const baseFrom = subDays(monthStart, 28);
    const firstAbos = abos.filter((a) => {
      const list = byMember.get(a.memberID) ?? [];
      return list[0]?.id === a.id && a.registredDate >= baseFrom && a.registredDate < monthStart;
    });
    const newPace = r1((firstAbos.reduce((s, a) => s + price(a), 0) / 28) * getDaysInMonth(monthStart));
    const rate = renewalRatePct ?? 40;
    const renewals = r1((endingValue * rate) / 100);
    const avgPrice = abos.length ? r1(abos.slice(-30).reduce((s, a) => s + price(a), 0) / Math.min(30, abos.length)) : 0;
    return {
      expected: r1(renewals + newPace),
      endingCount: ending.length,
      endingValue,
      renewalRatePct,
      renewalRateAssumed: renewalRatePct == null,
      renewals,
      newPace,
      newCount: firstAbos.length,
      avgPrice,
    };
  }

  // ---------- forecast ----------

  async forecast(opts: { year?: number; month?: number }) {
    const now = new Date();
    const year = opts.year || now.getFullYear();
    const month = opts.month || now.getMonth() + 1;
    if (month < 1 || month > 12) throw new BadRequestException('Mois invalide');
    const start = startOfMonth(new Date(year, month - 1, 1));
    const end = endOfMonth(start);
    const isCurrent = now >= start && now <= end;
    const isFuture = start > now;
    const baseFrom = subDays(start, 28);
    const baseTo = subDays(start, 1);
    const prevStart = startOfMonth(subMonths(start, 1));

    const [base, actual, previous, subs] = await Promise.all([
      this.dayFacts(baseFrom, baseTo),
      isFuture ? Promise.resolve([] as DayFact[]) : this.dayFacts(start, isCurrent ? now : end),
      this.dayFacts(prevStart, endOfMonth(prevStart)),
      this.subscriptionsOutlook(start),
    ]);
    const monthDays = Array.from({ length: getDaysInMonth(start) }, (_, i) => {
      const d = addDays(start, i);
      return { key: localDayKey(d), weekday: d.getDay() };
    });
    const f = buildForecast({
      base,
      month: monthDays,
      actual,
      todayKey: isCurrent ? localDayKey(now) : isFuture ? localDayKey(start) : null,
      subscriptionsExpected: subs.expected,
      previousMonth: this.totals(previous),
    });
    return {
      period: {
        year,
        month,
        label: format(start, 'MMMM yyyy', { locale: fr }),
        previousLabel: format(prevStart, 'MMMM', { locale: fr }),
        isCurrent,
        isFuture,
        base: { from: localDayKey(baseFrom), to: localDayKey(baseTo) },
      },
      subscriptions: subs,
      ...f,
    };
  }

  // ---------- unexplained changes ----------

  private changeKey(c: DetectedChange) {
    const week = localDayKey(startOfWeek(new Date(`${c.to}T12:00:00`), { weekStartsOn: 1 }));
    return `change:${c.metric}:${c.direction}:${week}`;
  }

  /** Big moves of the last 7 complete days that no action, period or answer explains. */
  async changes(facilityId?: string) {
    const s = await this.performance.settings(facilityId);
    const yesterday = subDays(startOfDay(new Date()), 1);
    const days = await this.dayFacts(subDays(yesterday, 34), yesterday);
    const found = detectChanges(days);
    if (!found.length) return { changes: [] };

    const [actions, facts, answers] = await Promise.all([
      this.prisma.businessInitiative.findMany({
        where: { facilityId: s.facilityId },
        select: { title: true, startDate: true, endDate: true },
      }),
      this.prisma.advisorFact.findMany({
        where: { facilityId: s.facilityId, kind: { in: ['HOLIDAY', 'PERIOD', 'LOCAL_EVENT'] } },
        select: { title: true, startDate: true, endDate: true },
      }),
      this.prisma.businessAnswer.findMany({
        where: { facilityId: s.facilityId, key: { startsWith: 'change:' } },
        select: { key: true, label: true, answeredAt: true },
      }),
    ]);

    const out = found.map((c) => {
      const from = new Date(`${c.from}T00:00:00`);
      const to = new Date(`${c.to}T23:59:59`);
      const key = this.changeKey(c);
      const action = actions.find(
        (a) => a.startDate <= to && a.startDate.getTime() >= from.getTime() - 14 * DAY_MS && (!a.endDate || a.endDate >= from),
      );
      const period = facts.find((p) => p.startDate && p.startDate <= to && (p.endDate ?? p.startDate) >= from);
      const prefix = `change:${c.metric}:${c.direction}:`;
      const answer = answers.find((a) => a.key === key || (a.key.startsWith(prefix) && a.answeredAt.getTime() > Date.now() - 10 * DAY_MS));
      return {
        ...c,
        key,
        label: METRIC_LABEL[c.metric],
        explainedBy: action ? `Action : ${action.title}` : period ? `Période : ${period.title}` : answer ? `Ta réponse : ${answer.label}` : null,
        causes: CHANGE_CAUSES[c.direction],
      };
    });
    return { changes: out };
  }

  /** The owner says what changed. A rise with a known cause becomes a measured action. */
  async answerChange(
    facilityId: string | undefined,
    body: { metric?: string; direction?: string; from?: string; to?: string; cause?: string; note?: string },
  ) {
    const s = await this.performance.settings(facilityId);
    const direction = body.direction === 'down' ? 'down' : 'up';
    const cause = CHANGE_CAUSES[direction].find((c) => c.code === body.cause);
    if (!cause) throw new BadRequestException('Réponse invalide');
    if (body.metric !== 'newVisitors' && body.metric !== 'visits') throw new BadRequestException('Chiffre invalide');
    if (!body.from || !body.to || !/^\d{4}-\d{2}-\d{2}$/.test(body.from) || !/^\d{4}-\d{2}-\d{2}$/.test(body.to)) {
      throw new BadRequestException('Dates invalides');
    }
    const change = { metric: body.metric, direction, from: body.from, to: body.to } as DetectedChange;
    const key = this.changeKey(change);
    const note = body.note?.trim().slice(0, 300) || null;
    await this.prisma.businessAnswer.upsert({
      where: { facilityId_key: { facilityId: s.facilityId, key } },
      create: { facilityId: s.facilityId, key, label: cause.label, note, unknown: cause.code === 'UNKNOWN' },
      update: { label: cause.label, note, unknown: cause.code === 'UNKNOWN', answeredAt: new Date() },
    });

    const act = direction === 'up' ? CAUSE_ACTION[cause.code] : undefined;
    let initiativeId: string | null = null;
    if (act) {
      const created = await this.prisma.businessInitiative.create({
        data: {
          facilityId: s.facilityId,
          title: act.title,
          description: note,
          category: act.category,
          startDate: new Date(`${body.from}T00:00:00`),
          recommendationTitle: `Hausse : ${METRIC_LABEL[body.metric].toLowerCase()} du ${body.from} au ${body.to}`,
          metric: body.metric === 'newVisitors' ? 'newMembers' : 'visitsPerDay',
          objective: 'TICKETS',
          hypothesis: `${METRIC_LABEL[body.metric]} en hausse après : ${cause.label.toLowerCase()}`,
          channels: act.channels,
        },
      });
      initiativeId = created.id;
    }
    return { ok: true, key, initiativeId };
  }

  /** New visitors per week by « Comment tu nous as connus ? » (oldest week first). */
  async newcomersBySource(weeks = 8) {
    const now = new Date();
    const first = startOfWeek(subDays(now, (weeks - 1) * 7), { weekStartsOn: 1 });
    const list = (await this.newcomers.newcomers(now)).filter((n) => n.first >= first);
    return Array.from({ length: weeks }, (_, i) => {
      const from = addDays(first, i * 7);
      const to = addDays(from, 7);
      const rows = list.filter((n) => n.first >= from && n.first < to);
      const bySource: Record<string, number> = {};
      for (const n of rows) {
        const k = n.heardFrom || 'NOT_ASKED';
        bySource[k] = (bySource[k] ?? 0) + 1;
      }
      return { weekOf: localDayKey(from), total: rows.length, bySource };
    });
  }

  // ---------- lever map ----------

  async facts(facilityId: string, settings: Awaited<ReturnType<PerformanceService['settings']>>): Promise<CoworkingFacts> {
    const now = new Date();
    const d30 = subDays(now, 30);
    const d60 = subDays(now, 60);
    const [days, newcomers, list, subs, events, nextEvent, referrals, reviewClicks, cafeOrders, base] = await Promise.all([
      this.dayFacts(subDays(startOfDay(now), 29), now),
      this.newcomers.newcomers(now),
      this.outreach.list(facilityId).catch(() => null),
      this.subscriptionsOutlook(startOfMonth(now)),
      this.prisma.event.findMany({
        where: { facilityId, startAt: { gte: d60, lte: now }, status: { not: 'DRAFT' } },
        select: { price: true },
      }),
      this.prisma.event.findFirst({
        where: { facilityId, startAt: { gt: now, lte: addDays(now, 30) }, status: { not: 'DRAFT' } },
        select: { title: true, startAt: true },
        orderBy: { startAt: 'asc' },
      }),
      this.prisma.member.count({ where: { referredById: { not: null }, createdAt: { gte: d60 } } }),
      this.prisma.member.count({ where: { reviewClickedAt: { gte: d60 } } }),
      this.prisma.dailyProduct.count({ where: { date: { gte: d30 }, status: { notIn: ['PENDING', 'CANCELLED'] } } }),
      this.dayFacts(subDays(startOfDay(now), 28), subDays(startOfDay(now), 1)),
    ]);
    const t = this.totals(days);
    const recent = newcomers.filter((n) => n.first >= d30);
    const judged = newcomers.filter((n) => n.judged && n.first >= d60);
    const withApp = judged.filter((n) => n.hasApp);
    const withoutApp = judged.filter((n) => !n.hasApp);
    const profiled = newcomers.filter((n) => n.first >= subDays(now, 90) && n.profileType);
    const heardFrom: Record<string, number> = {};
    for (const n of newcomers) if (n.first >= subDays(now, 90) && n.heardFrom) heardFrom[n.heardFrom] = (heardFrom[n.heardFrom] ?? 0) + 1;
    const lists: Record<string, number> = {};
    for (const i of list?.todo ?? []) lists[i.reason] = (lists[i.reason] ?? 0) + 1;
    const mature = newcomers.filter((n) => n.first <= d30 && n.first >= subDays(now, 120));
    const weekdayRevenue = Array.from({ length: 7 }, (_, wd) => {
      const rows = base.filter((d) => d.weekday === wd);
      return rows.length ? r1(rows.reduce((a, d) => a + d.revenueVisits + d.products, 0) / rows.length) : 0;
    });

    return {
      visits30: t.visits,
      ticket: t.visits ? r1(t.revenueVisits / t.visits) : 0,
      new30: recent.length,
      visitsPerNewcomer: mature.length ? r1(mature.reduce((a, n) => a + n.visitDays, 0) / mature.length) : 1,
      returnRatePct: judged.length >= 10 ? pct(judged.filter((n) => n.back).length, judged.length) : null,
      returnWithAppPct: withApp.length >= 5 ? pct(withApp.filter((n) => n.back).length, withApp.length) : null,
      returnWithoutAppPct: withoutApp.length >= 5 ? pct(withoutApp.filter((n) => n.back).length, withoutApp.length) : null,
      installDay1Pct: recent.length >= 10 ? pct(recent.filter((n) => n.appDay1).length, recent.length) : null,
      profileKnown: profiled.length,
      studentSharePct: profiled.length ? pct(profiled.filter((n) => n.profileType === 'STUDENT' || n.profileType === 'PUPIL').length, profiled.length) : null,
      heardFrom,
      lists,
      aboEndingCount: subs.endingCount,
      aboEndingValue: subs.endingValue,
      renewalRatePct: subs.renewalRatePct,
      avgAboPrice: subs.avgPrice,
      events60: events.length,
      paidEvents60: events.filter((e) => (e.price ?? 0) > 0).length,
      nextEvent: nextEvent ? { title: nextEvent.title, date: format(nextEvent.startAt, 'd MMM', { locale: fr }) } : null,
      referralPoints: settings.referralPoints,
      referrals60: referrals,
      googleReviewUrl: !!settings.googleReviewUrl,
      reviewClicks60: reviewClicks,
      cafeOrders30: cafeOrders,
      cafeRevenue30: t.products,
      weekdayRevenue,
    };
  }

  async levers(facilityId?: string) {
    const s = await this.performance.settings(facilityId);
    const now = new Date();
    const d30 = subDays(now, 30);
    const [facts, initiatives, contacts, campaigns, dismissals] = await Promise.all([
      this.facts(s.facilityId, s),
      this.prisma.businessInitiative.findMany({
        where: { facilityId: s.facilityId },
        select: { id: true, title: true, category: true, objective: true, channels: true, startDate: true, endDate: true, ownerVerdict: true, linkedKind: true, targetDays: true },
      }),
      this.prisma.memberOutreach.groupBy({ by: ['reason'], where: { createdAt: { gte: d30 } }, _count: { _all: true } }),
      this.prisma.outreachCampaign.findMany({
        where: { facilityId: s.facilityId, createdAt: { gte: d30 } },
        select: { segment: true, memberIds: true },
      }),
      this.prisma.advisorDismissal.findMany({
        where: { facilityId: s.facilityId },
        select: { leverId: true, title: true, reason: true },
      }),
    ]);
    const actions: ActionRecord[] = initiatives.map((i) => ({
      id: i.id,
      title: i.title,
      category: i.category,
      objective: i.objective,
      channels: i.channels,
      startDate: i.startDate,
      endDate: i.endDate,
      verdict: i.ownerVerdict,
      linkedKind: i.linkedKind,
      targetDays: i.targetDays,
    }));
    const outreach = new Map<string, number>();
    for (const c of contacts) outreach.set(c.reason, (outreach.get(c.reason) ?? 0) + c._count._all);
    for (const c of campaigns) outreach.set(c.segment, (outreach.get(c.segment) ?? 0) + c.memberIds.length);
    const map = evaluateLevers(
      coworkingLevers(facts),
      actions,
      [...outreach].map(([reason, n]) => ({ reason, contacts: n })),
      now,
      { maxIdeas: 20 },
    );
    // « Pas pour moi » : the idea is not proposed again, the lever says why
    const refused = (leverId: string, title?: string) =>
      dismissals.find((d) => d.leverId === leverId || (title && d.title === title));
    for (const g of map.groups) {
      for (const l of g.levers) {
        const d = l.status === 'MISSING' ? refused(l.id) : undefined;
        if (d) Object.assign(l, { status: 'OK', note: `pas pour moi : ${d.reason.toLowerCase()}` });
      }
    }
    map.missing = map.missing.filter((m) => !refused(m.leverId, m.title)).slice(0, 3);
    map.counts = { WORKING: 0, IN_PROGRESS: 0, MISSING: 0, NO_DATA: 0, OK: 0 };
    for (const g of map.groups) for (const l of g.levers) map.counts[l.status] += 1;
    return { generatedAt: now.toISOString(), ...map };
  }
}
