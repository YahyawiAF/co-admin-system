import { Injectable } from '@nestjs/common';
import { differenceInCalendarDays, startOfDay, subDays } from 'date-fns';
import { PrismaService } from 'database/prisma.service';
import { localDayKey } from '../../../common/parse-local-day';
import { ForecastService } from '../analytics/forecast.service';
import { NewcomersService } from '../analytics/newcomers.service';
import { MemberService } from '../member/member.service';
import { orderUnitPrice } from '../product/order-price';
import { type AiRecommendation, buildHealth, type HealthInitiative } from './health';
import { SnapshotService } from './snapshot.service';

const WEEKS = 8;
const DAY = 86_400_000;
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);

/** Loads the facts of the Conseil IA bilan (rules only) and builds it. */
@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly forecasts: ForecastService,
    private readonly newcomers: NewcomersService,
    private readonly members: MemberService,
    private readonly snapshots: SnapshotService,
  ) {}

  async health(facilityId?: string) {
    const now = new Date();
    const { facts, defs, map, facilityId: id } = await this.forecasts.leversWithFacts(facilityId);
    const leverStatus: Record<string, string> = {};
    const leverNotes: Record<string, { title: string; note: string | null }> = {};
    for (const g of map.groups)
      for (const l of g.levers) {
        leverStatus[l.id] = l.status;
        leverNotes[l.id] = { title: l.title, note: l.note };
      }

    const today = startOfDay(now);
    const weekStart = (i: number) => new Date(today.getTime() - (WEEKS - i) * 7 * DAY + DAY);
    const from = weekStart(0);
    const weekOf = (d: Date) => {
      const i = Math.floor((d.getTime() - from.getTime()) / (7 * DAY));
      return i >= 0 && i < WEEKS ? i : -1;
    };

    const [visits, orders, abos, paid, list, debtors, report, dismissals, rows] = await Promise.all([
      this.prisma.journal.findMany({
        where: { registredTime: { gte: from, lte: now }, isReservation: false, hiddenAt: null },
        select: { id: true, registredTime: true, memberID: true, isPayed: true },
      }),
      this.prisma.dailyProduct.findMany({
        where: { date: { gte: from, lte: now }, status: { notIn: ['PENDING', 'CANCELLED'] } },
        select: { journalId: true, memberId: true, date: true, createdAt: true, quantite: true, unitPrice: true, product: { select: { sellingPrice: true } } },
      }),
      this.prisma.abonnement.findMany({
        where: { createdAt: { gte: from, lte: now }, isReservation: false, hiddenAt: null },
        select: { createdAt: true },
      }),
      // Money of a day: every paid journal (same rule as Finance)
      this.prisma.journal.findMany({
        where: { registredTime: { gte: from, lte: now }, isPayed: true },
        select: { registredTime: true, payedAmount: true },
      }),
      this.newcomers.newcomers(now),
      this.members.listDebtors(),
      this.prisma.advisorReport.findFirst({
        where: { facilityId: id, status: 'DONE', createdAt: { gte: subDays(now, 45) } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, createdAt: true, result: true },
      }),
      this.prisma.advisorDismissal.findMany({ where: { facilityId: id }, select: { leverId: true, title: true } }),
      this.snapshots.initiativesWithImpact(id, undefined, 40),
    ]);

    // ---- café: visits with an order (same visit, or same member the same day)
    const withOrder = new Set(orders.map((o) => o.journalId).filter(Boolean));
    const buyerDays = new Set(orders.filter((o) => o.memberId).map((o) => `${o.memberId}|${localDayKey(o.date ?? o.createdAt)}`));
    const hasCafe = (v: (typeof visits)[number]) =>
      withOrder.has(v.id) || (!!v.memberID && buyerDays.has(`${v.memberID}|${localDayKey(v.registredTime)}`));
    const weekVisits = Array.from({ length: WEEKS }, () => ({ all: 0, cafe: 0, unpaid: 0 }));
    for (const v of visits) {
      const w = weekOf(v.registredTime);
      if (w < 0) continue;
      weekVisits[w].all += 1;
      if (hasCafe(v)) weekVisits[w].cafe += 1;
      if (!v.isPayed) weekVisits[w].unpaid += 1;
    }
    const last4 = weekVisits.slice(WEEKS - 4);
    // Typical café sale: the median, so one mistyped price can't blow the estimate up
    const orderValues = orders.map((o) => orderUnitPrice(o) * (o.quantite || 0)).filter((v) => v > 0).sort((a, b) => a - b);
    const medianCafe = orderValues.length ? orderValues[Math.floor(orderValues.length / 2)] : 2;

    // ---- the calmest weekday, week by week (passes + café)
    const days = facts.weekdayRevenue.map((v, wd) => ({ wd, v })).filter((d) => d.v > 0);
    const weakDay = days.length >= 5 ? days.reduce((a, b) => (b.v < a.v ? b : a)).wd : null;
    const weak = Array(WEEKS).fill(0) as number[];
    if (weakDay != null) {
      for (const j of paid) if (j.registredTime.getDay() === weakDay && weekOf(j.registredTime) >= 0) weak[weekOf(j.registredTime)] += j.payedAmount || 0;
      for (const o of orders) {
        const d = o.date ?? o.createdAt;
        if (d.getDay() === weakDay && weekOf(d) >= 0) weak[weekOf(d)] += orderUnitPrice(o) * (o.quantite || 0);
      }
    }

    // ---- newcomers, and those back within 14 days (by week of first visit)
    const newPerWeek = Array(WEEKS).fill(0) as number[];
    const cohort = Array.from({ length: WEEKS }, () => ({ judged: 0, back: 0 }));
    for (const n of list) {
      const w = weekOf(n.first);
      if (w < 0) continue;
      newPerWeek[w] += 1;
      if (n.judged) {
        cohort[w].judged += 1;
        if (n.back) cohort[w].back += 1;
      }
    }
    const d28 = subDays(now, 28);
    const d56 = subDays(now, 56);

    // ---- unpaid: same list as Impayés and Argent
    const owed = debtors.members.reduce((a, m) => a + m.net, 0);
    const openItems = debtors.members.flatMap((m) => m.items.filter((i) => !i.settled));
    const oldest = openItems.length ? Math.min(...openItems.map((i) => new Date(i.date).getTime())) : null;

    const initiatives: HealthInitiative[] = rows.map((i) => ({
      id: i.id,
      title: i.title,
      area: i.area ?? null,
      leverId: i.leverId ?? null,
      category: i.category,
      objective: i.objective,
      metric: i.metric,
      segment: i.target.segment,
      recommendationTitle: i.recommendationTitle,
      startDate: i.startDate,
      endDate: i.endDate,
      finished: i.finished,
      dropped: !!i.dropped,
      gain: i.result?.gain ?? null,
      netGain: i.result?.netGain ?? null,
      goalAmount: i.goalAmount ?? null,
      verdict: i.ownerVerdict,
      status: i.result?.status ?? null,
    }));

    const result = report?.result as { recommendations?: AiRecommendation[] } | null;
    const health = buildHealth({
      now,
      facts,
      defs,
      leverStatus,
      leverNotes,
      weekly: {
        cafeAttachPct: weekVisits.map((w) => (w.all >= 5 ? pct(w.cafe, w.all) : null)),
        aboSold: abos.reduce((acc, a) => {
          const w = a.createdAt ? weekOf(a.createdAt) : -1;
          if (w >= 0) acc[w] += 1;
          return acc;
        }, Array(WEEKS).fill(0) as number[]),
        weakDayRevenue: weak.map((v) => Math.round(v)),
        newcomers: newPerWeek,
        returnPct: cohort.map((c) => (c.judged >= 3 ? pct(c.back, c.judged) : null)),
        unpaidVisits: weekVisits.map((w) => w.unpaid),
      },
      cafe: {
        visits28: last4.reduce((a, w) => a + w.all, 0),
        withCafe28: last4.reduce((a, w) => a + w.cafe, 0),
        avgCafe: Math.round(medianCafe * 10) / 10,
      },
      newcomers: {
        last28: list.filter((n) => n.first >= d28).length,
        prev28: list.filter((n) => n.first >= d56 && n.first < d28).length,
      },
      unpaid: {
        total: Math.round(owed * 10) / 10,
        clients: debtors.members.length,
        oldestDays: oldest != null ? differenceInCalendarDays(now, new Date(oldest)) : null,
      },
      report: result?.recommendations ? { id: report!.id, recommendations: result.recommendations } : null,
      dismissed: dismissals,
      initiatives,
    });
    return {
      generatedAt: now.toISOString(),
      report: report ? { id: report.id, createdAt: report.createdAt.toISOString() } : null,
      weekStarts: Array.from({ length: WEEKS }, (_, i) => localDayKey(weekStart(i))),
      ...health,
    };
  }
}
