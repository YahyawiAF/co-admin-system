import { areaFigures, buildHealth, gainFromText, type HealthInput, MAX_RUNNING } from './health';
import { coworkingLevers, type CoworkingFacts } from '../analytics/levers-coworking';
import { sumSales } from './sales';
import { areaOf, sanitizeTool } from './tools';

const NOW = new Date('2026-11-03T10:00:00');

const facts = (over: Partial<CoworkingFacts> = {}): CoworkingFacts => ({
  visits30: 300,
  ticket: 6,
  new30: 18,
  visitsPerNewcomer: 3,
  returnRatePct: 62,
  returnWithAppPct: null,
  returnWithoutAppPct: null,
  installDay1Pct: null,
  profileKnown: 0,
  studentSharePct: null,
  heardFrom: {},
  lists: { NEW_NOT_BACK: 4 },
  aboEndingCount: 12,
  aboEndingValue: 1440,
  renewalRatePct: 40,
  renewals30: 0,
  renewalsOtherOffer30: 0,
  renewalImproving: false,
  avgAboPrice: 120,
  events60: 0,
  paidEvents60: 0,
  nextEvent: null,
  referralPoints: 0,
  referrals60: 0,
  googleReviewUrl: true,
  reviewClicks60: 3,
  cafeOrders30: 70,
  cafeRevenue30: 210,
  weekdayRevenue: [0, 220, 105, 200, 110, 230, 150],
  ...over,
});

const input = (over: Partial<HealthInput> = {}): HealthInput => {
  const f = over.facts ?? facts();
  return {
    now: NOW,
    facts: f,
    defs: coworkingLevers(f),
    leverStatus: {},
    weekly: {
      cafeAttachPct: [28, 27, 26, 27, 25, 24, 26, 25],
      aboSold: [3, 2, 4, 2, 3, 1, 2, 2],
      weakDayRevenue: [100, 110, 95, 105, 100, 98, 102, 105],
      newcomers: [3, 4, 4, 5, 4, 5, 4, 5],
      returnPct: [52, 55, 54, 57, 58, 60, 61, null],
      unpaidVisits: [1, 0, 2, 1, 1, 0, 1, 1],
    },
    cafe: { visits28: 200, withCafe28: 50, avgCafe: 3 },
    newcomers: { last28: 18, prev28: 14 },
    unpaid: { total: 140, clients: 7, oldestDays: 23 },
    report: null,
    dismissed: [],
    initiatives: [],
    ...over,
  };
};

describe('health figures', () => {
  it('café: 25 % of visits is orange and says « 1 client sur 4 »', () => {
    const c = areaFigures('cafe', input());
    expect(c.status).toBe('orange');
    expect(c.big).toBe('25 %');
    expect(c.headline).toBe('Seulement 1 client sur 4 prend un café');
  });

  it('café: too few visits is grey, never a verdict', () => {
    expect(areaFigures('cafe', input({ cafe: { visits28: 10, withCafe28: 1, avgCafe: 3 } })).status).toBe('grey');
  });

  it('abonnements: 40 % renewed is orange; under 40 is red', () => {
    expect(areaFigures('abos', input()).status).toBe('orange');
    expect(areaFigures('abos', input({ facts: facts({ renewalRatePct: 30 }) })).status).toBe('red');
  });

  it('jours creux: the calmest day against the best one', () => {
    const c = areaFigures('creux', input());
    // mardi 105 vs vendredi 230: ratio 0.46 → red
    expect(c.status).toBe('red');
    expect(c.sub).toBe('par mardi en moyenne');
  });

  it('impayés: none is green, old or large is red', () => {
    expect(areaFigures('impayes', input({ unpaid: { total: 0, clients: 0, oldestDays: null } })).status).toBe('green');
    expect(areaFigures('impayes', input()).status).toBe('orange');
    expect(areaFigures('impayes', input({ unpaid: { total: 140, clients: 7, oldestDays: 45 } })).status).toBe('red');
  });

  it('nouveaux: fewer than 70 % of the month before is red', () => {
    expect(areaFigures('nouveaux', input({ newcomers: { last28: 6, prev28: 14 } })).status).toBe('red');
    expect(areaFigures('nouveaux', input()).status).toBe('green');
  });
});

describe('buildHealth', () => {
  it('sorts the worst points first and gives each a rule solution', () => {
    const h = buildHealth(input());
    expect(h.areas[0].status).toBe('red');
    expect(h.max).toBe(MAX_RUNNING);
    const abos = h.areas.find((a) => a.id === 'abos')!;
    expect(abos.solutions.length).toBeGreaterThan(0);
    // The renew rule idea comes with a relance ready
    const renew = abos.solutions.find((s) => s.leverId === 'renew')!;
    expect(renew.tools[0]).toMatchObject({ kind: 'CAMPAIGN', draft: { segment: 'ABO_EXPIRING' } });
    expect(renew.goalAmount).toBeGreaterThanOrEqual(50);
  });

  it('a solution refused (« Pas pour moi ») or already started is not proposed again', () => {
    const base = buildHealth(input());
    const renew = base.areas.find((a) => a.id === 'abos')!.solutions.find((s) => s.leverId === 'renew')!;
    const refused = buildHealth(input({ dismissed: [{ leverId: 'renew', title: renew.title }] }));
    expect(refused.areas.find((a) => a.id === 'abos')!.solutions.some((s) => s.leverId === 'renew')).toBe(false);
    const started = buildHealth(
      input({
        initiatives: [
          {
            id: 'i1',
            title: renew.title,
            area: 'abos',
            leverId: 'renew',
            category: 'RETENTION',
            objective: null,
            metric: null,
            segment: null,
            recommendationTitle: renew.title,
            startDate: '2026-10-30',
            endDate: null,
            finished: false,
            dropped: false,
            gain: 40,
            netGain: 40,
            goalAmount: 240,
            verdict: null,
            status: 'too_early',
          },
        ],
      }),
    );
    const abos = started.areas.find((a) => a.id === 'abos')!;
    expect(abos.solutions.some((s) => s.leverId === 'renew')).toBe(false);
    expect(abos.running).toEqual(['i1']);
    expect(started.runningCount).toBe(1);
  });

  it('AI ideas come first and take the lever they cover', () => {
    const h = buildHealth(
      input({
        report: {
          id: 'r1',
          recommendations: [
            {
              category: 'RETENTION',
              title: 'Relancer avec -10 % avant la fin',
              evidence: '12 abonnements finissent',
              actions: ['Créer la promo', 'Envoyer le message'],
              expectedImpact: '+150 DT/mois',
              leverId: 'renew',
              area: 'abos',
              goalAmount: 150,
            },
          ],
        },
      }),
    );
    const sols = h.areas.find((a) => a.id === 'abos')!.solutions;
    expect(sols[0]).toMatchObject({ source: 'ai', gain: 150, goalAmount: 150 });
    expect(sols.some((s) => s.source === 'rules' && s.leverId === 'renew')).toBe(false);
  });
});

describe('tools', () => {
  const ctx = { steps: 3, now: NOW, products: [{ id: 'p1', name: 'Café' }, { id: 'p2', name: 'Thé' }] };
  const draft = (over: Record<string, unknown>) => ({
    title: '',
    text: '',
    price: 0,
    discountPct: 0,
    date: '',
    days: [],
    fromHour: 0,
    toHour: 0,
    capacity: 0,
    segment: '',
    items: [],
    ...over,
  });

  it('keeps only real products and a future start for a promo', () => {
    const t = sanitizeTool(
      { kind: 'PROMOTION', step: 7, label: '', draft: draft({ title: 'Formule café', discountPct: 20, items: ['café', 'croissant'], date: '2020-01-01' }) },
      ctx,
    )!;
    expect(t.step).toBe(2);
    expect(t.draft).toMatchObject({ productIds: ['p1'], valueKind: 'PERCENT', value: 20, startsAt: '2026-11-03' });
  });

  it('drops a relance without a message and an event without a title', () => {
    expect(sanitizeTool({ kind: 'CAMPAIGN', step: 0, label: '', draft: draft({ segment: 'UNPAID' }) }, ctx)).toBeNull();
    expect(sanitizeTool({ kind: 'EVENT', step: 0, label: '', draft: draft({}) }, ctx)).toBeNull();
    expect(sanitizeTool({ kind: 'NOPE', step: 0, label: '', draft: draft({ title: 'x' }) } as never, ctx)).toBeNull();
  });

  it('an unknown relance list falls back to everyone', () => {
    const t = sanitizeTool({ kind: 'CAMPAIGN', step: 0, label: '', draft: draft({ text: 'Bonjour {prenom}, …', segment: 'MANUAL' }) }, ctx)!;
    expect(t.draft.segment).toBe('ALL');
  });

  it('finds the point of an action from its lever, list or category', () => {
    expect(areaOf({ leverId: 'renew' })).toBe('abos');
    expect(areaOf({ segment: 'UNPAID' })).toBe('impayes');
    expect(areaOf({ category: 'CAFE' })).toBe('cafe');
    expect(areaOf({ category: 'OPERATIONS' })).toBeNull();
  });

  it('reads the gain written by the AI', () => {
    expect(gainFromText('+120 DT/mois : 4 clients × 30 DT')).toBe(120);
    expect(gainFromText('≈ 1 200 DT')).toBe(1200);
    expect(gainFromText('beaucoup')).toBe(0);
  });
});

describe('sumSales', () => {
  it('counts a sale reached by two tools once', () => {
    const s = (items: Array<[string, number]>, discount = 0) => ({
      kind: 'X',
      id: 'x',
      label: 'x',
      count: items.length,
      revenue: 0,
      margin: 0,
      discount,
      items: items.map(([key, amount]) => ({ key, amount })),
      stages: [],
    });
    const total = sumSales([s([['j:1', 10], ['j:2', 8]]), s([['j:2', 6], ['r:1', 15]], 2), null]);
    expect(total).toEqual({ total: 33, discount: 2, count: 4 });
  });
});
