/**
 * The month forecast split by source, day by day: each tarif, café, abonnements
 * and events. Plain functions, no database.
 *
 * - Tarifs and café follow the weekday, like the main forecast: average of the
 *   same weekday over the base days × the calendar factor of the day.
 * - Abonnements are placed on the day the current ones end (when a renewal is
 *   paid), plus new abonnés spread over the month. The days left share what is
 *   still expected (expected for the month − already paid).
 * - Events: places registered for an event of the month and not paid yet, on
 *   the event's day.
 * - `previous`: last month. Tarifs and café replayed on this month's weekdays,
 *   abonnements and events at the same date.
 */
import type { DayFact, DayFactor, MonthDay } from '../../business-manager-core';

export type SourceKind = 'tarif' | 'cafe' | 'abos' | 'events';
export type SourceDef = { key: string; label: string; kind: SourceKind };
export type SourceDay = {
  key: string;
  weekday: number;
  /** Expected without the « rythme du mois » */
  expected: Record<string, number>;
  /** Money collected (days lived, today included); null for the days to come */
  actual: Record<string, number> | null;
  /** Day fully lived (before today) */
  complete: boolean;
  /** Last month: same weekday (tarifs, café) or same date (abonnements, events) */
  previous: Record<string, number>;
};

export type SourcesInput = {
  month: MonthDay[];
  todayKey: string | null;
  base: DayFact[];
  dayFactors: Record<string, DayFactor>;
  actual: DayFact[];
  previousMonthDays: DayFact[];
  /** Passes per day and per tarif id, covering base, previous month and this month */
  tarifDays: Map<string, Record<string, number>>;
  tarifNames: Map<string, string>;
  subscriptions: { expected: number; newPace: number; endingDays: Array<{ key: string; value: number }> };
  /** Event places not paid yet, by event day */
  eventsUpcoming: Array<{ key: string; value: number }>;
};

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Average per weekday of `pick` over `days`. */
function weekdayAvg(days: DayFact[], pick: (d: DayFact) => Record<string, number>) {
  return Array.from({ length: 7 }, (_, wd) => {
    const rows = days.filter((d) => d.weekday === wd);
    const out: Record<string, number> = {};
    for (const d of rows) for (const [k, v] of Object.entries(pick(d))) out[k] = (out[k] ?? 0) + v;
    for (const k of Object.keys(out)) out[k] = rows.length ? out[k] / rows.length : 0;
    return out;
  });
}

export function buildSources(input: SourcesInput) {
  const { month, todayKey } = input;
  const tarifOf = (d: DayFact) => {
    const m = input.tarifDays.get(d.key) ?? {};
    const out: Record<string, number> = { cafe: d.products };
    for (const [id, v] of Object.entries(m)) out[`tarif:${id}`] = v;
    return out;
  };
  const baseAvg = weekdayAvg(input.base, tarifOf);
  const prevAvg = weekdayAvg(input.previousMonthDays, tarifOf);
  const actualByKey = new Map(input.actual.map((d) => [d.key, d]));
  const isFuture = (k: string) => todayKey != null && k >= todayKey;

  // Abonnements: weights per day, the days to come share what is still expected
  const n = month.length || 1;
  const aboWeight = new Map<string, number>();
  for (const m of month) aboWeight.set(m.key, input.subscriptions.newPace / n);
  const firstFuture = month.find((m) => isFuture(m.key))?.key ?? null;
  for (const e of input.subscriptions.endingDays) {
    // Ended earlier this month and not renewed yet: may still renew from today
    const k = firstFuture && e.key < firstFuture ? firstFuture : e.key;
    if (aboWeight.has(k)) aboWeight.set(k, (aboWeight.get(k) ?? 0) + e.value);
  }
  const paidSoFar = month.reduce((a, m) => a + (!isFuture(m.key) ? (actualByKey.get(m.key)?.subscriptions ?? 0) : 0), 0);
  const futureWeight = month.reduce((a, m) => a + (isFuture(m.key) ? (aboWeight.get(m.key) ?? 0) : 0), 0);
  const stillExpected = Math.max(0, input.subscriptions.expected - paidSoFar);
  const aboScale = futureWeight > 0 ? stillExpected / futureWeight : 0;
  const upcoming = new Map<string, number>();
  for (const e of input.eventsUpcoming) upcoming.set(e.key, (upcoming.get(e.key) ?? 0) + e.value);

  const keys = new Set<string>();
  const add = (o: Record<string, number>) => Object.keys(o).forEach((k) => keys.add(k));
  baseAvg.forEach(add);
  prevAvg.forEach(add);

  const days: SourceDay[] = month.map((m, i) => {
    const factor = input.dayFactors[m.key]?.factor ?? 1;
    const expected: Record<string, number> = {};
    for (const [k, v] of Object.entries(baseAvg[m.weekday])) expected[k] = r1(v * factor);
    const w = aboWeight.get(m.key) ?? 0;
    expected.abos = r1(isFuture(m.key) ? w * aboScale : w);
    expected.events = r1(upcoming.get(m.key) ?? 0);

    const fact = actualByKey.get(m.key);
    let actual: Record<string, number> | null = null;
    if (fact && (todayKey == null || m.key <= todayKey)) {
      actual = {};
      for (const [k, v] of Object.entries(tarifOf(fact))) actual[k] = r1(v);
      actual.abos = r1(fact.subscriptions);
      actual.events = r1(fact.events ?? 0);
      add(actual);
    }

    const previous: Record<string, number> = {};
    for (const [k, v] of Object.entries(prevAvg[m.weekday])) previous[k] = r1(v);
    const sameDate = input.previousMonthDays[i];
    previous.abos = r1(sameDate?.subscriptions ?? 0);
    previous.events = r1(sameDate?.events ?? 0);

    return { key: m.key, weekday: m.weekday, expected, actual, complete: todayKey == null || m.key < todayKey, previous };
  });

  // Tarifs by money over the base + this month, biggest first
  const weight = new Map<string, number>();
  for (const d of days) for (const k of keys) weight.set(k, (weight.get(k) ?? 0) + (d.expected[k] ?? 0) + (d.actual?.[k] ?? 0));
  const tarifs: SourceDef[] = [...keys]
    .filter((k) => k.startsWith('tarif:'))
    .sort((a, b) => (weight.get(b) ?? 0) - (weight.get(a) ?? 0))
    .map((k) => ({ key: k, label: input.tarifNames.get(k.slice(6)) ?? 'Tarif', kind: 'tarif' as const }));
  const list: SourceDef[] = [
    ...tarifs,
    { key: 'cafe', label: 'Café & produits', kind: 'cafe' },
    { key: 'abos', label: 'Abonnements', kind: 'abos' },
    { key: 'events', label: 'Événements', kind: 'events' },
  ];
  return { list, days };
}
