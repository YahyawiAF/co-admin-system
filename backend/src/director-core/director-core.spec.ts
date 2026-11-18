import { addDayKey, lessonFlag, measureWatch, parseUpdate, pickLessons, sameRule, type EyeDay, type EyeSpec, type LegSpec, type LessonView } from './index';

/** 28 days before 2026-11-03 then 14 days from it; weekday value = base, after the start = after. */
function days(base: (weekday: number) => number, after: (weekday: number) => number, split?: (k: string) => Record<string, number>): EyeDay[] {
  const out: EyeDay[] = [];
  for (let i = -28; i < 14; i++) {
    const day = addDayKey('2026-11-03', i);
    const wd = new Date(`${day}T12:00:00`).getDay();
    out.push({ day, value: i < 0 ? base(wd) : after(wd), ...(split ? { split: split(i < 0 ? 'before' : 'after') } : {}) });
  }
  return out;
}

describe('watch', () => {
  it('compares each day with the same weekday before', () => {
    // Sundays sell 20, other days 5; after the start every day sells 25 % more
    const r = measureWatch({
      aggregate: 'sum',
      days: days((wd) => (wd === 0 ? 20 : 5), (wd) => (wd === 0 ? 25 : 6.25)),
      start: '2026-11-03',
      length: 14,
      today: '2026-11-16',
    });
    expect(r).toMatchObject({ status: 'done', daysMeasured: 14, change: 25, changeUnit: '%' });
    expect(r.before).toBe(100); // 2 Sundays × 20 + 12 days × 5
    expect(r.after).toBe(125);
  });

  it('is still running before its last day, and waits before its first', () => {
    const d = days(() => 4, () => 4);
    expect(measureWatch({ aggregate: 'sum', days: d, start: '2026-11-03', length: 14, today: '2026-11-08' })).toMatchObject({ status: 'running', daysMeasured: 6, change: 0 });
    expect(measureWatch({ aggregate: 'sum', days: d, start: '2026-11-03', length: 14, today: '2026-11-02' }).status).toBe('waiting');
  });

  it('gives a ratio in points and splits per key', () => {
    const d = days(() => 3, () => 6, (when) => (when === 'before' ? { app: 1, comptoir: 2 } : { app: 1, comptoir: 5 })).map((x) => ({ ...x, base: 20 }));
    const r = measureWatch({ aggregate: 'ratio', days: d, start: '2026-11-03', length: 14, today: '2026-11-16' });
    expect(r).toMatchObject({ before: 15, after: 30, change: 15, changeUnit: 'pts' });
    expect(r.splits).toEqual([
      { key: 'comptoir', before: 28, after: 70 },
      { key: 'app', before: 14, after: 14 },
    ]);
  });

  it('flags calendar periods and carries the legs sales', () => {
    const r = measureWatch({
      aggregate: 'sum',
      days: days(() => 4, () => 4),
      start: '2026-11-03',
      length: 14,
      today: '2026-11-16',
      periods: [
        { label: 'Examens', from: '2026-11-10', to: '2026-11-20' },
        { label: 'Été', from: '2026-07-01', to: '2026-08-31' },
      ],
      sales: { count: 18, revenue: 108 },
    });
    expect(r.periods).toEqual(['Examens']);
    expect(r.sales).toEqual({ count: 18, revenue: 108 });
  });
});

const EYES: EyeSpec[] = [
  {
    id: 'cafe.sales',
    label: 'Ventes café',
    unit: 'articles',
    aggregate: 'sum',
    help: '',
    params: [
      { name: 'channel', label: 'canal', values: ['all', 'app', 'comptoir'] },
      { name: 'product', label: 'produit', type: 'text' },
      { name: 'fromHour', label: 'de', type: 'hour' },
    ],
  },
];
const LEGS: LegSpec[] = [{ kind: 'PROMOTION', label: 'Promo', needsOk: true, fields: '' }];
const ctx = {
  corners: [{ id: 'cafe', name: 'Café' }],
  entryIds: ['n1'],
  eyes: EYES,
  legs: LEGS,
  checkLeg: (kind: string, raw: { label?: unknown; draft?: unknown }) => {
    const d = raw.draft as { title?: string } | undefined;
    return d?.title ? { kind, label: String(raw.label ?? 'Préparer'), draft: { title: d.title } } : null;
  },
};

describe('directeur-update/v2', () => {
  it('keeps priorities with checked legs and watches, looks and needs', () => {
    const plan = parseUpdate(
      {
        format: 'directeur-update/v2',
        priorities: [
          {
            title: 'Proposer un café à chaque check-in',
            corner: 'cafe',
            why: '15 % des visites avec café',
            steps: ['Le dire à chaque arrivée'],
            legs: [
              { kind: 'PROMOTION', label: 'Préparer la promo', draft: { title: '4h + Express à 6 DT' } },
              { kind: 'PROMOTION', draft: {} },
              { kind: 'SEND_SMS', draft: { title: 'x' } },
            ],
            watch: [
              { eye: 'cafe.sales', params: { channel: 'comptoir', product: 'Express' }, days: 90 },
              { eye: 'cafe.sales', params: { channel: 'bar' } },
              { eye: 'weather.rain' },
            ],
          },
        ],
        look: [
          { eye: 'cafe.sales', params: { fromHour: 15 }, from: '2026-10-01', to: '2026-12-31', why: 'café l’après-midi' },
          { eye: 'cafe.sales', from: '2026-11-10', to: '2026-11-01' },
        ],
        needs: [{ title: 'Voir les avis Google', problem: 'Je ne vois pas les avis', capability: 'Lire la note Google chaque semaine' }, { title: 'incomplet' }],
      },
      ctx,
      '2026-11-19',
    );
    expect(plan.priorities).toHaveLength(1);
    expect(plan.priorities[0].legs).toEqual([{ kind: 'PROMOTION', label: 'Préparer la promo', draft: { title: '4h + Express à 6 DT' } }]);
    expect(plan.priorities[0].watch).toEqual([{ eye: 'cafe.sales', params: { channel: 'comptoir', product: 'Express' }, days: 42, label: null, goal: null }]);
    expect(plan.look).toEqual([{ eye: 'cafe.sales', params: { fromHour: 15 }, from: '2026-10-01', to: '2026-11-19', why: 'café l’après-midi' }]);
    expect(plan.needs).toHaveLength(1);
    expect(plan.warnings).toEqual([
      'priorities[0].legs[1] ignoré : brouillon incomplet',
      'priorities[0].legs[2] ignoré : l’app n’a pas de jambe « SEND_SMS »',
      'priorities[0].watch[1] ignoré : paramètre inconnu pour « cafe.sales »',
      'priorities[0].watch[2] ignoré : l’app n’a pas d’œil « weather.rain »',
      'look[1] ignoré : dates invalides',
    ]);
  });

  it('still reads a v1 answer', () => {
    const plan = parseUpdate({ format: 'directeur-update/v1', priorities: [{ title: 'Relancer', corner: 'cafe', why: 'x' }] }, ctx, '2026-11-19');
    expect(plan.priorities[0]).toMatchObject({ title: 'Relancer', legs: [], watch: [], steps: [] });
  });

  it('refuses another format', () => {
    expect(() => parseUpdate({ format: 'autre' }, ctx, '2026-11-19')).toThrow('directeur-update/v2');
  });
});

describe('lessons', () => {
  const lesson = (id: string, o: Partial<LessonView> = {}): LessonView => ({
    id,
    rule: id,
    why: null,
    corner: 'cafe',
    status: 'ADOPTED',
    confidence: 50,
    domain: 'coworking',
    results: [],
    ...o,
  });

  it('sends the corners in trouble first, then tests, then the most trusted; never rejected or another trade', () => {
    const picked = pickLessons(
      [
        lesson('a', { confidence: 90 }),
        lesson('b', { corner: 'abos', confidence: 40 }),
        lesson('c', { status: 'TESTING', confidence: 30 }),
        lesson('d', { status: 'REJECTED', confidence: 0 }),
        lesson('e', { domain: 'retail', confidence: 95 }),
        lesson('f', { domain: '*', confidence: 70 }),
      ],
      { domain: 'coworking', hotCorners: ['abos'] },
    );
    expect(picked.map((l) => l.id)).toEqual(['b', 'c', 'a', 'f']);
  });

  it('asks for a review after 3 bad results, and a promotion when proven in 2 trades', () => {
    const r = { priority: 'p', watch: 'w', change: -10, unit: '%', sales: null, date: '2026-11-01' };
    expect(lessonFlag(lesson('a', { confidence: 15, results: [r, r, r] }))).toBe('review');
    expect(lessonFlag(lesson('a', { confidence: 15, results: [r] }))).toBeNull();
    expect(lessonFlag(lesson('a', { confidence: 85, provenIn: ['coworking', 'retail'] }))).toBe('promote');
    expect(lessonFlag(lesson('a', { confidence: 85, domain: '*', provenIn: ['coworking', 'retail'] }))).toBeNull();
  });

  it('matches the same rule written differently', () => {
    expect(sameRule('Choisir le public, avant le prix !', 'choisir le public avant le prix')).toBe(true);
    expect(sameRule('Choisir le public', 'Choisir le prix')).toBe(false);
  });

  it('reads verdicts, confidence changes and replies; a priority can test a new lesson', () => {
    const plan = parseUpdate(
      {
        format: 'directeur-update/v2',
        lessons: [
          { learnId: 'learn-1', claim: 'Le même produit paraît cher ou pas selon le public', verdict: 'adopt', rule: 'Choisir le public avant le prix', corner: 'cafe', domain: '*' },
          { learnId: 'learn-1', claim: 'Bien positionnée, une offre se vend sans baisser le prix', verdict: 'TEST', rule: 'Le 4h se vend mieux avec un message pour un public précis', domain: 'retail' },
          { claim: 'La qualité ne compte pas', verdict: 'REJECT', changeMind: 'deux mesures' },
          { claim: 'On achète ce que ça signifie', verdict: 'SAME' },
          { claim: 'x', verdict: 'MAYBE', rule: 'x' },
        ],
        priorities: [{ title: 'Tester deux messages', corner: 'cafe', lessonIds: ['new:1', 'new:2', 'n1', 'new:9', 'zz'] }],
        confidence: [{ id: 'n1', confidence: 140, why: 'Express +51 %', status: 'adopted' }, { id: 'n1', confidence: 50 }],
        replies: [{ id: 'n1', reply: 'Je garde : les chiffres le montrent' }, { id: 'n9', reply: 'x' }],
      },
      { ...ctx, lessonIds: ['n1'], learnIds: ['learn-1'], contestedIds: ['n1'], domain: 'coworking' },
      '2026-11-19',
    );
    expect(plan.lessons.map((l) => [l.ref, l.verdict, l.rule, l.domain, l.learnId])).toEqual([
      [0, 'ADOPT', 'Choisir le public avant le prix', '*', 'learn-1'],
      [1, 'TEST', 'Le 4h se vend mieux avec un message pour un public précis', 'coworking', 'learn-1'],
      [2, 'REJECT', 'La qualité ne compte pas', 'coworking', null],
    ]);
    expect(plan.priorities[0].lessonIds).toEqual(['new:1', 'n1']);
    expect(plan.confidence).toEqual([{ id: 'n1', confidence: 100, why: 'Express +51 %', status: 'ADOPTED' }]);
    expect(plan.replies).toEqual([{ id: 'n1', reply: 'Je garde : les chiffres le montrent', rule: null, status: null }]);
    expect(plan.warnings).toEqual([
      'lessons[3] ignoré : SAME sans leçon connue (sameAs)',
      'lessons[4] ignoré : verdict inconnu',
      'confidence[1] ignoré : sans raison',
      'replies[1] ignoré : pas de contestation en attente',
    ]);
  });
});
