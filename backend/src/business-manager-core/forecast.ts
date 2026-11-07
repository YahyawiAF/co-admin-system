/**
 * Monthly forecast and the "why the gap" split. Plain TypeScript, no database.
 *
 * Rules:
 * - Passes and café follow the weekday: each day gets the average of the same
 *   weekday over the weeks before the month, leaving out holidays and periods
 *   (exams, vacations, Ramadan…).
 * - Days inside a calendar period get the effect measured the last times that
 *   kind of period happened. Unknown effect = usual day, wider range.
 * - Abonnements are never spread over days: one expected amount for the month.
 * - The previous month is compared "à calendrier égal": its weekday averages
 *   replayed on this month's days, so 5 Sundays vs 4 is not read as growth.
 */

/** One calendar day of facts. Money in the host currency. */
export type DayFact = {
  /** yyyy-MM-dd (local) */
  key: string;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
  /** Money from visits / passes */
  revenueVisits: number;
  /** Number of visits */
  visits: number;
  /** Visits that were a member's very first one */
  newVisitors: number;
  /** Café / products */
  products: number;
  /** Subscription payments (kept out of daily comparisons) */
  subscriptions: number;
  /** Paid event places (kept out of the passes + café curve) */
  events?: number;
};

export type MonthDay = { key: string; weekday: number };

/** A dated entry of the owner's calendar. `type` groups entries whose effect is learned together. */
export type CalendarEntry = {
  type: string;
  label: string;
  /** yyyy-MM-dd */
  start: string;
  /** yyyy-MM-dd (inclusive, = start for one day) */
  end: string;
  /** Wins when entries overlap (holiday > event > period) */
  priority?: number;
};

/** Measured effect of a type of calendar entry on passes + café. */
export type CalendarEffect = {
  type: string;
  /** 0.6 = 40 % below a usual day */
  factor: number;
  /** Days measured */
  days: number;
  /** Entries measured */
  occurrences: number;
};

/** What the calendar does to one day of the month. */
export type DayFactor = {
  type: string;
  label: string;
  factor: number;
  /** false = never measured: factor 1, wider range */
  known: boolean;
};

export type ForecastInput = {
  /** Usual days before the month (special days left out). */
  base: DayFact[];
  /** Consecutive days for the weakest / strongest week (default: base). */
  bandBase?: DayFact[];
  /** Every day of the month to forecast. */
  month: MonthDay[];
  /** Facts for the days of the month already lived (today included if any). */
  actual: DayFact[];
  /** Key of today; days before it count as complete. Absent = month is over. */
  todayKey?: string | null;
  /** Expected subscription money for the whole month. */
  subscriptionsExpected: number;
  /** Subscription money already paid this month (default: sum of `actual`). */
  subscriptionsActual?: number;
  /** Calendar effect per day key. */
  dayFactors?: Record<string, DayFactor>;
  /** Every day of the previous month, for the "à calendrier égal" comparison. */
  previousMonthDays?: DayFact[] | null;
  /** The previous month's totals, when its days are not given. */
  previousMonth?: Totals | null;
  /**
   * Pass visitors who took an abonnement this month, and the pass visits they
   * would have made on the complete days (their usual pace before converting).
   */
  conversions?: { members: number; toDateVisits: number } | null;
};

export type Totals = {
  revenueVisits: number;
  visits: number;
  newVisitors: number;
  products: number;
  subscriptions: number;
  /** Visits that disappeared because those visitors became abonnés */
  convertedVisits?: number;
  convertedMembers?: number;
};

export type DriverKey =
  | 'calendar'
  | 'periods'
  | 'newVisitors'
  | 'otherVisits'
  | 'conversions'
  | 'ticket'
  | 'subscriptions'
  | 'products'
  /** Passes + café above / below the expected on the days already lived */
  | 'goodStart'
  /** Paid event places */
  | 'events';

export type Driver = {
  key: DriverKey;
  /** Reference value (previous month, or expected to date) */
  from: number;
  /** Compared value (expected month, or actual to date) */
  to: number;
  /** Money this driver adds (+) or removes (−) */
  effect: number;
};

export type ForecastDay = {
  key: string;
  weekday: number;
  /** Passes + café expected */
  expected: number;
  expectedCum: number;
  lowCum: number;
  highCum: number;
  /** Passes + café collected */
  actual: number | null;
  actualCum: number | null;
  /** Day fully lived (before today) */
  complete: boolean;
  /** Calendar entry that changes this day */
  period: { label: string; type: string; factor: number; known: boolean } | null;
};

export type ForecastPeriod = {
  type: string;
  label: string;
  from: string;
  to: string;
  days: number;
  factor: number;
  known: boolean;
  /** Money this period adds (+) or removes (−) vs usual days */
  effect: number;
};

export type Forecast = {
  baseDays: number;
  perWeekday: Array<{ weekday: number; samples: number; revenueVisits: number; visits: number; newVisitors: number; products: number }>;
  days: ForecastDay[];
  expected: {
    /** Passes + café + abonnements */
    total: number;
    low: number;
    high: number;
    /** Passes + café */
    variable: number;
    variableLow: number;
    variableHigh: number;
    visits: number;
    subscriptions: number;
    products: number;
    visitCount: number;
    newVisitors: number;
    /** What calendar periods add or remove vs usual days */
    periodsEffect: number;
  };
  /** Ratio of the weakest / strongest base week to the average week. */
  band: { low: number; high: number };
  periods: ForecastPeriod[];
  /** Passes + café on complete days; null before the first full day. */
  toDate: null | {
    days: number;
    expected: number;
    actual: number;
    gap: number;
    gapPct: number | null;
    /** Passes + café so far + expected for the days left */
    projectedVariable: number;
    /** Abonnements: the larger of paid so far and expected */
    projectedSubscriptions: number;
    projected: number;
    subscriptions: { actual: number; expected: number };
    drivers: Driver[];
    /**
     * « Rythme du mois »: the gap so far also moves the days left, with a
     * weight that grows with the days lived (2 days → 22 %, 14 days → 67 %).
     */
    pace: {
      weight: number;
      multiplier: number;
      projectedVariable: number;
      projected: number;
    };
  };
  /** Previous month vs the expected month. */
  versusPrevious: null | {
    previousTotal: number;
    /** Previous month replayed on this month's weekdays (abonnements as they were) */
    previousAdjusted: number;
    drivers: Driver[];
  };
  /** Cumulative checkpoints at the end of each week (and month end). */
  checkpoints: Array<{ day: number; key: string; expectedCum: number; actualCum: number | null }>;
};

const DAY = 86_400_000;
const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
const sum = <T>(rows: T[], f: (r: T) => number) => rows.reduce((a, r) => a + f(r), 0);
const variable = (d: DayFact) => d.revenueVisits + d.products;

/** yyyy-MM-dd → day number (UTC based, no DST surprises). */
export const dayNumber = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY);
};
export const dayKeyOf = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);
const shiftKey = (key: string, by: number) => dayKeyOf(dayNumber(key) + by);

function keysBetween(start: string, end: string) {
  const a = dayNumber(start);
  const b = Math.max(a, dayNumber(end));
  return Array.from({ length: b - a + 1 }, (_, i) => dayKeyOf(a + i));
}

/** Daily average per weekday of a set of days. */
export function weekdayAverages(base: DayFact[]) {
  return Array.from({ length: 7 }, (_, weekday) => {
    const rows = base.filter((d) => d.weekday === weekday);
    const n = rows.length;
    const avg = (f: (r: DayFact) => number) => (n ? sum(rows, f) / n : 0);
    return {
      weekday,
      samples: n,
      revenueVisits: avg((r) => r.revenueVisits),
      visits: avg((r) => r.visits),
      newVisitors: avg((r) => r.newVisitors),
      products: avg((r) => r.products),
    };
  });
}

/** Weakest and strongest 7-day block of the base, relative to the average block. */
export function weekBand(base: DayFact[]) {
  const blocks: number[] = [];
  for (let i = 0; i + 7 <= base.length; i += 7) {
    blocks.push(sum(base.slice(i, i + 7), variable));
  }
  const mean = blocks.length ? sum(blocks, (b) => b) / blocks.length : 0;
  if (blocks.length < 2 || mean <= 0) return { low: 0.85, high: 1.15 };
  // A closed week (0) would make the band useless: keep it within 40 %–200 % of an average week
  return {
    low: Math.max(0.4, Math.min(1, Math.min(...blocks) / mean)),
    high: Math.min(2, Math.max(1, Math.max(...blocks) / mean)),
  };
}

/** Day keys an entry changes: its days, plus the day before and the day after. */
export function calendarKeys(entries: CalendarEntry[]) {
  const inside = new Set<string>();
  const edges = new Set<string>();
  for (const e of entries) {
    for (const k of keysBetween(e.start, e.end)) inside.add(k);
    edges.add(shiftKey(e.start, -1));
    edges.add(shiftKey(e.end, 1));
  }
  for (const k of inside) edges.delete(k);
  return { inside, edges, all: new Set([...inside, ...edges]) };
}

/**
 * The most recent usual days: up to `perWeekday` of each weekday that are not
 * inside (or right next to) a calendar entry. `days` oldest first.
 */
export function usualDays(days: DayFact[], special: Set<string>, perWeekday = 4) {
  const out: DayFact[] = [];
  const count = new Array(7).fill(0);
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i];
    if (special.has(d.key) || count[d.weekday] >= perWeekday) continue;
    count[d.weekday] += 1;
    out.push(d);
  }
  return out.reverse();
}

/**
 * Effect of each type of calendar entry, from every past occurrence in `history`:
 * passes + café during the entry ÷ the nearest usual same weekdays (up to 4,
 * within 5 weeks). The day before / after an entry is measured as
 * `<type>:before` / `<type>:after`.
 */
export function calendarEffects(history: DayFact[], entries: CalendarEntry[]): Record<string, CalendarEffect> {
  const byKey = new Map(history.map((d) => [d.key, d]));
  const { inside, all } = calendarKeys(entries);
  const usualPool = history.filter((d) => !all.has(d.key)).map((d) => ({ d, n: dayNumber(d.key) }));
  const usualFor = (d: DayFact) => {
    const n = dayNumber(d.key);
    const near = usualPool
      .filter((u) => u.d.weekday === d.weekday && Math.abs(u.n - n) <= 35)
      .sort((a, b) => Math.abs(a.n - n) - Math.abs(b.n - n))
      .slice(0, 4);
    return near.length ? sum(near, (u) => variable(u.d)) / near.length : null;
  };
  const acc = new Map<string, { actual: number; usual: number; days: number; occ: Set<number> }>();
  const add = (type: string, key: string, entry: number) => {
    const d = byKey.get(key);
    if (!d) return;
    const u = usualFor(d);
    if (u == null || u <= 0) return;
    const a = acc.get(type) ?? { actual: 0, usual: 0, days: 0, occ: new Set<number>() };
    a.actual += variable(d);
    a.usual += u;
    a.days += 1;
    a.occ.add(entry);
    acc.set(type, a);
  };
  entries.forEach((e, i) => {
    for (const k of keysBetween(e.start, e.end)) add(e.type, k, i);
    const before = shiftKey(e.start, -1);
    const after = shiftKey(e.end, 1);
    if (!inside.has(before)) add(`${e.type}:before`, before, i);
    if (!inside.has(after)) add(`${e.type}:after`, after, i);
  });
  const out: Record<string, CalendarEffect> = {};
  for (const [type, a] of acc) {
    out[type] = {
      type,
      factor: r2(Math.min(2.5, Math.max(0.2, a.actual / a.usual))),
      days: a.days,
      occurrences: a.occ.size,
    };
  }
  return out;
}

/**
 * Calendar effect for each day of the month. Days inside an entry always get
 * one (unknown when never measured); the day before / after only when measured.
 */
export function dayFactorsFor(
  month: MonthDay[],
  entries: CalendarEntry[],
  effects: Record<string, CalendarEffect>,
): Record<string, DayFactor> {
  const out: Record<string, DayFactor> = {};
  const sorted = [...entries].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  for (const m of month) {
    const n = dayNumber(m.key);
    const e = sorted.find((x) => dayNumber(x.start) <= n && n <= dayNumber(x.end));
    if (e) {
      const eff = effects[e.type];
      out[m.key] = { type: e.type, label: e.label, factor: eff ? eff.factor : 1, known: !!eff };
      continue;
    }
    for (const x of sorted) {
      const before = dayNumber(x.start) - 1 === n ? effects[`${x.type}:before`] : undefined;
      const after = dayNumber(x.end) + 1 === n ? effects[`${x.type}:after`] : undefined;
      const eff = before ?? after;
      if (eff) {
        out[m.key] = { type: eff.type, label: `${before ? 'Veille' : 'Lendemain'} : ${x.label}`, factor: eff.factor, known: true };
        break;
      }
    }
  }
  return out;
}

/** A set of days' weekday averages replayed on another calendar (no subscriptions). */
export function calendarEqual(days: DayFact[], month: MonthDay[]): Totals {
  const avg = weekdayAverages(days);
  return {
    revenueVisits: r1(sum(month, (m) => avg[m.weekday].revenueVisits)),
    visits: r1(sum(month, (m) => avg[m.weekday].visits)),
    newVisitors: r1(sum(month, (m) => avg[m.weekday].newVisitors)),
    products: r1(sum(month, (m) => avg[m.weekday].products)),
    subscriptions: 0,
  };
}

export function totalsOf(days: DayFact[]): Totals {
  return {
    revenueVisits: r1(sum(days, (d) => d.revenueVisits)),
    visits: r1(sum(days, (d) => d.visits)),
    newVisitors: r1(sum(days, (d) => d.newVisitors)),
    products: r1(sum(days, (d) => d.products)),
    subscriptions: r1(sum(days, (d) => d.subscriptions)),
  };
}

/**
 * Splits a revenue gap into drivers. Visits revenue = visits × ticket, so
 * visit effects use the reference ticket and the ticket effect uses the
 * compared visit count: the effects add up exactly. Visits lost because
 * visitors became abonnés (`convertedVisits`) are shown apart, not as
 * "regulars came less".
 */
export function splitGap(ref: Totals, cmp: Totals, opts: { subscriptions?: boolean } = {}): Driver[] {
  const refTicket = ref.visits > 0 ? ref.revenueVisits / ref.visits : 0;
  const cmpTicket = cmp.visits > 0 ? cmp.revenueVisits / cmp.visits : refTicket;
  const refOther = ref.visits - ref.newVisitors;
  const cmpOther = cmp.visits - cmp.newVisitors;
  const conv = Math.max(0, cmp.convertedVisits ?? 0);
  const out: Driver[] = [
    { key: 'newVisitors', from: r1(ref.newVisitors), to: r1(cmp.newVisitors), effect: r1((cmp.newVisitors - ref.newVisitors) * refTicket) },
    { key: 'otherVisits', from: r1(refOther), to: r1(cmpOther), effect: r1((cmpOther + conv - refOther) * refTicket) },
  ];
  if (conv > 0) {
    out.push({ key: 'conversions', from: 0, to: cmp.convertedMembers ?? 0, effect: r1(-conv * refTicket) });
  }
  out.push({ key: 'ticket', from: r2(refTicket), to: r2(cmpTicket), effect: r1(cmp.visits * (cmpTicket - refTicket)) });
  if (opts.subscriptions !== false) {
    out.push({ key: 'subscriptions', from: r1(ref.subscriptions), to: r1(cmp.subscriptions), effect: r1(cmp.subscriptions - ref.subscriptions) });
  }
  out.push({ key: 'products', from: r1(ref.products), to: r1(cmp.products), effect: r1(cmp.products - ref.products) });
  return out;
}

/**
 * How much the gap on the days lived moves the days left: weight = days ÷
 * (days + 7), so one good weekend barely counts and two good weeks count a lot.
 * The multiplier stays within 50 %–150 %.
 */
export function paceOf(daysLived: number, expected: number, actual: number) {
  const weight = daysLived > 0 ? daysLived / (daysLived + 7) : 0;
  if (!(expected > 0)) return { weight, multiplier: 1 };
  const multiplier = Math.max(0.5, Math.min(1.5, 1 + ((actual - expected) / expected) * weight));
  return { weight, multiplier };
}

export function buildForecast(input: ForecastInput): Forecast {
  const avg = weekdayAverages(input.base);
  const band = weekBand(input.bandBase ?? input.base);
  const factors = input.dayFactors ?? {};
  const subsExp = input.subscriptionsExpected;
  const actualByKey = new Map(input.actual.map((d) => [d.key, d]));
  const today = input.todayKey ?? null;
  const mult = (key: string) => factors[key]?.factor ?? 1;

  let expCum = 0;
  let lowCum = 0;
  let highCum = 0;
  let actCum = 0;
  const days: ForecastDay[] = input.month.map((m) => {
    const a = avg[m.weekday];
    const f = factors[m.key];
    const expected = (a.revenueVisits + a.products) * mult(m.key);
    const unknown = f && !f.known;
    expCum += expected;
    lowCum += expected * band.low * (unknown ? 0.6 : 1);
    highCum += expected * band.high * (unknown ? 1.25 : 1);
    const lived = today == null || m.key <= today;
    const fact = actualByKey.get(m.key);
    const actual = lived ? (fact ? variable(fact) : 0) : null;
    if (actual != null) actCum += actual;
    return {
      key: m.key,
      weekday: m.weekday,
      expected: r1(expected),
      expectedCum: r1(expCum),
      lowCum: r1(lowCum),
      highCum: r1(highCum),
      actual: actual == null ? null : r1(actual),
      actualCum: actual == null ? null : r1(actCum),
      complete: today == null || m.key < today,
      period: f ? { label: f.label, type: f.type, factor: f.factor, known: f.known } : null,
    };
  });

  /** Expected passes + café on a set of days (no abonnements). */
  const expTotals = (subset: MonthDay[], withFactors = true): Totals => {
    const k = (d: MonthDay) => (withFactors ? mult(d.key) : 1);
    return {
      revenueVisits: sum(subset, (d) => avg[d.weekday].revenueVisits * k(d)),
      visits: sum(subset, (d) => avg[d.weekday].visits * k(d)),
      newVisitors: sum(subset, (d) => avg[d.weekday].newVisitors * k(d)),
      products: sum(subset, (d) => avg[d.weekday].products * k(d)),
      subscriptions: 0,
    };
  };
  const month = expTotals(input.month);
  const monthUsual = expTotals(input.month, false);
  const variableTotal = month.revenueVisits + month.products;
  const variableUsual = monthUsual.revenueVisits + monthUsual.products;
  const variableLow = days.length ? days[days.length - 1].lowCum : 0;
  const variableHigh = days.length ? days[days.length - 1].highCum : 0;

  // Periods: consecutive days with the same calendar label
  const periods: ForecastPeriod[] = [];
  for (const d of days) {
    if (!d.period) continue;
    const usual = d.expected / (d.period.factor || 1);
    const last = periods[periods.length - 1];
    if (last && last.label === d.period.label && dayNumber(last.to) + 1 === dayNumber(d.key)) {
      last.to = d.key;
      last.days += 1;
      last.effect = r1(last.effect + d.expected - usual);
    } else {
      periods.push({
        type: d.period.type,
        label: d.period.label,
        from: d.key,
        to: d.key,
        days: 1,
        factor: d.period.factor,
        known: d.period.known,
        effect: r1(d.expected - usual),
      });
    }
  }

  const completeDays = input.month.filter((d) => today == null || d.key < today);
  const monthKeys = new Set(input.month.map((d) => d.key));
  const subsActual =
    input.subscriptionsActual ?? sum(input.actual.filter((d) => monthKeys.has(d.key)), (d) => d.subscriptions);
  let toDate: Forecast['toDate'] = null;
  if (completeDays.length) {
    const exp = expTotals(completeDays);
    const keys = new Set(completeDays.map((d) => d.key));
    const lived = input.actual.filter((d) => keys.has(d.key));
    const act: Totals = {
      ...totalsOf(lived),
      subscriptions: 0,
      convertedVisits: input.conversions?.toDateVisits ?? 0,
      convertedMembers: input.conversions?.members ?? 0,
    };
    const e = exp.revenueVisits + exp.products;
    const a = act.revenueVisits + act.products;
    const projectedVariable = a + (variableTotal - e);
    const projectedSubscriptions = Math.max(subsActual, subsExp);
    const pace = paceOf(completeDays.length, e, a);
    const paceVariable = a + (variableTotal - e) * pace.multiplier;
    toDate = {
      days: completeDays.length,
      expected: r1(e),
      actual: r1(a),
      gap: r1(a - e),
      gapPct: e > 0 ? r1(((a - e) / e) * 100) : null,
      projectedVariable: r1(projectedVariable),
      projectedSubscriptions: r1(projectedSubscriptions),
      projected: r1(projectedVariable + projectedSubscriptions),
      subscriptions: { actual: r1(subsActual), expected: r1(subsExp) },
      drivers: splitGap(exp, act, { subscriptions: false }),
      pace: {
        weight: r2(pace.weight),
        multiplier: r2(pace.multiplier),
        projectedVariable: r1(paceVariable),
        projected: r1(paceVariable + projectedSubscriptions),
      },
    };
  }

  let versusPrevious: Forecast['versusPrevious'] = null;
  const monthWithSubs: Totals = { ...month, subscriptions: subsExp };
  if (input.previousMonthDays?.length) {
    const raw = totalsOf(input.previousMonthDays);
    const adj: Totals = { ...calendarEqual(input.previousMonthDays, input.month), subscriptions: raw.subscriptions };
    const rawVar = raw.revenueVisits + raw.products;
    const adjVar = adj.revenueVisits + adj.products;
    const usual: Totals = { ...monthUsual, subscriptions: subsExp };
    const drivers: Driver[] = [{ key: 'calendar', from: r1(rawVar), to: r1(adjVar), effect: r1(adjVar - rawVar) }];
    if (Object.keys(factors).length) {
      drivers.push({ key: 'periods', from: r1(variableUsual), to: r1(variableTotal), effect: r1(variableTotal - variableUsual) });
    }
    drivers.push(...splitGap(adj, usual));
    versusPrevious = {
      previousTotal: r1(rawVar + raw.subscriptions),
      previousAdjusted: r1(adjVar + adj.subscriptions),
      drivers,
    };
  } else if (input.previousMonth) {
    const prev = input.previousMonth;
    const total = r1(prev.revenueVisits + prev.products + prev.subscriptions);
    versusPrevious = { previousTotal: total, previousAdjusted: total, drivers: splitGap(prev, monthWithSubs) };
  }

  // Day 7, 14, 21 and month end (day 28 too when it is not 1–2 days before the end)
  const marks = [7, 14, 21, 28].filter((d) => d < days.length && days.length - d >= 3);
  const checkpoints = [...marks, days.length]
    .filter((d) => d >= 1)
    .map((day) => {
      const d = days[day - 1];
      return { day, key: d.key, expectedCum: d.expectedCum, actualCum: d.complete ? d.actualCum : null };
    });

  return {
    baseDays: input.base.length,
    perWeekday: avg.map((a) => ({
      weekday: a.weekday,
      samples: a.samples,
      revenueVisits: r1(a.revenueVisits),
      visits: r1(a.visits),
      newVisitors: r1(a.newVisitors),
      products: r1(a.products),
    })),
    days,
    expected: {
      total: r1(variableTotal + subsExp),
      low: r1(variableLow + subsExp * 0.6),
      high: r1(variableHigh + subsExp * 1.4),
      variable: r1(variableTotal),
      variableLow: r1(variableLow),
      variableHigh: r1(variableHigh),
      visits: r1(month.revenueVisits),
      subscriptions: r1(subsExp),
      products: r1(month.products),
      visitCount: r1(month.visits),
      newVisitors: r1(month.newVisitors),
      periodsEffect: r1(variableTotal - variableUsual),
    },
    band: { low: r2(band.low), high: r2(band.high) },
    periods,
    toDate,
    versusPrevious,
    checkpoints,
  };
}

/**
 * Share of the month's usual passes + café expected by a point in the month:
 * complete days count fully, today by the part of opening hours gone.
 * Used to pace a monthly target by weekday instead of by calendar days.
 */
export function expectedShare(days: ForecastDay[], todayKey: string | null, todayDone: number) {
  const total = sum(days, (d) => d.expected);
  if (total <= 0) return null;
  let part = 0;
  for (const d of days) {
    if (todayKey == null || d.key < todayKey) part += d.expected;
    else if (d.key === todayKey) part += d.expected * Math.max(0, Math.min(1, todayDone));
  }
  return part / total;
}

export type ChangeMetric = 'newVisitors' | 'visits';

export type DetectedChange = {
  metric: ChangeMetric;
  direction: 'up' | 'down';
  /** First and last day of the 7-day window */
  from: string;
  to: string;
  actual: number;
  expected: number;
  changePct: number;
};

/**
 * Last 7 complete days against the same weekdays of the 28 days before.
 * `days` must be consecutive and end with the last complete day (35 ideally).
 */
export function detectChanges(
  days: DayFact[],
  opts: { minPct?: number; minAbs?: Partial<Record<ChangeMetric, number>> } = {},
): DetectedChange[] {
  if (days.length < 14) return [];
  const minPct = opts.minPct ?? 25;
  const minAbs = { newVisitors: 5, visits: 10, ...opts.minAbs };
  const window = days.slice(-7);
  const avg = weekdayAverages(days.slice(0, -7).slice(-28));
  const out: DetectedChange[] = [];
  for (const metric of ['newVisitors', 'visits'] as ChangeMetric[]) {
    const actual = sum(window, (d) => d[metric]);
    const expected = sum(window, (d) => avg[d.weekday][metric]);
    if (expected <= 0) continue;
    const pct = ((actual - expected) / expected) * 100;
    if (Math.abs(pct) >= minPct && Math.abs(actual - expected) >= minAbs[metric]) {
      out.push({
        metric,
        direction: pct > 0 ? 'up' : 'down',
        from: window[0].key,
        to: window[window.length - 1].key,
        actual: r1(actual),
        expected: r1(expected),
        changePct: Math.round(pct),
      });
    }
  }
  return out;
}
