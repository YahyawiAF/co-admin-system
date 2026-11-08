import { buildForecast, cafeRate, lastingChanges, recencyWeights, unusualDays, type DayFact, type MonthDay } from './forecast';

// [day, passes, café, visits, new] — real export of 6 Nov 2026
const REAL: Array<[string, number, number, number, number]> = [
  ['2026-10-01', 73.5, 0.0, 20, 8],
  ['2026-10-02', 122.1, 0.0, 28, 13],
  ['2026-10-03', 134.4, 0.0, 24, 11],
  ['2026-10-04', 179.5, 0.0, 32, 14],
  ['2026-10-05', 57.7, 0.0, 20, 6],
  ['2026-10-06', 94.5, 0.0, 26, 4],
  ['2026-10-07', 41.2, 0.0, 10, 1],
  ['2026-10-08', 105.4, 0.0, 25, 8],
  ['2026-10-09', 39.5, 0.0, 12, 3],
  ['2026-10-10', 97.1, 0.0, 18, 5],
  ['2026-10-11', 156.2, 14.5, 29, 10],
  ['2026-10-12', 113.5, 2.0, 23, 5],
  ['2026-10-13', 19.8, 0.0, 8, 3],
  ['2026-10-14', 53.0, 2.0, 15, 5],
  ['2026-10-15', 242.3, 8.6, 45, 13],
  ['2026-10-16', 99.0, 10.3, 21, 7],
  ['2026-10-17', 109.0, 6.1, 19, 7],
  ['2026-10-18', 160.8, 4.0, 33, 15],
  ['2026-10-19', 124.5, 4.2, 29, 16],
  ['2026-10-20', 87.5, 0.0, 20, 8],
  ['2026-10-21', 80.2, 2.0, 15, 5],
  ['2026-10-22', 115.3, 6.0, 22, 7],
  ['2026-10-23', 71.2, 8.6, 16, 0],
  ['2026-10-24', 93.3, 6.4, 17, 7],
  ['2026-10-25', 186.2, 9.0, 27, 12],
  ['2026-10-26', 167.8, 0.0, 33, 8],
  ['2026-10-27', 69.0, 2.5, 17, 0],
  ['2026-10-28', 189.2, 2.0, 33, 5],
  ['2026-10-29', 155.5, 8.0, 33, 13],
  ['2026-10-30', 150.8, 0.0, 29, 14],
  ['2026-10-31', 192.3, 0.0, 39, 10],
  ['2026-11-01', 205.5, 0.0, 40, 15],
  ['2026-11-02', 180.4, 4.2, 40, 12],
  ['2026-11-03', 115.1, 15.0, 27, 5],
  ['2026-11-04', 113.0, 21.3, 28, 4],
  ['2026-11-05', 137.4, 37.5, 31, 7],
  ['2026-11-06', 101.8, 23.2, 34, 14],
];

const facts: DayFact[] = REAL.map(([key, passes, cafe, visits, newVisitors]) => ({
  key,
  weekday: new Date(`${key}T12:00:00Z`).getUTCDay(),
  revenueVisits: passes,
  products: cafe,
  visits,
  newVisitors,
  subscriptions: 0,
}));
const october = facts.filter((d) => d.key.startsWith('2026-10'));
const november = facts.filter((d) => d.key.startsWith('2026-11'));
const monthDays: MonthDay[] = Array.from({ length: 30 }, (_, i) => {
  const key = `2026-11-${String(i + 1).padStart(2, '0')}`;
  return { key, weekday: new Date(`${key}T12:00:00Z`).getUTCDay() };
});
const total = (rows: DayFact[]) => rows.reduce((a, d) => a + d.revenueVisits + d.products, 0);

describe('recencyWeights', () => {
  it('goes from 1 to the last weight', () => {
    expect(recencyWeights(3, 3)).toEqual([1, 2, 3]);
    expect(recencyWeights(4)).toEqual([1, 1, 1, 1]);
  });
});

describe('forecast on the real October → November', () => {
  const run = (lived: number, extra: Partial<Parameters<typeof buildForecast>[0]> = {}) =>
    buildForecast({
      base: october,
      recentWeight: 3,
      paceDays: 3,
      month: monthDays,
      actual: november.slice(0, lived + 1),
      todayKey: monthDays[lived].key,
      subscriptionsExpected: 0,
      ...extra,
    });

  it('the rythme after 3 days predicts the next days within 10 %', () => {
    const f = run(3);
    const m = f.toDate!.pace.multiplier;
    const next = f.days.slice(3, 6).reduce((a, d) => a + d.expected, 0) * m;
    const actual = total(november.slice(3, 6));
    expect(Math.abs(next - actual) / actual).toBeLessThan(0.1);
  });

  it('the October base expects more than a flat old base would', () => {
    const flat = buildForecast({ base: october, month: monthDays, actual: [], todayKey: '2026-11-01', subscriptionsExpected: 0 });
    expect(run(0).expected.variable).toBeGreaterThan(flat.expected.variable);
  });

  it('café follows the visits after the change of habit', () => {
    const rate = cafeRate(facts.filter((d) => d.key < '2026-11-06'))!;
    expect(rate.changedOn).toBe('2026-11-03');
    expect(rate.perVisit).toBeGreaterThan(0.6);
    expect(rate.before!).toBeLessThan(0.25);
    const withCafe = run(5, { cafe: { perVisit: rate.perVisit, from: rate.from } });
    const without = run(5);
    expect(withCafe.expected.products).toBeGreaterThan(without.expected.products * 3);
  });
});

describe('cafeRate', () => {
  it('uses the last 14 days when nothing changed', () => {
    const r = cafeRate(october.slice(10, 31).map((d) => ({ ...d, products: d.visits * 0.3 })))!;
    expect(r.changedOn).toBeNull();
    expect(r.perVisit).toBeCloseTo(0.3);
  });
});

describe('unusualDays', () => {
  it('flags the holiday peak only when it is not in the calendar', () => {
    const flagged = unusualDays(october, new Set()).map((d) => d.key);
    expect(flagged).toContain('2026-10-15');
    expect(unusualDays(october, new Set(['2026-10-15'])).map((d) => d.key)).not.toContain('2026-10-15');
  });

  it('a run of 3 days the same way is a lasting change', () => {
    const list = [
      { key: '2026-10-28', weekday: 3, actual: 190, expected: 100, changePct: 90, direction: 'up' as const },
      { key: '2026-10-29', weekday: 4, actual: 160, expected: 100, changePct: 60, direction: 'up' as const },
      { key: '2026-10-31', weekday: 6, actual: 190, expected: 110, changePct: 70, direction: 'up' as const },
    ];
    expect(lastingChanges(list)).toEqual([{ from: '2026-10-28', to: '2026-10-31', direction: 'up', days: 3 }]);
    expect(lastingChanges(list.slice(0, 2))).toEqual([]);
  });
});
