import type { DayFact } from '../../business-manager-core';
import { corners, dropAlert, parseImport } from './director';

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
