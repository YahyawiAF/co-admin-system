/**
 * Directeur: the business mastermind. Rules for the money-drop alert, the corners of the
 * business and the memory import. Claude is the brain; these numbers are what it reads. Plain functions.
 */
import type { DayFact } from '../../business-manager-core';
import type { HealthStatus } from './health';

export const ENTRY_KINDS = ['DECISION', 'FACT', 'LESSON', 'TEST'] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];
export const KIND_LABEL: Record<EntryKind, string> = { DECISION: 'Décision', FACT: 'Fait', LESSON: 'Leçon', TEST: 'Test' };

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
const DAY = 86_400_000;
const round = (n: number) => Math.round(n);

export function cornerId(name: string) {
  return (
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'autre'
  );
}

export type DropAlert = {
  /** Last 7 full days, per day */
  moneyNow: number;
  moneyBefore: number;
  clientsNow: number;
  clientsBefore: number;
  moneyPct: number;
  clientsPct: number;
  status: 'red' | 'orange' | null;
  from: string;
  to: string;
  /** First day of the 7 at 25 % or more under its usual level */
  startedOn: string | null;
};

/**
 * Last 7 full days against the same weekdays of the 4 weeks before (a Monday is only
 * compared with Mondays). Money = passes + café, clients = check-ins.
 */
export function dropAlert(facts: DayFact[], today: Date): DropAlert | null {
  const byKey = new Map(facts.map((d) => [d.key, d]));
  const key = (t: number) => {
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const noon = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12).getTime();
  const money = (d?: DayFact) => (d ? d.revenueVisits + d.products : 0);
  let mNow = 0;
  let mBefore = 0;
  let cNow = 0;
  let cBefore = 0;
  let startedOn: string | null = null;
  let seen = 0;
  for (let i = 7; i >= 1; i--) {
    const t = noon - i * DAY;
    const day = byKey.get(key(t));
    const past = [1, 2, 3, 4].map((w) => byKey.get(key(t - w * 7 * DAY))).filter((d): d is DayFact => !!d);
    if (!past.length) continue;
    seen += 1;
    const usualMoney = past.reduce((a, d) => a + money(d), 0) / past.length;
    const usualClients = past.reduce((a, d) => a + d.visits, 0) / past.length;
    mNow += money(day);
    cNow += day?.visits ?? 0;
    mBefore += usualMoney;
    cBefore += usualClients;
    if (!startedOn && usualMoney > 0 && money(day) <= usualMoney * 0.75) startedOn = key(t);
  }
  if (seen < 5 || mBefore <= 0) return null;
  const moneyPct = round(((mNow - mBefore) / mBefore) * 100);
  const clientsPct = cBefore > 0 ? round(((cNow - cBefore) / cBefore) * 100) : 0;
  return {
    moneyNow: round(mNow / seen),
    moneyBefore: round(mBefore / seen),
    clientsNow: round(cNow / seen),
    clientsBefore: round(cBefore / seen),
    moneyPct,
    clientsPct,
    status: moneyPct <= -25 ? 'red' : moneyPct <= -10 ? 'orange' : null,
    from: key(noon - 7 * DAY),
    to: key(noon - DAY),
    startedOn: moneyPct <= -10 ? startedOn : null,
  };
}

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

export type ImportedEntry = { date: string; kind: EntryKind; corner: string; text: string; detail: string | null };

const KIND_WORDS: Record<string, EntryKind> = {
  decision: 'DECISION',
  fait: 'FACT',
  fact: 'FACT',
  lecon: 'LESSON',
  lesson: 'LESSON',
  test: 'TEST',
};

/**
 * Lines « 2026-11-10 | Décision | Prix & offres | Tarif 1h supprimé | détail » (detail optional).
 * Unknown corners become the owner's own corners. Returns the entries and the lines it could not read.
 */
export function parseImport(text: string, known: Array<{ id: string; name: string }>) {
  const entries: ImportedEntry[] = [];
  const skipped: string[] = [];
  const newCorners: Array<{ id: string; name: string }> = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split('|').map((p) => p.trim());
    const [date, kindWord, cornerName, body, detail] = parts;
    const kind = KIND_WORDS[cornerId(kindWord ?? '').replace(/-/g, '')];
    if (parts.length < 4 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !kind || !cornerName || !body) {
      skipped.push(line);
      continue;
    }
    const id = cornerId(cornerName);
    const match = [...known, ...newCorners].find((c) => c.id === id || cornerId(c.name) === id);
    if (!match) newCorners.push({ id, name: cornerName });
    entries.push({ date, kind, corner: match?.id ?? id, text: body.slice(0, 300), detail: detail ? detail.slice(0, 500) : null });
  }
  return { entries, skipped, newCorners };
}
