/**
 * Monthly forecast built from the 4 weeks before the month, and the
 * "why the gap" split. Plain TypeScript, no database.
 *
 * Method: each day of the month gets the average of the same weekday over the
 * 28 days before the month (exactly 4 of each weekday). Subscriptions are
 * lumpy, so the host passes one expected amount for the month and it is spread
 * evenly. The band uses the weakest and the strongest of those 4 weeks.
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
  /** Subscription payments */
  subscriptions: number;
};

export type MonthDay = { key: string; weekday: number };

export type ForecastInput = {
  /** The 28 days before the month (fewer = less reliable, still works). */
  base: DayFact[];
  /** Every day of the month to forecast. */
  month: MonthDay[];
  /** Facts for the days of the month already lived (today included if any). */
  actual: DayFact[];
  /** Key of today; days before it count as complete. Absent = month is over. */
  todayKey?: string | null;
  /** Expected subscription money for the whole month. */
  subscriptionsExpected: number;
  /** The previous month's totals, for the "what changes" view. */
  previousMonth?: Totals | null;
};

export type Totals = {
  revenueVisits: number;
  visits: number;
  newVisitors: number;
  products: number;
  subscriptions: number;
};

export type DriverKey = 'newVisitors' | 'otherVisits' | 'ticket' | 'subscriptions' | 'products';

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
  expected: number;
  expectedCum: number;
  lowCum: number;
  highCum: number;
  actual: number | null;
  actualCum: number | null;
  /** Day fully lived (before today) */
  complete: boolean;
};

export type Forecast = {
  baseDays: number;
  perWeekday: Array<{ weekday: number; samples: number; revenueVisits: number; visits: number; newVisitors: number; products: number }>;
  days: ForecastDay[];
  expected: { total: number; low: number; high: number; visits: number; subscriptions: number; products: number; visitCount: number; newVisitors: number };
  /** Ratio of the weakest / strongest base week to the average week. */
  band: { low: number; high: number };
  /** Comparison on complete days; null before the first full day. */
  toDate: null | {
    days: number;
    expected: number;
    actual: number;
    gap: number;
    gapPct: number | null;
    /** Actual so far + expected for the days left */
    projected: number;
    drivers: Driver[];
  };
  /** Previous month vs the expected month. */
  versusPrevious: null | { previousTotal: number; drivers: Driver[] };
  /** Cumulative checkpoints at the end of each week (and month end). */
  checkpoints: Array<{ day: number; key: string; expectedCum: number; actualCum: number | null }>;
};

const r1 = (n: number) => Math.round(n * 10) / 10;
const sum = <T>(rows: T[], f: (r: T) => number) => rows.reduce((a, r) => a + f(r), 0);

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
    blocks.push(sum(base.slice(i, i + 7), (d) => d.revenueVisits + d.products));
  }
  const mean = blocks.length ? sum(blocks, (b) => b) / blocks.length : 0;
  if (blocks.length < 2 || mean <= 0) return { low: 0.85, high: 1.15 };
  // A closed week (0) would make the band useless: keep it within 40 %–200 % of an average week
  return {
    low: Math.max(0.4, Math.min(1, Math.min(...blocks) / mean)),
    high: Math.min(2, Math.max(1, Math.max(...blocks) / mean)),
  };
}

/**
 * Splits a revenue gap into drivers. Visits revenue = visits × ticket, so
 * new-visitor and other-visit effects use the reference ticket and the
 * ticket effect uses the compared visit count: the effects add up exactly.
 */
export function splitGap(ref: Totals, cmp: Totals): Driver[] {
  const refTicket = ref.visits > 0 ? ref.revenueVisits / ref.visits : 0;
  const cmpTicket = cmp.visits > 0 ? cmp.revenueVisits / cmp.visits : refTicket;
  const refOther = ref.visits - ref.newVisitors;
  const cmpOther = cmp.visits - cmp.newVisitors;
  return [
    { key: 'newVisitors', from: r1(ref.newVisitors), to: r1(cmp.newVisitors), effect: r1((cmp.newVisitors - ref.newVisitors) * refTicket) },
    { key: 'otherVisits', from: r1(refOther), to: r1(cmpOther), effect: r1((cmpOther - refOther) * refTicket) },
    { key: 'ticket', from: Math.round(refTicket * 100) / 100, to: Math.round(cmpTicket * 100) / 100, effect: r1(cmp.visits * (cmpTicket - refTicket)) },
    { key: 'subscriptions', from: r1(ref.subscriptions), to: r1(cmp.subscriptions), effect: r1(cmp.subscriptions - ref.subscriptions) },
    { key: 'products', from: r1(ref.products), to: r1(cmp.products), effect: r1(cmp.products - ref.products) },
  ];
}

export function buildForecast(input: ForecastInput): Forecast {
  const avg = weekdayAverages(input.base);
  const band = weekBand(input.base);
  const n = input.month.length || 1;
  const subsPerDay = input.subscriptionsExpected / n;
  const actualByKey = new Map(input.actual.map((d) => [d.key, d]));
  const today = input.todayKey ?? null;

  let expCum = 0;
  let lowCum = 0;
  let highCum = 0;
  let actCum = 0;
  const days: ForecastDay[] = input.month.map((m) => {
    const a = avg[m.weekday];
    const variable = a.revenueVisits + a.products;
    const expected = variable + subsPerDay;
    expCum += expected;
    lowCum += variable * band.low + subsPerDay * 0.6;
    highCum += variable * band.high + subsPerDay * 1.4;
    const lived = today == null || m.key <= today;
    const f = actualByKey.get(m.key);
    const actual = lived ? (f ? f.revenueVisits + f.products + f.subscriptions : 0) : null;
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
    };
  });

  const expTotals = (subset: MonthDay[]): Totals => ({
    revenueVisits: sum(subset, (d) => avg[d.weekday].revenueVisits),
    visits: sum(subset, (d) => avg[d.weekday].visits),
    newVisitors: sum(subset, (d) => avg[d.weekday].newVisitors),
    products: sum(subset, (d) => avg[d.weekday].products),
    subscriptions: subsPerDay * subset.length,
  });
  const month = expTotals(input.month);
  const total = month.revenueVisits + month.products + month.subscriptions;

  const completeDays = input.month.filter((d) => today == null || d.key < today);
  let toDate: Forecast['toDate'] = null;
  if (completeDays.length) {
    const exp = expTotals(completeDays);
    const keys = new Set(completeDays.map((d) => d.key));
    const lived = input.actual.filter((d) => keys.has(d.key));
    const act: Totals = {
      revenueVisits: sum(lived, (d) => d.revenueVisits),
      visits: sum(lived, (d) => d.visits),
      newVisitors: sum(lived, (d) => d.newVisitors),
      products: sum(lived, (d) => d.products),
      subscriptions: sum(lived, (d) => d.subscriptions),
    };
    const e = exp.revenueVisits + exp.products + exp.subscriptions;
    const a = act.revenueVisits + act.products + act.subscriptions;
    toDate = {
      days: completeDays.length,
      expected: r1(e),
      actual: r1(a),
      gap: r1(a - e),
      gapPct: e > 0 ? r1(((a - e) / e) * 100) : null,
      projected: r1(a + (total - e)),
      drivers: splitGap(exp, act),
    };
  }

  const prev = input.previousMonth;
  const versusPrevious = prev
    ? {
        previousTotal: r1(prev.revenueVisits + prev.products + prev.subscriptions),
        drivers: splitGap(prev, month),
      }
    : null;

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
      total: r1(total),
      low: days.length ? days[days.length - 1].lowCum : 0,
      high: days.length ? days[days.length - 1].highCum : 0,
      visits: r1(month.revenueVisits),
      subscriptions: r1(month.subscriptions),
      products: r1(month.products),
      visitCount: r1(month.visits),
      newVisitors: r1(month.newVisitors),
    },
    band: { low: Math.round(band.low * 100) / 100, high: Math.round(band.high * 100) / 100 },
    toDate,
    versusPrevious,
    checkpoints,
  };
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
