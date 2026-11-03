/**
 * Data shared by the Finance overview, the forecast and the Conseiller:
 * daily facts, abonnements (renewals, the month's block), the owner's calendar
 * and the month forecast. Plain functions over Prisma so both services can use
 * them without depending on each other.
 */
import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  format,
  getDaysInMonth,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import type { PrismaService } from 'database/prisma.service';
import { localDayKey } from '../../../common/parse-local-day';
import { orderUnitPrice } from '../product/order-price';
import {
  buildForecast,
  calendarEffects,
  calendarKeys,
  dayFactorsFor,
  usualDays,
  type CalendarEntry,
  type DayFact,
} from '../../business-manager-core';

const DAY_MS = 86_400_000;
const r1 = (n: number) => Math.round(n * 10) / 10;
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);

// ---------------------------------------------------------------------------
// Daily facts
// ---------------------------------------------------------------------------

/** One row per calendar day in [from, to], same money rules as the Finance overview. */
export async function loadDayFacts(prisma: PrismaService, from: Date, to: Date): Promise<DayFact[]> {
  const start = startOfDay(from);
  const end = endOfDay(to);
  const [paid, visits, firsts, subs, products] = await Promise.all([
    prisma.journal.findMany({
      where: { registredTime: { gte: start, lte: end }, isPayed: true },
      select: { registredTime: true, payedAmount: true },
    }),
    prisma.journal.findMany({
      where: { registredTime: { gte: start, lte: end }, isReservation: false },
      select: { registredTime: true },
    }),
    prisma.journal.groupBy({
      by: ['memberID'],
      where: { memberID: { not: null }, isReservation: false, hiddenAt: null },
      _min: { registredTime: true },
    }),
    prisma.abonnementPayment.findMany({
      where: { paidAt: { gte: start, lte: end } },
      select: { paidAt: true, amount: true },
    }),
    prisma.dailyProduct.findMany({
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

// ---------------------------------------------------------------------------
// Abonnements
// ---------------------------------------------------------------------------

export type AboRow = {
  id: string;
  memberID: string;
  registredDate: Date;
  leaveDate: Date | null;
  createdAt: Date | null;
  payedAmount: number;
  listPrice: number | null;
  amountDue: number | null;
  terminatedAt: Date | null;
  priceId: string;
  serviceName: string | null;
  priceName: string;
  memberName: string;
};

export async function loadAbonnements(prisma: PrismaService): Promise<AboRow[]> {
  const rows = await prisma.abonnement.findMany({
    where: { isReservation: false, hiddenAt: null },
    select: {
      id: true,
      memberID: true,
      registredDate: true,
      leaveDate: true,
      createdAt: true,
      payedAmount: true,
      listPrice: true,
      amountDue: true,
      terminatedAt: true,
      priceId: true,
      serviceName: true,
      price: { select: { name: true } },
      members: { select: { firstName: true, lastName: true } },
    },
    orderBy: { registredDate: 'asc' },
  });
  return rows.map(({ price, members, ...a }) => ({
    ...a,
    priceName: a.serviceName || price?.name || 'Abonnement',
    memberName: [members?.firstName, members?.lastName].filter(Boolean).join(' ') || 'Client',
  }));
}

/** Price of an abonnement (after discounts when known). */
export const aboPrice = (a: AboRow) => a.amountDue ?? a.listPrice ?? a.payedAmount ?? 0;

/** Abonnements per member, oldest first. */
export function byMember(abos: AboRow[]) {
  const map = new Map<string, AboRow[]>();
  for (const a of abos) map.set(a.memberID, [...(map.get(a.memberID) ?? []), a]);
  return map;
}

/**
 * The renewal of an abonnement: the member's next abonnement starting after it
 * started and at most 14 days after it ended. Any offer counts (a change of
 * plan is still a renewal); an early renewal counts too.
 */
export function renewalOf(a: AboRow, members: Map<string, AboRow[]>): AboRow | null {
  if (!a.leaveDate) return null;
  const limit = a.leaveDate.getTime() + 14 * DAY_MS;
  return (
    (members.get(a.memberID) ?? []).find(
      (b) => b.id !== a.id && b.registredDate > a.registredDate && b.registredDate.getTime() <= limit,
    ) ?? null
  );
}

const sameOffer = (a: AboRow, b: AboRow) => a.priceId === b.priceId;

/** Abonnements that ended in [from, to] and were not stopped by the owner. */
const endedIn = (abos: AboRow[], from: Date, to: Date) =>
  abos.filter((a) => a.leaveDate && a.leaveDate >= from && a.leaveDate <= to && !a.terminatedAt);

function renewalStats(ended: AboRow[], members: Map<string, AboRow[]>) {
  const renewed = ended.filter((a) => renewalOf(a, members));
  const otherOffer = renewed.filter((a) => !sameOffer(a, renewalOf(a, members)!));
  return { ended: ended.length, renewed: renewed.length, otherOffer: otherOffer.length, ratePct: pct(renewed.length, ended.length) };
}

/**
 * Abonnements expected in a month: those ending in it × the renewal rate, plus
 * new subscribers at the pace of the 4 weeks before. The rate is last month's;
 * with few abonnements it takes the lower of last month and all history.
 */
export function subscriptionsOutlook(abos: AboRow[], monthStart: Date) {
  const monthEnd = endOfMonth(monthStart);
  const prevStart = startOfMonth(subMonths(monthStart, 1));
  const prevEnd = endOfMonth(prevStart);
  const members = byMember(abos);
  const renewed = (a: AboRow) => !!renewalOf(a, members);

  const endedPrev = endedIn(abos, prevStart, prevEnd);
  const lastPct = endedPrev.length >= 3 ? pct(endedPrev.filter(renewed).length, endedPrev.length) : null;
  // All history: abonnements that ended at least 14 days before the month (time to renew)
  const endedBefore = abos.filter((a) => a.leaveDate && a.leaveDate < subDays(monthStart, 14) && !a.terminatedAt);
  const historyPct = endedBefore.length >= 3 ? pct(endedBefore.filter(renewed).length, endedBefore.length) : null;
  let renewalRatePct: number | null;
  let renewalRateSource: 'LAST_MONTH' | 'CAREFUL' | 'HISTORY' | 'ASSUMED';
  if (lastPct != null && endedPrev.length < 8 && historyPct != null && historyPct < lastPct) {
    renewalRatePct = historyPct;
    renewalRateSource = 'CAREFUL';
  } else if (lastPct != null) {
    renewalRatePct = lastPct;
    renewalRateSource = 'LAST_MONTH';
  } else if (historyPct != null) {
    renewalRatePct = historyPct;
    renewalRateSource = 'HISTORY';
  } else {
    renewalRatePct = null;
    renewalRateSource = 'ASSUMED';
  }

  // Ending this month, unless already renewed well before the month (paid then)
  const ending = endedIn(abos, monthStart, monthEnd).filter((a) => {
    const next = renewalOf(a, members);
    return !next || next.registredDate >= subDays(monthStart, 7);
  });
  const endingValue = r1(ending.reduce((s, a) => s + aboPrice(a), 0));

  // First abonnement of a member, started in the 28 days before the month
  const baseFrom = subDays(monthStart, 28);
  const firstAbos = abos.filter((a) => {
    const list = members.get(a.memberID) ?? [];
    return list[0]?.id === a.id && a.registredDate >= baseFrom && a.registredDate < monthStart;
  });
  const newPace = r1((firstAbos.reduce((s, a) => s + aboPrice(a), 0) / 28) * getDaysInMonth(monthStart));
  const rate = renewalRatePct ?? 40;
  const renewals = r1((endingValue * rate) / 100);
  const recent = abos.slice(-30);
  const avgPrice = recent.length ? r1(recent.reduce((s, a) => s + aboPrice(a), 0) / recent.length) : 0;
  return {
    expected: r1(renewals + newPace),
    endingCount: ending.length,
    endingValue,
    renewalRatePct,
    renewalRateAssumed: renewalRatePct == null,
    renewalRateSource,
    lastMonthRatePct: lastPct,
    historyRatePct: historyPct,
    renewals,
    newPace,
    newCount: firstAbos.length,
    avgPrice,
  };
}

/** Recent renewals (newest first), with the offer before and after. */
export function recentRenewals(abos: AboRow[], since: Date) {
  const members = byMember(abos);
  const out: Array<{ memberId: string; name: string; from: string; to: string; sameOffer: boolean; on: string; renewalId: string }> = [];
  for (const a of abos) {
    const next = renewalOf(a, members);
    if (!next) continue;
    const on = next.createdAt ?? next.registredDate;
    if (on < since) continue;
    out.push({
      memberId: a.memberID,
      name: a.memberName,
      from: a.priceName,
      to: next.priceName,
      sameOffer: sameOffer(a, next),
      on: localDayKey(on),
      renewalId: next.id,
    });
  }
  // One line per renewal (a member with overlapping abonnements could match twice)
  const seen = new Set<string>();
  return out
    .filter((r) => (seen.has(r.renewalId) ? false : (seen.add(r.renewalId), true)))
    .sort((a, b) => b.on.localeCompare(a.on));
}

/** Money of the abonnements spread over the days they cover, inside [from, to]. */
function earnedIn(abos: AboRow[], from: Date, to: Date) {
  let total = 0;
  for (const a of abos) {
    const end = a.terminatedAt && (!a.leaveDate || a.terminatedAt < a.leaveDate) ? a.terminatedAt : a.leaveDate;
    if (!end) continue;
    const covered = Math.max(1, differenceInCalendarDays(end, a.registredDate) + 1);
    const s = a.registredDate > from ? a.registredDate : from;
    const e = end < to ? end : to;
    const overlap = differenceInCalendarDays(e, s) + 1;
    if (overlap > 0) total += (aboPrice(a) * Math.min(overlap, covered)) / covered;
  }
  return r1(total);
}

/**
 * The month's abonnements, as totals (never by day): active abonnés, new ones,
 * renewals of the abonnements that ended last month, conversions from passes,
 * money paid and money earned (spread over the days covered).
 */
export async function abonnementMonth(prisma: PrismaService, abos: AboRow[], year: number, month: number, now = new Date()) {
  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(monthStart);
  const isCurrent = now >= monthStart && now <= monthEnd;
  if (monthStart > now) return null;
  const point = isCurrent ? now : monthEnd;
  const prevStart = startOfMonth(subMonths(monthStart, 1));
  const prevEnd = endOfMonth(prevStart);
  const prevPoint = isCurrent ? new Date(Math.min(subMonths(point, 1).getTime(), prevEnd.getTime())) : prevEnd;
  const members = byMember(abos);

  const activeAt = (at: Date) =>
    new Set(
      abos
        .filter(
          (a) =>
            a.registredDate <= at &&
            (!a.leaveDate || a.leaveDate >= startOfDay(at)) &&
            !(a.terminatedAt && a.terminatedAt <= at),
        )
        .map((a) => a.memberID),
    ).size;
  const firsts = (from: Date, to: Date) =>
    abos.filter((a) => (members.get(a.memberID) ?? [])[0]?.id === a.id && a.registredDate >= from && a.registredDate <= to);

  // Renewals of what ended last month (and the month before, to compare)
  const lastMonth = renewalStats(endedIn(abos, prevStart, prevEnd), members);
  const ppStart = startOfMonth(subMonths(monthStart, 2));
  const monthBefore = renewalStats(endedIn(abos, ppStart, endOfMonth(ppStart)), members);
  const notRenewed = endedIn(abos, prevStart, prevEnd)
    .filter((a) => !renewalOf(a, members))
    .map((a) => ({ memberId: a.memberID, name: a.memberName, plan: a.priceName, endedOn: localDayKey(a.leaveDate!) }));

  // This month so far
  const endedSoFar = endedIn(abos, monthStart, point);
  const thisMonth = renewalStats(endedSoFar, members);
  const stillToEnd = endedIn(abos, new Date(point.getTime() + 1), monthEnd).length;

  // Conversions: first abonnement this month after at least one pass visit
  const newOnes = firsts(monthStart, point);
  const before = newOnes.length
    ? await prisma.journal.groupBy({
        by: ['memberID'],
        where: { memberID: { in: newOnes.map((a) => a.memberID) }, isReservation: false, registredTime: { lt: point } },
        _min: { registredTime: true },
      })
    : [];
  const firstVisit = new Map(before.map((b) => [b.memberID!, b._min.registredTime]));
  const conversions = newOnes
    .filter((a) => {
      const v = firstVisit.get(a.memberID);
      return v && v < a.registredDate;
    })
    .map((a) => ({ memberId: a.memberID, name: a.memberName, plan: a.priceName, on: localDayKey(a.registredDate) }));

  const [paid, paidPrev] = await Promise.all([
    prisma.abonnementPayment.aggregate({ where: { paidAt: { gte: monthStart, lte: point } }, _sum: { amount: true } }),
    prisma.abonnementPayment.aggregate({ where: { paidAt: { gte: prevStart, lte: prevPoint } }, _sum: { amount: true } }),
  ]);

  return {
    point: point.toISOString(),
    previousPoint: prevPoint.toISOString(),
    active: { now: activeAt(point), previous: activeAt(prevPoint) },
    newSubscribers: { now: newOnes.length, previous: firsts(prevStart, prevPoint).length },
    /** Abonnements that ended last month: renewed X of Y */
    renewedFromLastMonth: { ...lastMonth, previousRatePct: monthBefore.ratePct, notRenewed: notRenewed.slice(0, 20) },
    /** Abonnements ending this month so far */
    thisMonth: { ...thisMonth, stillToEnd },
    conversions,
    money: {
      paid: r1(paid._sum.amount ?? 0),
      paidPrevious: r1(paidPrev._sum.amount ?? 0),
      earned: earnedIn(abos, monthStart, point),
      earnedPrevious: earnedIn(abos, prevStart, prevPoint),
    },
  };
}

// ---------------------------------------------------------------------------
// Calendar (Conseiller IA → Contexte → Calendrier)
// ---------------------------------------------------------------------------

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * Holidays, periods and local events. Public holidays share one learned
 * effect; periods are grouped by tag (exams, vacation, ramadan), other
 * periods and events by name so a yearly one learns from the last time.
 */
export async function loadCalendar(prisma: PrismaService, facilityId: string): Promise<CalendarEntry[]> {
  const facts = await prisma.advisorFact.findMany({
    where: { facilityId, kind: { in: ['HOLIDAY', 'PERIOD', 'LOCAL_EVENT'] }, startDate: { not: null } },
    select: { kind: true, tag: true, title: true, startDate: true, endDate: true },
  });
  return facts.map((f) => {
    const start = localDayKey(f.startDate!);
    const end = f.endDate && f.endDate > f.startDate! ? localDayKey(f.endDate) : start;
    if (f.kind === 'HOLIDAY') return { type: 'holiday', label: f.title, start, end, priority: 3 };
    if (f.kind === 'LOCAL_EVENT') return { type: `event:${slug(f.title)}`, label: f.title, start, end, priority: 2 };
    const tag = f.tag && f.tag !== 'other' ? f.tag : `period:${slug(f.title)}`;
    return { type: tag, label: f.title, start, end, priority: 1 };
  });
}

export const CALENDAR_TYPE_LABEL: Record<string, string> = {
  holiday: 'Jours fériés',
  exams: 'Examens',
  vacation: 'Vacances',
  ramadan: 'Ramadan',
};

// ---------------------------------------------------------------------------
// Month forecast
// ---------------------------------------------------------------------------

const cache = new Map<string, { at: number; value: Promise<MonthForecastResult> }>();
const CACHE_MS = 60_000;

export type MonthForecastResult = Awaited<ReturnType<typeof computeMonthForecastUncached>>;

/** Same month asked twice within a minute (overview + forecast block) is computed once. */
export function computeMonthForecast(prisma: PrismaService, facilityId: string, year: number, month: number, now = new Date()) {
  const key = `${facilityId}:${year}-${month}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = computeMonthForecastUncached(prisma, facilityId, year, month, now);
  cache.set(key, { at: Date.now(), value });
  value.catch(() => cache.delete(key));
  return value;
}

async function computeMonthForecastUncached(prisma: PrismaService, facilityId: string, year: number, month: number, now: Date) {
  const start = startOfMonth(new Date(year, month - 1, 1));
  const end = endOfMonth(start);
  const isCurrent = now >= start && now <= end;
  const isFuture = start > now;
  const prevStart = startOfMonth(subMonths(start, 1));
  const yesterday = subDays(startOfDay(now), 1);
  // Effects are learned on up to a year of lived days (this month's lived days included)
  const historyTo = isFuture || isCurrent ? yesterday : end;
  const historyFrom = subDays(start, 365);

  const [history, actual, abos, calendar, bookings, bookingsPrev] = await Promise.all([
    loadDayFacts(prisma, historyFrom, historyTo),
    isFuture ? Promise.resolve([] as DayFact[]) : loadDayFacts(prisma, start, isCurrent ? now : end),
    loadAbonnements(prisma),
    loadCalendar(prisma, facilityId),
    prisma.bookingRequest.count({
      where: { date: { gte: start, lte: end }, status: { not: 'REJECTED' }, cancelledAt: null, createdAt: { lte: now } },
    }),
    prisma.bookingRequest.count({
      where: {
        date: { gte: prevStart, lte: endOfMonth(prevStart) },
        status: { not: 'REJECTED' },
        cancelledAt: null,
        createdAt: { lte: subMonths(now, 1) },
      },
    }),
  ]);

  const startKey = localDayKey(start);
  const before = history.filter((d) => d.key < startKey);
  const { all: special } = calendarKeys(calendar);
  const base = usualDays(before.slice(-56), special, 4);
  const bandBase = before.slice(-28);
  const monthDays = Array.from({ length: getDaysInMonth(start) }, (_, i) => {
    const d = addDays(start, i);
    return { key: localDayKey(d), weekday: d.getDay() };
  });
  const effects = calendarEffects(history, calendar);
  const dayFactors = dayFactorsFor(monthDays, calendar, effects);
  const prevKey = localDayKey(prevStart);
  const previousMonthDays = history.filter((d) => d.key >= prevKey && d.key < startKey);
  const subs = subscriptionsOutlook(abos, start);

  // Pass visitors who took their first abonnement this month: the pass visits
  // they would have made on the complete days since (their pace in the base)
  const todayKey = isCurrent ? localDayKey(now) : isFuture ? startKey : null;
  const members = byMember(abos);
  const converters = abos.filter((a) => {
    const first = (members.get(a.memberID) ?? [])[0];
    return first?.id === a.id && a.registredDate >= start && a.registredDate <= (isCurrent ? now : end);
  });
  let conversions: { members: number; toDateVisits: number } | null = null;
  if (converters.length && !isFuture) {
    const baseFrom = subDays(start, 28);
    const visits = await prisma.journal.findMany({
      where: { memberID: { in: converters.map((a) => a.memberID) }, isReservation: false, registredTime: { gte: baseFrom, lt: start } },
      select: { memberID: true },
    });
    let lost = 0;
    let who = 0;
    for (const a of converters) {
      const n = visits.filter((v) => v.memberID === a.memberID).length;
      if (!n) continue;
      who += 1;
      const fromKey = localDayKey(a.registredDate);
      const days = monthDays.filter((d) => d.key >= fromKey && (todayKey == null || d.key < todayKey)).length;
      lost += (n / 28) * days;
    }
    if (who) conversions = { members: who, toDateVisits: r1(lost) };
  }

  const subsActual = actual.reduce((a, d) => a + d.subscriptions, 0);
  const f = buildForecast({
    base,
    bandBase,
    month: monthDays,
    actual,
    todayKey,
    subscriptionsExpected: subs.expected,
    subscriptionsActual: subsActual,
    dayFactors,
    previousMonthDays,
    conversions,
  });

  const monthTypes = new Set(Object.values(dayFactors).map((x) => x.type));
  return {
    period: {
      year,
      month,
      label: format(start, 'MMMM yyyy', { locale: fr }),
      previousLabel: format(prevStart, 'MMMM', { locale: fr }),
      isCurrent,
      isFuture,
      base: { from: base[0]?.key ?? localDayKey(subDays(start, 28)), to: localDayKey(subDays(start, 1)), days: base.length },
    },
    subscriptions: subs,
    calendar: {
      effects: Object.values(effects)
        .filter((e) => monthTypes.has(e.type))
        .map((e) => ({ ...e, label: CALENDAR_TYPE_LABEL[e.type] ?? calendar.find((c) => c.type === e.type.split(':')[0])?.label ?? e.type })),
      entriesInMonth: calendar.filter((c) => c.end >= startKey && c.start <= localDayKey(end)),
    },
    bookings: { thisMonth: bookings, lastMonthSamePoint: bookingsPrev },
    conversionsToDate: conversions,
    ...f,
  };
}
