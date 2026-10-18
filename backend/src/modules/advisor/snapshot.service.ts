import { Injectable } from '@nestjs/common';
import { orderUnitPrice } from '../product/order-price';
import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  min as minDate,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from 'date-fns';
import { PrismaService } from 'database/prisma.service';
import { localDayKey } from '../../../common/parse-local-day';
import { AnalyticsService } from '../analytics/analytics.service';
import { PerformanceService } from '../analytics/performance.service';
import { hoursOnSite, round1, visitEnd } from '../analytics/traffic';
import { abonnementPaymentsInRange } from '../abonnement/abonnement-revenue';
import { expenseAmount } from '../expense/expense-amount';
import { ContextService } from './context.service';
import { OutreachService } from '../analytics/outreach.service';
import { CampaignService } from '../analytics/campaign.service';

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const HOUR_MS = 3_600_000;
/** Visit days in the period from which a day-pass client is a "regular" worth converting. */
const REGULAR_MIN_DAYS = 8;
/** Days compared before / after an initiative starts. */
const IMPACT_WINDOW_DAYS = 28;

/** Opening hours for the hourly traffic slice (closeHour > 24 = after midnight). */
function openHoursWindow(facility: {
  openHour?: number | null;
  closeHour?: number | null;
  alwaysOpen?: boolean | null;
}) {
  if (facility.alwaysOpen) return { firstHour: 8, lastHour: 22 };
  const firstHour = Math.max(0, Math.min(23, facility.openHour ?? 8));
  const rawClose = facility.closeHour ?? 20;
  const lastHour = Math.max(firstHour + 1, Math.min(24, rawClose > 24 ? 24 : rawClose));
  return { firstHour, lastHour };
}

const pct = (part: number, total: number) =>
  total > 0 ? Math.round((part / total) * 100) : null;
const change = (cur: number | null, prev: number | null) =>
  cur != null && prev != null && prev !== 0
    ? Math.round(((cur - prev) / Math.abs(prev)) * 100)
    : null;

export type PeriodMetrics = Awaited<ReturnType<SnapshotService['periodMetrics']>>;

/**
 * Builds the business snapshot sent to Claude: aggregated figures only
 * (no names, phones or e-mails), so the AI sees patterns, not people.
 */
@Injectable()
export class SnapshotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly performance: PerformanceService,
    private readonly context: ContextService,
    private readonly outreach: OutreachService,
    private readonly campaigns: CampaignService,
  ) {}

  async build(facilityId: string, days: number) {
    const now = new Date();
    const end = endOfDay(now);
    const start = startOfDay(subDays(now, days - 1));
    const prevEnd = endOfDay(subDays(start, 1));
    const prevStart = startOfDay(subDays(start, days));
    const from = localDayKey(start);
    const to = localDayKey(end);

    const facility = await this.prisma.facility.findUniqueOrThrow({
      where: { id: facilityId },
    });
    const seats = await this.seats(facilityId, facility.nbrPlaces);

    const [
      current,
      previous,
      weekly,
      services,
      cafe,
      spaces,
      catalogue,
      subscriptions,
      regulars,
      monthlyFinance,
      target,
      events,
      alerts,
      initiatives,
      previousAdvice,
      ownerContext,
      outreachLists,
      campaigns,
      recentDaysVsUsual,
    ] = await Promise.all([
      this.periodMetrics(start, end, seats),
      this.periodMetrics(prevStart, prevEnd, seats),
      this.analytics.trafficWeekly({ from, to }),
      this.analytics.servicesDemand(from, to),
      this.analytics.productsPerformance(from, to),
      this.analytics.spacesUsage(from, to),
      this.catalogue(),
      this.subscriptions(now),
      this.dayPassRegulars(start, end, now),
      this.monthlyFinance(now),
      this.monthTarget(facilityId, now),
      this.events(facilityId, start, end, now),
      this.performance.insights(facilityId).catch(() => ({ insights: [] })),
      this.initiativesWithImpact(facilityId, seats),
      this.previousAdvice(facilityId),
      this.context.snapshotContext(facilityId, { prevStart, start, end }),
      this.outreachLists(facilityId),
      this.campaigns.list(facilityId).catch(() => []),
      this.recentDays(now),
    ]);

    const trend = (key: keyof PeriodMetrics) =>
      change(current[key] as number | null, previous[key] as number | null);

    const { firstHour, lastHour } = openHoursWindow(facility);

    return {
      generatedAt: now.toISOString(),
      currency: 'DT (dinar tunisien)',
      period: { from, to, days },
      previousPeriod: { from: localDayKey(prevStart), to: localDayKey(prevEnd) },
      facility: {
        name: facility.name,
        seats,
        openHour: facility.openHour,
        closeHour: facility.closeHour,
        alwaysOpen: facility.alwaysOpen,
        ownerContext: facility.businessContext || null,
      },
      current,
      previous,
      changePct: {
        visits: trend('visits'),
        revenueTotal: trend('revenueTotal'),
        revenueVisits: trend('revenueVisits'),
        revenueSubscriptions: trend('revenueSubscriptions'),
        revenueCafe: trend('revenueCafe'),
        avgStayHours: trend('avgStayHours'),
        cafeAttachRatePct: trend('cafeAttachRatePct'),
        avgOccupancyPct: trend('avgOccupancyPct'),
      },
      weekdays: weekly.days.map((d) => {
        const openHours = d.hours.filter(
          (h) => h.hour >= firstHour && h.hour < lastHour,
        );
        return {
          day: WEEKDAYS[d.weekday],
          avgVisits: d.avgVisits,
          peakArrivalHour: d.peakHour,
          peakPresentHour: d.peakPresentHour,
          peakPresent: d.peakPresent,
          avgOccupancyPctAtPeak:
            seats > 0 ? Math.round((d.peakPresent / seats) * 100) : null,
          firstHour,
          hourlyAvgPresent: openHours.map((h) => h.avgPresent),
          quietHours: openHours
            .filter(
              (h) =>
                d.peakPresent > 0 && h.avgPresent < d.peakPresent * 0.3,
            )
            .map((h) => h.hour),
        };
      }),
      recentDaysVsUsual,
      offersSold: services.services.slice(0, 15).map((s) => ({
        name: s.name,
        sold: s.count,
        revenue: round1(s.revenue),
        uniqueClients: s.uniqueClients,
      })),
      catalogue,
      cafe: {
        totals: cafe.totals,
        products: cafe.products.slice(0, 15).map((p) => ({
          name: p.name,
          quantity: p.quantity,
          revenue: p.revenue,
          margin: p.margin,
          marginPct: p.marginPct,
          stock: p.stock,
        })),
        unsoldInStock: cafe.dormant.map((d) => ({ name: d.name, stock: d.stock })),
        revenueByHour: cafe.revenueByHour.filter((h) => h.revenue > 0),
      },
      spaces: spaces.spaces.slice(0, 12).map((s) => ({
        name: s.name,
        uses: s.count,
        hours: s.hours,
        uniqueClients: s.uniqueClients,
      })),
      subscriptions,
      dayPassRegulars: regulars,
      monthlyFinance,
      monthTarget: target,
      events,
      ruleBasedAlerts: alerts.insights.slice(0, 12).map((i) => ({
        severity: i.severity,
        title: i.title,
        detail: i.detail,
      })),
      initiatives,
      previousAdvice,
      outreachLists,
      campaigns: campaigns.slice(0, 10).map((c) => ({
        title: c.title,
        segment: c.segment,
        createdAt: localDayKey(c.createdAt),
        status: c.status,
        ...c.progress,
      })),
      ...ownerContext,
    };
  }

  /**
   * Last 7 full days vs the average of the 4 previous same weekdays.
   * Today is skipped (unfinished day would always look like a drop).
   * Revenue here = visits + abonnements (not café).
   */
  private async recentDays(now: Date) {
    const days = Array.from({ length: 7 }, (_, i) =>
      localDayKey(subDays(now, i + 1)),
    );
    const rows = await Promise.all(
      days.map((date) =>
        this.analytics
          .trafficDay({ date, compare: 'weekday', count: 4 })
          .catch(() => null),
      ),
    );
    return rows
      .filter((r): r is NonNullable<typeof r> => !!r)
      .map((r) => ({
        date: r.date,
        day: WEEKDAYS[r.target.weekday],
        visits: r.target.totals.visits,
        usualVisits: r.average.totals.visits,
        revenue: round1(r.target.totals.revenue),
        usualRevenue: round1(r.average.totals.revenue),
        avgStayMin: r.target.totals.avgDurationMin,
        usualStayMin: r.average.totals.avgDurationMin,
        peakPresent: r.target.totals.peakPresent,
        leftUnpaid: r.target.totals.leftUnpaid,
      }));
  }

  /** Size of each relance list (who the AI can target). */
  private async outreachLists(facilityId: string) {
    const list = await this.outreach.list(facilityId).catch(() => null);
    const counts: Record<string, number> = {};
    for (const i of [...(list?.todo ?? []), ...(list?.contacted ?? [])]) {
      counts[i.reason] = (counts[i.reason] ?? 0) + 1;
    }
    const recent = await this.prisma.journal.findMany({
      where: { registredTime: { gte: subDays(new Date(), 30) }, isReservation: false, memberID: { not: null } },
      select: { memberID: true },
      distinct: ['memberID'],
    });
    return { ...counts, RECENT_30: recent.length };
  }

  private async seats(facilityId: string, fallback: number) {
    const spaces = await this.prisma.space.findMany({
      where: { facilityId },
      select: {
        capacityNormal: true,
        seats: { where: { isActive: true, isOverflow: false }, select: { id: true } },
      },
    });
    const n = spaces.reduce(
      (a, s) => a + (s.seats.length || Math.max(0, s.capacityNormal)),
      0,
    );
    return n || fallback || 0;
  }

  /** Visits, stays, occupancy and money for one window. */
  async periodMetrics(start: Date, end: Date, seats: number) {
    const now = new Date();
    const effectiveEnd = minDate([end, now]);
    const days = Math.max(1, differenceInCalendarDays(effectiveEnd, start) + 1);

    const [journals, products, aboPayments, expenses, newMembers] = await Promise.all([
      this.prisma.journal.findMany({
        where: { registredTime: { gte: start, lte: end }, isReservation: false },
        select: {
          id: true,
          registredTime: true,
          leaveTime: true,
          isPayed: true,
          payedAmount: true,
          memberID: true,
          groupVisitId: true,
          promoLabel: true,
          promoDiscount: true,
        },
      }),
      this.prisma.dailyProduct.findMany({
        where: {
          date: { gte: start, lte: end },
          status: { notIn: ['PENDING', 'CANCELLED'] },
        },
        select: {
          quantite: true,
          journalId: true,
          memberId: true,
          date: true,
          createdAt: true,
          unitPrice: true,
          product: { select: { sellingPrice: true, purchasePrice: true } },
        },
      }),
      this.prisma.abonnementPayment.findMany({
        where: abonnementPaymentsInRange(start, end),
        select: { amount: true },
      }),
      this.prisma.dailyExpense.findMany({
        where: { date: { gte: start, lte: end } },
        include: { expense: { select: { amount: true } } },
      }),
      this.prisma.member.count({ where: { createdAt: { gte: start, lte: end } } }),
    ]);

    const visits = journals.length;
    const revenueVisits = journals.reduce((a, j) => a + (j.isPayed ? j.payedAmount || 0 : 0), 0);
    const revenueSubscriptions = aboPayments.reduce((a, p) => a + p.amount, 0);
    let revenueCafe = 0;
    let cafeCost = 0;
    let cafeItems = 0;
    const visitIdsWithOrder = new Set<string>();
    const buyerDays = new Set<string>();
    for (const p of products) {
      const qty = p.quantite || 0;
      revenueCafe += orderUnitPrice(p) * qty;
      cafeCost += (p.product?.purchasePrice || 0) * qty;
      cafeItems += qty;
      if (p.journalId) visitIdsWithOrder.add(p.journalId);
      if (p.memberId) buyerDays.add(`${p.memberId}|${localDayKey(p.date || p.createdAt)}`);
    }
    const visitsWithOrder = journals.filter(
      (j) =>
        visitIdsWithOrder.has(j.id) ||
        (j.memberID && buyerDays.has(`${j.memberID}|${localDayKey(j.registredTime)}`)),
    ).length;
    const expenseTotal = expenses.reduce((a, e) => a + expenseAmount(e), 0);

    const stays: number[] = [];
    const arrivals = Array(24).fill(0);
    const present = Array(24).fill(0);
    let lunch = 0;
    let evening = 0;
    for (const j of journals) {
      const endAt = visitEnd(j, now);
      stays.push(Math.max(0, (endAt.getTime() - j.registredTime.getTime()) / HOUR_MS));
      arrivals[j.registredTime.getHours()] += 1;
      const hours = hoursOnSite(j, now);
      for (const h of hours) present[h] += 1;
      if (hours.includes(12) || hours.includes(13)) lunch += 1;
      if (hours.some((h) => h >= 18)) evening += 1;
    }
    stays.sort((a, b) => a - b);
    const bucket = (lo: number, hi: number) =>
      pct(stays.filter((s) => s >= lo && s < hi).length, stays.length);

    const groups = new Map<string, number>();
    for (const j of journals) {
      if (j.groupVisitId) groups.set(j.groupVisitId, (groups.get(j.groupVisitId) || 0) + 1);
    }
    const promoVisits = journals.filter((j) => j.promoLabel);
    const uniqueClients = new Set(journals.map((j) => j.memberID).filter(Boolean)).size;
    const occupancyByHour = present.map((p, hour) => ({
      hour,
      avgPresent: round1(p / days),
      occupancyPct: seats > 0 ? Math.round((p / days / seats) * 100) : null,
    }));
    const openHours = occupancyByHour.filter((h) => h.avgPresent > 0);
    const avgOccupancyPct =
      seats > 0 && openHours.length
        ? Math.round(
            (openHours.reduce((a, h) => a + h.avgPresent, 0) / openHours.length / seats) * 100,
          )
        : null;
    const revenueTotal = revenueVisits + revenueSubscriptions + revenueCafe;

    return {
      days,
      visits,
      visitsPerDay: round1(visits / days),
      uniqueClients,
      anonymousVisits: journals.filter((j) => !j.memberID).length,
      newMembers,
      revenueTotal: round1(revenueTotal),
      revenuePerDay: round1(revenueTotal / days),
      revenueVisits: round1(revenueVisits),
      revenueSubscriptions: round1(revenueSubscriptions),
      revenueCafe: round1(revenueCafe),
      cafeMargin: round1(revenueCafe - cafeCost),
      cafeItemsSold: cafeItems,
      cafeAttachRatePct: pct(visitsWithOrder, visits),
      cafeRevenuePerVisit: visits ? round1(revenueCafe / visits) : null,
      unpaidVisits: journals.filter((j) => !j.isPayed).length,
      expenses: round1(expenseTotal),
      net: round1(revenueTotal - expenseTotal),
      avgStayHours: stays.length ? round1(stays.reduce((a, b) => a + b, 0) / stays.length) : null,
      medianStayHours: stays.length ? round1(stays[Math.floor(stays.length / 2)]) : null,
      stayDistributionPct: {
        under2h: bucket(0, 2),
        from2to4h: bucket(2, 4),
        from4to6h: bucket(4, 6),
        over6h: bucket(6, Infinity),
      },
      onSiteAtLunchPct: pct(lunch, visits),
      onSiteAfter18hPct: pct(evening, visits),
      avgOccupancyPct,
      arrivalsByHour: arrivals
        .map((n, hour) => ({ hour, arrivals: n }))
        .filter((h) => h.arrivals > 0),
      occupancyByHour: openHours,
      groupVisits: groups.size,
      avgGroupSize: groups.size
        ? round1([...groups.values()].reduce((a, b) => a + b, 0) / groups.size)
        : null,
      promoVisits: promoVisits.length,
      promoDiscountTotal: round1(promoVisits.reduce((a, j) => a + (j.promoDiscount || 0), 0)),
    };
  }

  private async catalogue() {
    const [prices, products] = await Promise.all([
      this.prisma.price.findMany({
        where: { isActive: true },
        select: {
          name: true,
          price: true,
          type: true,
          categories: true,
          durationHours: true,
          periodDays: true,
          availableFromHour: true,
          availableToHour: true,
          availableDays: true,
        },
        orderBy: { price: 'asc' },
      }),
      this.prisma.product.findMany({
        select: { name: true, purchasePrice: true, sellingPrice: true, stock: true },
      }),
    ]);
    return {
      offers: prices.map((p) => ({
        name: p.name,
        price: p.price,
        kind: p.type === 'abonnement' ? 'abonnement' : 'pass',
        categories: p.categories,
        durationHours: p.durationHours,
        periodDays: p.periodDays,
        onlyBetweenHours:
          p.availableFromHour != null ? [p.availableFromHour, p.availableToHour] : null,
        onlyOnDays: p.availableDays.length ? p.availableDays.map((d) => WEEKDAYS[d]) : null,
      })),
      products: products.map((p) => ({
        name: p.name,
        buy: p.purchasePrice,
        sell: p.sellingPrice,
        stock: p.stock,
      })),
    };
  }

  private async subscriptions(now: Date) {
    const today = startOfDay(now);
    const abos = await this.prisma.abonnement.findMany({
      where: { isReservation: false, leaveDate: { gte: subDays(today, 30) } },
      select: { memberID: true, registredDate: true, leaveDate: true },
    });
    const latest = new Map<string, Date>();
    for (const a of abos) {
      const prev = latest.get(a.memberID);
      if (!prev || a.leaveDate! > prev) latest.set(a.memberID, a.leaveDate!);
    }
    const ends = [...latest.values()];
    const active = abos.filter((a) => a.registredDate <= now && a.leaveDate! >= today);
    return {
      activeNow: new Set(active.map((a) => a.memberID)).size,
      endingNext7Days: ends.filter((d) => d >= today && d <= endOfDay(addDays(today, 7))).length,
      endedLast30DaysNotRenewed: ends.filter((d) => d < today).length,
    };
  }

  /** Clients who keep paying passes often enough that a subscription would suit them. */
  private async dayPassRegulars(start: Date, end: Date, now: Date) {
    const [visits, active] = await Promise.all([
      this.prisma.journal.findMany({
        where: {
          registredTime: { gte: start, lte: end },
          isReservation: false,
          memberID: { not: null },
        },
        select: { memberID: true, registredTime: true, payedAmount: true, isPayed: true },
      }),
      this.prisma.abonnement.findMany({
        where: {
          isReservation: false,
          registredDate: { lte: now },
          leaveDate: { gte: startOfDay(now) },
        },
        select: { memberID: true },
      }),
    ]);
    const subscribed = new Set(active.map((a) => a.memberID));
    const byMember = new Map<string, { days: Set<string>; spent: number }>();
    for (const v of visits) {
      if (subscribed.has(v.memberID!)) continue;
      const m = byMember.get(v.memberID!) || { days: new Set<string>(), spent: 0 };
      m.days.add(localDayKey(v.registredTime));
      if (v.isPayed) m.spent += v.payedAmount || 0;
      byMember.set(v.memberID!, m);
    }
    const regulars = [...byMember.values()].filter((m) => m.days.size >= REGULAR_MIN_DAYS);
    return {
      definition: `clients sans abonnement venus au moins ${REGULAR_MIN_DAYS} jours sur la période`,
      count: regulars.length,
      avgVisitDays: regulars.length
        ? round1(regulars.reduce((a, m) => a + m.days.size, 0) / regulars.length)
        : null,
      avgSpentInPeriod: regulars.length
        ? round1(regulars.reduce((a, m) => a + m.spent, 0) / regulars.length)
        : null,
    };
  }

  private async monthlyFinance(now: Date) {
    const years = [...new Set([subMonths(now, 5).getFullYear(), now.getFullYear()])];
    const all = (await Promise.all(years.map((y) => this.analytics.financeMonthly(y)))).flatMap(
      (r) => r.months,
    );
    const firstKey = subMonths(startOfMonth(now), 5);
    return all
      .filter((m) => {
        const d = new Date(m.year, m.month - 1, 1);
        return d >= firstKey && d <= now;
      })
      .map((m) => ({
        month: `${m.year}-${String(m.month).padStart(2, '0')}`,
        visits: round1(m.revenueJournal),
        subscriptions: round1(m.revenueAbonnements),
        cafe: round1(m.revenueProducts),
        expenses: round1(m.expenses),
        net: round1(m.net),
      }));
  }

  private async monthTarget(facilityId: string, now: Date) {
    const t = await this.prisma.monthlyTarget.findUnique({
      where: {
        facilityId_year_month: {
          facilityId,
          year: now.getFullYear(),
          month: now.getMonth() + 1,
        },
      },
    });
    if (!t) return null;
    const { days } = await this.analytics.financeMonthDays(now.getFullYear(), now.getMonth() + 1);
    const revenueSoFar = days.reduce(
      (a, d) => a + d.revenueJournal + d.revenueAbonnements + d.revenueProducts,
      0,
    );
    return {
      revenueTarget: t.revenue,
      occupancyTargetPct: t.occupancyPct,
      revenueSoFar: round1(revenueSoFar),
      dayOfMonth: now.getDate(),
      daysInMonth: endOfMonth(now).getDate(),
    };
  }

  private async events(facilityId: string, start: Date, end: Date, now: Date) {
    const [past, upcoming] = await Promise.all([
      this.prisma.event.findMany({
        where: { facilityId, startAt: { gte: start, lte: end } },
        select: { kind: true, capacity: true, _count: { select: { registrations: true } } },
      }),
      this.prisma.event.count({ where: { facilityId, startAt: { gt: now } } }),
    ]);
    return {
      inPeriod: past.length,
      registrations: past.reduce((a, e) => a + e._count.registrations, 0),
      upcoming,
    };
  }

  /** Each initiative: same-length windows before and after its start date. */
  async initiativesWithImpact(facilityId: string, seats?: number) {
    const list = await this.prisma.businessInitiative.findMany({
      where: { facilityId },
      orderBy: { startDate: 'desc' },
      take: 10,
    });
    if (!list.length) return [];
    const capacity = seats ?? (await this.facilitySeats(facilityId));
    return Promise.all(list.map((i) => this.initiativeImpact(i, capacity)));
  }

  async initiativeWithImpact(id: string) {
    const i = await this.prisma.businessInitiative.findUniqueOrThrow({ where: { id } });
    return this.initiativeImpact(i, await this.facilitySeats(i.facilityId));
  }

  private async facilitySeats(facilityId: string) {
    const f = await this.prisma.facility.findUnique({ where: { id: facilityId } });
    return this.seats(facilityId, f?.nbrPlaces || 0);
  }

  async initiativeImpact(
    i: {
      id: string;
      title: string;
      description: string | null;
      category: string;
      startDate: Date;
      endDate: Date | null;
    },
    seats: number,
  ) {
    const now = new Date();
    const start = startOfDay(i.startDate);
    const afterEnd = endOfDay(
      minDate([addDays(start, IMPACT_WINDOW_DAYS - 1), i.endDate || now, now]),
    );
    const daysAfter = Math.max(0, differenceInCalendarDays(afterEnd, start) + 1);
    const base = {
      id: i.id,
      title: i.title,
      description: i.description,
      category: i.category,
      startDate: localDayKey(i.startDate),
      endDate: i.endDate ? localDayKey(i.endDate) : null,
      daysSinceStart: differenceInCalendarDays(now, start),
    };
    if (start > now || daysAfter < 1) return { ...base, impact: null };

    const beforeStart = startOfDay(subDays(start, daysAfter));
    const beforeEnd = endOfDay(subDays(start, 1));
    const [before, after] = await Promise.all([
      this.periodMetrics(beforeStart, beforeEnd, seats),
      this.periodMetrics(start, afterEnd, seats),
    ]);
    const pick = (m: PeriodMetrics) => ({
      visitsPerDay: m.visitsPerDay,
      revenuePerDay: m.revenuePerDay,
      revenueVisits: m.revenueVisits,
      revenueSubscriptions: m.revenueSubscriptions,
      revenueCafe: m.revenueCafe,
      cafeMargin: m.cafeMargin,
      cafeAttachRatePct: m.cafeAttachRatePct,
      avgStayHours: m.avgStayHours,
      avgOccupancyPct: m.avgOccupancyPct,
      newMembers: m.newMembers,
    });
    return {
      ...base,
      impact: {
        comparedDays: daysAfter,
        before: { from: localDayKey(beforeStart), to: localDayKey(beforeEnd), ...pick(before) },
        after: { from: localDayKey(start), to: localDayKey(afterEnd), ...pick(after) },
        changePct: {
          visitsPerDay: change(after.visitsPerDay, before.visitsPerDay),
          revenuePerDay: change(after.revenuePerDay, before.revenuePerDay),
          revenueCafe: change(after.revenueCafe, before.revenueCafe),
          avgStayHours: change(after.avgStayHours, before.avgStayHours),
        },
        extraRevenue: round1(after.revenueTotal - before.revenueTotal),
      },
    };
  }

  private async previousAdvice(facilityId: string) {
    const last = await this.prisma.advisorReport.findFirst({
      where: { facilityId, status: 'DONE' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, result: true },
    });
    const recs = (last?.result as { recommendations?: Array<{ title: string; category: string }> })
      ?.recommendations;
    if (!last || !recs) return null;
    return {
      date: localDayKey(last.createdAt),
      recommendations: recs.map((r) => ({ category: r.category, title: r.title })),
    };
  }
}
