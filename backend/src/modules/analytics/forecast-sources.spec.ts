import type { DayFact, MonthDay } from '../../business-manager-core';
import { buildSources } from './forecast-sources';

const key = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function days(start: Date, n: number, f: (wd: number) => Partial<DayFact> = () => ({})): DayFact[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { key: key(d), weekday: d.getDay(), revenueVisits: 0, visits: 0, newVisitors: 0, products: 10, subscriptions: 0, events: 0, ...f(d.getDay()) };
  });
}

const november: MonthDay[] = days(new Date(2026, 10, 1), 30).map((d) => ({ key: d.key, weekday: d.weekday }));

describe('buildSources', () => {
  const base = days(new Date(2026, 9, 4), 28);
  const october = days(new Date(2026, 9, 1), 31, () => ({ subscriptions: 0 }));
  october[0].subscriptions = 300;
  const tarifDays = new Map<string, Record<string, number>>();
  for (const d of base) tarifDays.set(d.key, d.weekday === 0 ? { a: 60, b: 40 } : { a: 30 });
  for (const d of october) if (!tarifDays.has(d.key)) tarifDays.set(d.key, { a: 20 });
  const actual = days(new Date(2026, 10, 1), 3, () => ({ products: 20, subscriptions: 0 }));
  tarifDays.set('2026-11-01', { a: 90 });
  actual[1].subscriptions = 50;

  const s = buildSources({
    month: november,
    todayKey: '2026-11-03',
    base,
    dayFactors: { '2026-11-29': { type: 'exams', label: 'Examens', factor: 1.5, known: true } },
    actual,
    previousMonthDays: october,
    tarifDays,
    tarifNames: new Map([['a', 'Pass 2h'], ['b', 'Journée']]),
    subscriptions: { expected: 200, newPace: 60, endingDays: [{ key: '2026-11-02', value: 40 }, { key: '2026-11-10', value: 100 }] },
    eventsUpcoming: [{ key: '2026-11-14', value: 15 }, { key: '2026-11-14', value: 15 }],
  });

  it('lists tarifs biggest first, then café, abonnements, events', () => {
    expect(s.list.map((x) => x.label)).toEqual(['Pass 2h', 'Journée', 'Café & produits', 'Abonnements', 'Événements']);
  });

  it('follows the weekday and the calendar for tarifs and café', () => {
    const sunday = s.days[0];
    expect(sunday.expected['tarif:a']).toBe(60);
    expect(sunday.expected['tarif:b']).toBe(40);
    expect(s.days[1].expected['tarif:b'] ?? 0).toBe(0);
    expect(s.days[28].expected['tarif:a']).toBe(90); // 29 Nov, a Sunday in exams ×1.5
    expect(sunday.actual?.['tarif:a']).toBe(90);
    expect(sunday.previous['tarif:a']).toBe(60); // October Sundays
  });

  it('shares the abonnements still expected over the days to come', () => {
    const future = s.days.filter((d) => !d.complete).reduce((a, d) => a + d.expected.abos, 0);
    expect(Math.abs(future - (200 - 50))).toBeLessThan(1);
    // Ended on the 2nd and not renewed: may still renew from today
    expect(s.days[2].expected.abos).toBeGreaterThan(s.days[3].expected.abos);
    expect(s.days[0].previous.abos).toBe(300);
  });

  it('puts unpaid event places on the event day', () => {
    expect(s.days[13].expected.events).toBe(30);
    expect(s.days[12].expected.events).toBe(0);
  });
});
