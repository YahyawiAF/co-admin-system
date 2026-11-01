import { buildForecast, detectChanges, splitGap, weekBand, type DayFact, type MonthDay } from './forecast';
import { evaluateLevers, type LeverDef } from './levers';

const key = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Days from `start` (local) with revenue by weekday. */
function days(start: Date, n: number, f: (wd: number, i: number) => Partial<DayFact> = () => ({})): DayFact[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return {
      key: key(d),
      weekday: d.getDay(),
      revenueVisits: 100,
      visits: 20,
      newVisitors: 5,
      products: 10,
      subscriptions: 0,
      ...f(d.getDay(), i),
    };
  });
}

const november: MonthDay[] = days(new Date(2026, 10, 1), 30).map((d) => ({ key: d.key, weekday: d.weekday }));

describe('buildForecast', () => {
  const base = days(new Date(2026, 9, 4), 28, (wd) => ({ revenueVisits: wd === 0 ? 170 : wd === 2 ? 60 : 100 }));

  it('gives each day the average of its weekday and spreads subscriptions', () => {
    const f = buildForecast({ base, month: november, actual: [], todayKey: '2026-11-01', subscriptionsExpected: 900 });
    // 1 Nov 2026 is a Sunday: 170 visits + 10 products + 900/30
    expect(f.days[0].weekday).toBe(0);
    expect(f.days[0].expected).toBe(210);
    // 5 Sundays, 4 Tuesdays, 21 other days
    expect(f.expected.visits).toBe(5 * 170 + 4 * 60 + 21 * 100);
    expect(f.expected.subscriptions).toBe(900);
    expect(f.expected.total).toBe(f.days[29].expectedCum);
    expect(f.toDate).toBeNull();
    expect(f.checkpoints.map((c) => c.day)).toEqual([7, 14, 21, 30]);
  });

  it('compares complete days only and splits the gap exactly', () => {
    const actual = days(new Date(2026, 10, 1), 8, (wd, i) => ({
      revenueVisits: i < 7 ? 130 : 0,
      visits: i < 7 ? 26 : 0,
      newVisitors: i < 7 ? 9 : 0,
      subscriptions: i === 2 ? 150 : 0,
    }));
    const f = buildForecast({ base, month: november, actual, todayKey: '2026-11-08', subscriptionsExpected: 900 });
    expect(f.toDate!.days).toBe(7);
    const sumEffects = f.toDate!.drivers.reduce((a, d) => a + d.effect, 0);
    expect(Math.abs(sumEffects - f.toDate!.gap)).toBeLessThan(1);
    expect(f.toDate!.drivers.find((d) => d.key === 'newVisitors')!.effect).toBeGreaterThan(0);
    expect(f.days[7].complete).toBe(false);
  });

  it('reports what changes from the previous month', () => {
    const f = buildForecast({
      base,
      month: november,
      actual: [],
      subscriptionsExpected: 950,
      previousMonth: { revenueVisits: 3347, visits: 701, newVisitors: 234, products: 98, subscriptions: 1521 },
    });
    const subs = f.versusPrevious!.drivers.find((d) => d.key === 'subscriptions')!;
    expect(subs.effect).toBe(-571);
  });
});

describe('splitGap', () => {
  it('adds up to the revenue difference', () => {
    const ref = { revenueVisits: 1000, visits: 200, newVisitors: 60, products: 50, subscriptions: 400 };
    const cmp = { revenueVisits: 1150, visits: 220, newVisitors: 90, products: 40, subscriptions: 300 };
    const total = splitGap(ref, cmp).reduce((a, d) => a + d.effect, 0);
    expect(Math.round(total)).toBe(1150 + 40 + 300 - (1000 + 50 + 400));
  });
});

describe('weekBand', () => {
  it('uses the weakest and strongest week', () => {
    const base = days(new Date(2026, 9, 4), 28, (_, i) => ({ revenueVisits: i < 7 ? 50 : 100, products: 0 }));
    const b = weekBand(base);
    expect(b.low).toBeCloseTo(50 / 87.5, 2);
    expect(b.high).toBeCloseTo(100 / 87.5, 2);
  });
});

describe('detectChanges', () => {
  it('flags a jump in new visitors in the last 7 days', () => {
    const d = days(new Date(2026, 9, 1), 35, (_, i) => ({ newVisitors: i >= 28 ? 9 : 5 }));
    const c = detectChanges(d);
    expect(c).toEqual([
      expect.objectContaining({ metric: 'newVisitors', direction: 'up', actual: 63, expected: 35, changePct: 80 }),
    ]);
  });

  it('ignores small moves', () => {
    const d = days(new Date(2026, 9, 1), 35, (_, i) => ({ newVisitors: i >= 28 ? 6 : 5 }));
    expect(detectChanges(d)).toEqual([]);
  });
});

describe('evaluateLevers', () => {
  const now = new Date(2026, 10, 15);
  const defs: LeverDef[] = [
    { id: 'social', group: 'ATTRACT', title: 'Réseaux', signal: '', strength: 0.8, gain: 300, matchesAction: (a) => a.channels.includes('INSTAGRAM_POST'), idea: { title: 'Publier', why: '', steps: [], plan: {} } },
    { id: 'partner', group: 'ATTRACT', title: 'Fac', signal: '', strength: 0.7, gain: 400, idea: { title: 'Fac', why: '', steps: [], plan: {} } },
    { id: 'renew', group: 'SPEND', title: 'Renouveler', signal: '', strength: 0.9, gain: 500, outreachReasons: ['ABO_EXPIRING'], idea: { title: 'R', why: '', steps: [], plan: {} } },
    { id: 'tue', group: 'FILL', title: 'Mardi', signal: '', strength: 0.3, gain: 100 },
    { id: 'cafe', group: 'SPEND', title: 'Café', signal: '', strength: 0.9, gain: 450, noData: 'ventes pas notées' },
  ];

  it('marks covered, missing, no data and low-priority levers', () => {
    const m = evaluateLevers(
      defs,
      [{ id: 'a1', title: 'Posts', category: null, objective: null, channels: ['INSTAGRAM_POST'], startDate: new Date(2026, 10, 8), endDate: null, verdict: 'WORKING' }],
      [{ reason: 'ABO_EXPIRING', contacts: 0 }],
      now,
    );
    const all = m.groups.flatMap((g) => g.levers);
    const st = Object.fromEntries(all.map((l) => [l.id, l.status]));
    expect(st).toEqual({ social: 'WORKING', partner: 'MISSING', renew: 'MISSING', tue: 'OK', cafe: 'NO_DATA' });
    expect(m.missing.map((i) => i.leverId)).toEqual(['renew', 'partner']);
  });

  it('counts recent relances and forgets old actions', () => {
    const m = evaluateLevers(
      defs,
      [{ id: 'a1', title: 'Posts', category: null, objective: null, channels: ['INSTAGRAM_POST'], startDate: new Date(2026, 6, 1), endDate: null, verdict: null }],
      [{ reason: 'ABO_EXPIRING', contacts: 4 }],
      now,
    );
    const st = Object.fromEntries(m.groups.flatMap((g) => g.levers).map((l) => [l.id, l.status]));
    expect(st.social).toBe('MISSING');
    expect(st.renew).toBe('IN_PROGRESS');
  });
});
