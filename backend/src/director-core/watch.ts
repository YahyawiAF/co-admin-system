import type { EyeDay } from './catalogue';

/**
 * A watch: what the brain asked the app to follow after a change, and the one
 * measuring rule left. Before = the same weekdays of the 4 weeks before the start
 * (a Monday is only compared with Mondays). The brain judges; this only counts.
 */
export type WatchInput = {
  aggregate: 'sum' | 'ratio';
  /** Days of the eye from 28 days before `start` to `end` (missing days = 0) */
  days: EyeDay[];
  /** First day measured, yyyy-MM-dd */
  start: string;
  /** Planned length in days */
  length: number;
  /** Last complete day (yesterday), yyyy-MM-dd */
  today: string;
  /** Calendar periods (holidays, exams…) that may bend the comparison */
  periods?: Array<{ label: string; from: string; to: string }>;
  /** Sales made through the legs of the same priority (each sale once) */
  sales?: { count: number; revenue: number } | null;
  goal?: number | null;
};

export type WatchResult = {
  status: 'waiting' | 'running' | 'done';
  daysMeasured: number;
  length: number;
  /** sum: total over the measured days, against the same weekdays before. ratio: % before and after. */
  before: number | null;
  after: number | null;
  /** sum: % change. ratio: change in points. */
  change: number | null;
  changeUnit: '%' | 'pts';
  splits: Array<{ key: string; before: number; after: number }>;
  periods: string[];
  sales: { count: number; revenue: number } | null;
  goal: number | null;
  goalReached: boolean | null;
};

const DAY = 86_400_000;
const r1 = (n: number) => Math.round(n * 10) / 10;
const toTime = (key: string) => new Date(`${key}T12:00:00`).getTime();
const toKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const addDayKey = (key: string, n: number) => toKey(toTime(key) + n * DAY);

export function measureWatch(w: WatchInput): WatchResult {
  const byDay = new Map(w.days.map((d) => [d.day, d]));
  const end = [addDayKey(w.start, w.length - 1), w.today].sort()[0];
  const after: string[] = [];
  for (let k = w.start; k <= end; k = addDayKey(k, 1)) after.push(k);
  const before: string[] = [];
  for (let i = 28; i >= 1; i--) before.push(addDayKey(w.start, -i));
  const empty: WatchResult = {
    status: 'waiting',
    daysMeasured: 0,
    length: w.length,
    before: null,
    after: null,
    change: null,
    changeUnit: w.aggregate === 'ratio' ? 'pts' : '%',
    splits: [],
    periods: [],
    sales: w.sales ?? null,
    goal: w.goal ?? null,
    goalReached: null,
  };
  if (!after.length) return empty;

  const get = (k: string) => byDay.get(k);
  const weekday = (k: string) => new Date(toTime(k)).getDay();
  const periods = (w.periods ?? []).filter((p) => p.from <= end && p.to >= before[0]).map((p) => p.label);

  let b: number;
  let a: number;
  let change: number | null;
  if (w.aggregate === 'ratio') {
    const ratio = (keys: string[]) => {
      const num = keys.reduce((s, k) => s + (get(k)?.value ?? 0), 0);
      const den = keys.reduce((s, k) => s + (get(k)?.base ?? 0), 0);
      return den > 0 ? (num / den) * 100 : null;
    };
    const rb = ratio(before);
    const ra = ratio(after);
    b = rb ?? 0;
    a = ra ?? 0;
    change = rb != null && ra != null ? r1(ra - rb) : null;
  } else {
    // Expected = for each measured day, the average of the same weekday before
    const avgAll = before.reduce((s, k) => s + (get(k)?.value ?? 0), 0) / before.length;
    const avgOf = new Map<number, number>();
    for (let wd = 0; wd < 7; wd++) {
      const same = before.filter((k) => weekday(k) === wd);
      avgOf.set(wd, same.length ? same.reduce((s, k) => s + (get(k)?.value ?? 0), 0) / same.length : avgAll);
    }
    b = after.reduce((s, k) => s + (avgOf.get(weekday(k)) ?? 0), 0);
    a = after.reduce((s, k) => s + (get(k)?.value ?? 0), 0);
    change = b > 0 ? Math.round(((a - b) / b) * 100) : null;
  }

  const keys = new Set<string>();
  for (const k of [...before, ...after]) for (const s of Object.keys(get(k)?.split ?? {})) keys.add(s);
  const splitSum = (list: string[], key: string) => list.reduce((s, k) => s + (get(k)?.split?.[key] ?? 0), 0);
  const splits = [...keys]
    .map((key) => ({ key, before: r1((splitSum(before, key) / before.length) * after.length), after: r1(splitSum(after, key)) }))
    .sort((p, q) => q.after + q.before - (p.after + p.before));

  const goal = w.goal ?? null;
  return {
    ...empty,
    status: after.length >= w.length ? 'done' : 'running',
    daysMeasured: after.length,
    before: r1(b),
    after: r1(a),
    change,
    splits,
    periods,
    goalReached: goal == null ? null : w.aggregate === 'ratio' ? a >= goal : a >= goal,
  };
}
