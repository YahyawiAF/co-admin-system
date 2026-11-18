import type { DayFact } from '../../business-manager-core';
import { corners, dropAlert, parseImport, parseUpdate } from './director';

const day = (key: string, money: number, visits: number): DayFact => ({
  key,
  weekday: new Date(`${key}T12:00:00`).getDay(),
  revenueVisits: money,
  products: 0,
  visits,
  newVisitors: 0,
  subscriptions: 0,
  events: 0,
});

/** `n` days ending yesterday (18 Nov 2026 is « today »), each at `money` / `visits`, the last 7 at `last`. */
function facts(money: number, visits: number, last?: { money: number; visits: number }) {
  const out: DayFact[] = [];
  for (let i = 35; i >= 1; i--) {
    const d = new Date(2026, 10, 18, 12);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    out.push(i <= 7 && last ? day(key, last.money, last.visits) : day(key, money, visits));
  }
  return out;
}
const today = new Date(2026, 10, 18, 11);

describe('Directeur drop alert', () => {
  it('compares the last 7 days with the same weekdays before', () => {
    const a = dropAlert(facts(190, 34, { money: 94, visits: 18 }), today)!;
    expect(a).toMatchObject({ moneyNow: 94, moneyBefore: 190, clientsNow: 18, clientsBefore: 34, status: 'red', from: '2026-11-11', to: '2026-11-17' });
    expect(a.moneyPct).toBe(-51);
    expect(a.startedOn).toBe('2026-11-11');
  });

  it('says nothing when the week is normal', () => {
    expect(dropAlert(facts(150, 30), today)).toMatchObject({ status: null, moneyPct: 0, startedOn: null });
  });

  it('needs history to judge', () => {
    expect(dropAlert(facts(150, 30).slice(-8), today)).toBeNull();
  });
});

describe('Directeur corners', () => {
  const base = { entries: [], custom: [], charges: 0, alert: null };
  it('takes the colour of the bilan point, else the memory', () => {
    const list = corners({
      ...base,
      areas: [
        { id: 'nouveaux', status: 'green', statusLabel: 'Ça va', headline: 'Les nouveaux augmentent' },
        { id: 'retour', status: 'orange', statusLabel: 'À surveiller', headline: 'Seulement 30 % reviennent' },
      ],
      entries: [{ corner: 'prix', text: 'Tarif 1h supprimé', date: '2026-11-10' }],
    });
    expect(list.find((c) => c.id === 'clients')).toMatchObject({ status: 'orange', fact: 'Seulement 30 % reviennent' });
    expect(list.find((c) => c.id === 'prix')).toMatchObject({ status: 'grey', statusLabel: 'Suivi par la mémoire', fact: 'Tarif 1h supprimé', notes: 1 });
    expect(list.find((c) => c.id === 'couts')).toMatchObject({ statusLabel: 'Manque des données' });
  });

  it('a money drop turns Clients red', () => {
    const alert = dropAlert(facts(190, 34, { money: 94, visits: 18 }), today);
    const list = corners({ ...base, areas: [], alert });
    expect(list.find((c) => c.id === 'clients')).toMatchObject({ status: 'red', fact: '18 clients par jour contre 34 d’habitude' });
  });
});

describe('Directeur import', () => {
  it('reads « date | type | coin | texte | détail » lines and adds unknown corners', () => {
    const x = parseImport(
      ['2026-11-10 | Décision | Prix & offres | Tarif 1h supprimé | rapportait 39 DT/jour', '2026-11-18 | Leçon | Partenariats | École voisine intéressée', 'pas une ligne'].join('\n'),
      [{ id: 'prix', name: 'Prix & offres' }],
    );
    expect(x.entries).toEqual([
      { date: '2026-11-10', kind: 'DECISION', corner: 'prix', text: 'Tarif 1h supprimé', detail: 'rapportait 39 DT/jour' },
      { date: '2026-11-18', kind: 'LESSON', corner: 'partenariats', text: 'École voisine intéressée', detail: null },
    ]);
    expect(x.newCorners).toEqual([{ id: 'partenariats', name: 'Partenariats' }]);
    expect(x.skipped).toEqual(['pas une ligne']);
  });
});

describe('Directeur update from Claude', () => {
  const known = { corners: [{ id: 'clients', name: 'Clients' }, { id: 'prix', name: 'Prix & offres' }], entryIds: ['e1', 'e2'] };
  const base = { format: 'directeur-update/v1', basedOn: '2026-11-18T10:00:00Z' };

  it('keeps what is valid and lists what is not', () => {
    const p = parseUpdate(
      {
        ...base,
        summary: 'La baisse suit le règlement.',
        priorities: [{ title: 'Tester le règlement une fois', corner: 'Expérience', why: 'baisse le 12 nov' }],
        corners: [{ name: 'Expérience' }],
        add: [
          { date: '2026-11-18', kind: 'lesson', corner: 'Prix & offres', text: 'Le 2h a remplacé le 1h' },
          { kind: 'FACT', corner: 'Inconnu', text: 'x' },
        ],
        update: [{ id: 'e1', detail: 'précisé' }, { id: 'zz', text: 'y' }],
        remove: ['e2', 'nope'],
        questions: ['Quel jour exact ?'],
      },
      known,
      '2026-11-19',
    );
    expect(p.corners).toEqual([{ id: 'experience', name: 'Expérience' }]);
    expect(p.priorities).toEqual([{ title: 'Tester le règlement une fois', corner: 'experience', why: 'baisse le 12 nov', steps: [], legs: [], watch: [] }]);
    expect(p.add).toEqual([{ date: '2026-11-18', kind: 'LESSON', corner: 'prix', text: 'Le 2h a remplacé le 1h', detail: null }]);
    expect(p.update).toEqual([{ id: 'e1', detail: 'précisé' }]);
    expect(p.remove).toEqual(['e2']);
    expect(p.questions).toEqual(['Quel jour exact ?']);
    expect(p.warnings).toHaveLength(3);
  });

  it('reads a pasted answer, even wrapped in ```json, and refuses another format', () => {
    expect(parseUpdate('```json\n' + JSON.stringify({ ...base, add: [] }) + '\n```', known, '2026-11-19').add).toEqual([]);
    expect(() => parseUpdate('{"format":"autre"}', known, '2026-11-19')).toThrow('directeur-update/v2');
    expect(() => parseUpdate('pas du json', known, '2026-11-19')).toThrow('JSON');
  });
});
