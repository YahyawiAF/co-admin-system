/**
 * Directeur: the business mastermind. Rules for the money-drop alert, the corners of the
 * business and the memory import. Claude is the brain; these numbers are what it reads. Plain functions.
 */
import type { HealthStatus } from './health';
import { cornerId, type DropAlert } from '../../director-core';

export {
  cornerId,
  dropAlert,
  ENTRY_KINDS,
  KIND_LABEL,
  parseImport,
  parseUpdate,
  type DropAlert,
  type EntryKind,
  type ImportedEntry,
  type UpdatePlan,
} from '../../director-core';

/** Corners every space has. `areas` = the Conseil bilan points that judge it; none = followed by the memory only. */
export const BASE_CORNERS: Array<{ id: string; name: string; areas?: string[] }> = [
  { id: 'clients', name: 'Clients', areas: ['nouveaux', 'retour'] },
  { id: 'surplace', name: 'Expérience sur place' },
  { id: 'prix', name: 'Prix & offres' },
  { id: 'abos', name: 'Abonnements', areas: ['abos'] },
  { id: 'cafe', name: 'Café', areas: ['cafe'] },
  { id: 'creux', name: 'Jours creux', areas: ['creux'] },
  { id: 'impayes', name: 'Impayés', areas: ['impayes'] },
  { id: 'couts', name: 'Coûts' },
  { id: 'marketing', name: 'Marketing' },
  { id: 'revenus', name: 'Nouveaux revenus' },
];

const RANK: Record<HealthStatus, number> = { red: 0, orange: 1, grey: 2, green: 3 };
const round = (n: number) => Math.round(n);

export type CornerInput = {
  areas: Array<{ id: string; status: HealthStatus; statusLabel: string; headline: string }>;
  entries: Array<{ corner: string; text: string; date: string }>;
  custom: Array<{ id: string; name: string }>;
  charges: number;
  alert: DropAlert | null;
};

export type Corner = {
  id: string;
  name: string;
  status: HealthStatus;
  statusLabel: string;
  fact: string;
  notes: number;
  custom: boolean;
};

/** Every corner with its colour and one line: from the bilan rules when it has some, else from the memory. */
export function corners(x: CornerInput): Corner[] {
  const list: Array<{ id: string; name: string; areas?: string[]; custom: boolean }> = [
    ...BASE_CORNERS.map((c) => ({ ...c, custom: false })),
    ...x.custom.map((c) => ({ ...c, custom: true })),
  ];
  return list.map((c) => {
    const mine = x.entries.filter((e) => e.corner === c.id).sort((a, b) => b.date.localeCompare(a.date));
    const lastNote = mine[0]?.text ?? null;
    const base = { id: c.id, name: c.name, notes: mine.length, custom: c.custom };
    const judged = (c.areas ?? []).map((id) => x.areas.find((a) => a.id === id)).filter((a): a is CornerInput['areas'][number] => !!a);
    if (c.id === 'clients' && x.alert?.status && x.alert.clientsPct < 0) {
      return {
        ...base,
        status: x.alert.status,
        statusLabel: x.alert.status === 'red' ? 'À régler' : 'À surveiller',
        fact: `${x.alert.clientsNow} clients par jour contre ${x.alert.clientsBefore} d’habitude`,
      };
    }
    if (judged.length) {
      const worst = judged.reduce((a, b) => (RANK[b.status] < RANK[a.status] ? b : a));
      return { ...base, status: worst.status, statusLabel: worst.statusLabel, fact: worst.headline };
    }
    if (c.id === 'couts') {
      return x.charges > 0
        ? { ...base, status: 'green', statusLabel: 'Renseigné', fact: `${round(x.charges).toLocaleString('fr-FR')} DT de charges ce mois` }
        : { ...base, status: 'grey', statusLabel: 'Manque des données', fact: 'Aucune dépense du mois dans l’app' };
    }
    return {
      ...base,
      status: 'grey',
      statusLabel: mine.length ? 'Suivi par la mémoire' : 'Rien de noté',
      fact: lastNote ?? 'Note ce que tu sais ou ce que tu changes ici',
    };
  });
}
