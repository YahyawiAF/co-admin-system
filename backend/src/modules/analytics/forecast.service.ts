import { BadRequestException, Injectable } from '@nestjs/common';
import { addDays, endOfDay, endOfMonth, format, getDaysInMonth, startOfDay, startOfMonth, startOfWeek, subDays, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PrismaService } from 'database/prisma.service';
import { localDayKey } from '../../../common/parse-local-day';
import { orderUnitPrice } from '../product/order-price';
import {
  calendarEffects,
  detectChanges,
  evaluateLevers,
  totalsOf,
  type ActionRecord,
  type DayFact,
  type DetectedChange,
  type Totals,
} from '../../business-manager-core';
import {
  computeMonthForecast,
  loadAbonnements,
  loadCalendar,
  loadDayFacts,
  recentRenewals,
  subscriptionsOutlook,
  abonnementMonth,
  type MonthForecastResult,
} from './month-data';
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
  dayFacts(from: Date, to: Date): Promise<DayFact[]> {
    return loadDayFacts(this.prisma, from, to);
  }

  private totals(days: DayFact[]): Totals {
    return totalsOf(days);
  }

  // ---------- subscriptions expected ----------

  async subscriptionsOutlook(monthStart: Date) {
    return subscriptionsOutlook(await loadAbonnements(this.prisma), monthStart);
  }

  // ---------- forecast ----------

  async forecast(opts: { year?: number; month?: number; facilityId?: string }) {
    const now = new Date();
    const year = opts.year || now.getFullYear();
    const month = opts.month || now.getMonth() + 1;
    if (month < 1 || month > 12) throw new BadRequestException('Mois invalide');
    const s = await this.performance.settings(opts.facilityId);
    const f = await computeMonthForecast(this.prisma, s.facilityId, year, month, now);
    // Only the month in progress is kept: a past month rebuilt today would already know the answer
    if (f.period.isCurrent) await this.keepSnapshot(s.facilityId, f).catch(() => undefined);
    return f;
  }

  // ---------- abonnements ----------

  /** This month's abonnements (totals, renewals, conversions) and the recent renewals with their offers. */
  async abonnementsOverview(now = new Date()) {
    const abos = await loadAbonnements(this.prisma);
    const month = await abonnementMonth(this.prisma, abos, now.getFullYear(), now.getMonth() + 1, now);
    return { month, recentRenewals: recentRenewals(abos, subDays(now, 60)).slice(0, 20) };
  }

  // ---------- stored predictions ----------

  /**
   * The month's prediction is kept as it was the first time it was computed
   * (normally the 1st), with the rules behind it, so it can be checked at the
   * end of the month. Never overwritten.
   */
  private async keepSnapshot(facilityId: string, f: MonthForecastResult) {
    const { year, month } = f.period;
    const exists = await this.prisma.forecastSnapshot.findUnique({
      where: { facilityId_year_month: { facilityId, year, month } },
      select: { id: true },
    });
    if (exists) return;
    // A snapshot taken late in the month would mostly hold actual numbers
    if (new Date().getDate() > 10) return;
    await this.prisma.forecastSnapshot.create({
      data: {
        facilityId,
        year,
        month,
        passes: f.expected.visits,
        products: f.expected.products,
        subscriptions: f.expected.subscriptions,
        variable: f.expected.variable,
        total: f.expected.total,
        low: f.expected.low,
        high: f.expected.high,
        rules: {
          base: f.period.base,
          perWeekday: f.perWeekday.map((w) => ({ weekday: w.weekday, passesAndCafe: Math.round((w.revenueVisits + w.products) * 10) / 10 })),
          band: f.band,
          periods: f.periods.map((p) => ({ label: p.label, type: p.type, from: p.from, to: p.to, factor: p.factor, known: p.known, effect: p.effect })),
          subscriptions: {
            endingCount: f.subscriptions.endingCount,
            endingValue: f.subscriptions.endingValue,
            renewalRatePct: f.subscriptions.renewalRatePct,
            renewalRateSource: f.subscriptions.renewalRateSource,
            newPace: f.subscriptions.newPace,
          },
          bookings: f.bookings,
        },
      },
    });
  }

  /**
   * Prediction vs reality for the last finished months that have a stored
   * prediction: per line (passes, café, abonnements) and per calendar period
   * (effect assumed vs effect measured).
   */
  async accuracy(facilityId?: string, months = 3) {
    const s = await this.performance.settings(facilityId);
    const now = new Date();
    const thisMonth = startOfMonth(now);
    const snaps = await this.prisma.forecastSnapshot.findMany({
      where: { facilityId: s.facilityId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: months + 1,
    });
    const done = snaps.filter((x) => new Date(x.year, x.month - 1, 1) < thisMonth).slice(0, months);
    if (!done.length) return { months: [] };
    const calendar = await loadCalendar(this.prisma, s.facilityId);
    const out = [];
    for (const snap of done) {
      const start = new Date(snap.year, snap.month - 1, 1);
      const end = endOfMonth(start);
      const days = await this.dayFacts(start, end);
      const t = totalsOf(days);
      const line = (key: string, label: string, predicted: number, actual: number) => ({
        key,
        label,
        predicted: Math.round(predicted),
        actual: Math.round(actual),
        errorPct: predicted > 0 ? Math.round(((actual - predicted) / predicted) * 100) : null,
      });
      const rules = (snap.rules ?? {}) as { periods?: Array<{ label: string; type: string; from: string; to: string; factor: number; known: boolean }> };
      const measured = calendarEffects(
        await this.dayFacts(subDays(start, 60), end),
        calendar.filter((c) => c.end >= localDayKey(start) && c.start <= localDayKey(end)),
      );
      out.push({
        year: snap.year,
        month: snap.month,
        label: format(start, 'MMMM yyyy', { locale: fr }),
        takenAt: snap.takenAt.toISOString(),
        lines: [
          line('passes', 'Passes', snap.passes, t.revenueVisits),
          line('products', 'Café et produits', snap.products, t.products),
          line('subscriptions', 'Abonnements', snap.subscriptions, t.subscriptions),
          line('total', 'Total', snap.total, t.revenueVisits + t.products + t.subscriptions),
        ],
        inRange: snap.low <= t.revenueVisits + t.products + t.subscriptions && t.revenueVisits + t.products + t.subscriptions <= snap.high,
        periods: (rules.periods ?? []).map((p) => ({
          label: p.label,
          assumedFactor: p.known ? p.factor : null,
          measuredFactor: measured[p.type]?.factor ?? null,
        })),
      });
    }
    return { months: out };
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
    const abos = await loadAbonnements(this.prisma);
    const [days, newcomers, list, subs, events, nextEvent, referrals, reviewClicks, cafeOrders, base, aboMonth] = await Promise.all([
      this.dayFacts(subDays(startOfDay(now), 29), now),
      this.newcomers.newcomers(now),
      this.outreach.list(facilityId).catch(() => null),
      Promise.resolve(subscriptionsOutlook(abos, startOfMonth(now))),
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
      abonnementMonth(this.prisma, abos, now.getFullYear(), now.getMonth() + 1, now),
    ]);
    const renewals = recentRenewals(abos, d30);
    const rateNow = aboMonth?.thisMonth.ended && aboMonth.thisMonth.ended >= 3 ? aboMonth.thisMonth.ratePct : null;
    const rateLast = aboMonth?.renewedFromLastMonth.ratePct ?? null;
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
      renewals30: renewals.length,
      renewalsOtherOffer30: renewals.filter((r) => !r.sameOffer).length,
      renewalImproving: rateNow != null && rateLast != null && rateNow > rateLast,
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
    const { map } = await this.leversWithFacts(facilityId);
    return map;
  }

  /** The lever map and the facts behind it (the Conseil IA bilan reuses both). */
  async leversWithFacts(facilityId?: string) {
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
    const defs = coworkingLevers(facts);
    const map = evaluateLevers(
      defs,
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
    return { map: { generatedAt: now.toISOString(), ...map }, facts, defs, facilityId: s.facilityId };
  }
}
