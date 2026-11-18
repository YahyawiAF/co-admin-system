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

// ---------------------------------------------------------------------------
// Round trip with Claude without an API key: the app exports, Claude answers with an update
// ---------------------------------------------------------------------------

export const EXPORT_FORMAT = 'directeur/v1';
export const UPDATE_FORMAT = 'directeur-update/v1';

/** Written into every export so any Claude chat knows what to send back. */
export const UPDATE_INSTRUCTIONS = [
  'Tu es le cerveau du Directeur de cet espace de coworking. Lis goal, month, alert, corners, memory, tests, questions et numbers (les chiffres calculés par l’app).',
  'Réponds par UN objet JSON, sans texte autour, de cette forme :',
  '{ "format": "directeur-update/v1", "basedOn": <exportedAt de cet export>, "summary": "3 phrases au plus", ' +
    '"priorities": [{ "title": "…", "corner": "<id de coin>", "why": "…" }] (3 au plus), ' +
    '"add": [{ "date": "AAAA-MM-JJ", "kind": "DECISION|FACT|LESSON|TEST", "corner": "<id>", "text": "…", "detail": "…" }], ' +
    '"update": [{ "id": "<id d’une note>", "text": "…", "detail": "…", "kind": "…", "corner": "…", "date": "…" }], ' +
    '"remove": ["<id d’une note fausse ou en double>"], "corners": [{ "name": "Nouveau coin" }], "questions": ["question au propriétaire"] }',
  'Règles : n’invente aucun chiffre (prends-les dans numbers ou memory) ; add = seulement ce qui est nouveau (leçons tirées des chiffres, faits constatés), pas ce qui est déjà dans memory ; une question seulement si la réponse change une priorité ; corner = un id de corners, ou le nom d’un coin ajouté dans corners.',
];

export type UpdatePlan = {
  basedOn: string | null;
  summary: string | null;
  priorities: Array<{ title: string; corner: string; why: string }>;
  add: ImportedEntry[];
  update: Array<{ id: string; text?: string; detail?: string | null; kind?: EntryKind; corner?: string; date?: string }>;
  remove: string[];
  corners: Array<{ id: string; name: string }>;
  questions: string[];
  warnings: string[];
};

const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Checks Claude's answer before anything is saved: known ids only, known or new corners,
 * valid dates and kinds. What can't be used is listed in `warnings`, never applied.
 */
export function parseUpdate(raw: unknown, known: { corners: Array<{ id: string; name: string }>; entryIds: string[] }, today: string): UpdatePlan {
  let x: Record<string, unknown>;
  if (typeof raw === 'string') {
    const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    try {
      x = JSON.parse(text);
    } catch {
      throw new Error('Ce n’est pas du JSON valide');
    }
  } else x = raw as Record<string, unknown>;
  if (!x || typeof x !== 'object' || Array.isArray(x)) throw new Error('Il faut un objet JSON');
  if (x.format !== UPDATE_FORMAT) throw new Error(`Format attendu : « ${UPDATE_FORMAT} »`);

  const warnings: string[] = [];
  const corners: Array<{ id: string; name: string }> = [];
  for (const c of Array.isArray(x.corners) ? x.corners : []) {
    const name = str((c as { name?: unknown })?.name, 40);
    if (!name) continue;
    const id = cornerId(name);
    if ([...known.corners, ...corners].some((k) => k.id === id)) continue;
    corners.push({ id, name });
  }
  const all = [...known.corners, ...corners];
  const corner = (v: unknown) => {
    const s = str(v, 60);
    if (!s) return null;
    return all.find((c) => c.id === s || c.id === cornerId(s) || cornerId(c.name) === cornerId(s))?.id ?? null;
  };
  const kind = (v: unknown) => (typeof v === 'string' && (ENTRY_KINDS as readonly string[]).includes(v.toUpperCase()) ? (v.toUpperCase() as EntryKind) : null);

  const add: ImportedEntry[] = [];
  for (const [i, e] of (Array.isArray(x.add) ? x.add : []).entries()) {
    const o = (e ?? {}) as Record<string, unknown>;
    const text = str(o.text, 300);
    const c = corner(o.corner);
    if (!text || !c) {
      warnings.push(`add[${i}] ignoré : ${!text ? 'texte vide' : `coin inconnu « ${String(o.corner)} »`}`);
      continue;
    }
    const date = typeof o.date === 'string' && DAY_KEY.test(o.date) ? o.date : today;
    add.push({ date, kind: kind(o.kind) ?? 'FACT', corner: c, text, detail: str(o.detail, 500) });
  }

  const ids = new Set(known.entryIds);
  const update: UpdatePlan['update'] = [];
  for (const [i, e] of (Array.isArray(x.update) ? x.update : []).entries()) {
    const o = (e ?? {}) as Record<string, unknown>;
    if (typeof o.id !== 'string' || !ids.has(o.id)) {
      warnings.push(`update[${i}] ignoré : note inconnue`);
      continue;
    }
    const u: UpdatePlan['update'][number] = { id: o.id };
    if (o.text !== undefined) {
      const t = str(o.text, 300);
      if (t) u.text = t;
    }
    if (o.detail !== undefined) u.detail = str(o.detail, 500);
    if (o.kind !== undefined && kind(o.kind)) u.kind = kind(o.kind)!;
    if (o.corner !== undefined) {
      const c = corner(o.corner);
      if (c) u.corner = c;
      else warnings.push(`update[${i}] : coin inconnu « ${String(o.corner)} », gardé tel quel`);
    }
    if (typeof o.date === 'string' && DAY_KEY.test(o.date)) u.date = o.date;
    if (Object.keys(u).length > 1) update.push(u);
  }

  const remove: string[] = [];
  for (const id of Array.isArray(x.remove) ? x.remove : []) {
    if (typeof id === 'string' && ids.has(id)) remove.push(id);
    else warnings.push(`remove : note inconnue « ${String(id)} »`);
  }

  const priorities: UpdatePlan['priorities'] = [];
  for (const p of (Array.isArray(x.priorities) ? x.priorities : []).slice(0, 3)) {
    const o = (p ?? {}) as Record<string, unknown>;
    const title = str(o.title, 200);
    if (title) priorities.push({ title, corner: corner(o.corner) ?? 'clients', why: str(o.why, 300) ?? '' });
  }
  if (Array.isArray(x.priorities) && x.priorities.length > 3) warnings.push('Plus de 3 priorités : seules les 3 premières sont gardées');

  const questions = (Array.isArray(x.questions) ? x.questions : []).map((q) => str(q, 300)).filter((q): q is string => !!q).slice(0, 5);

  return {
    basedOn: str(x.basedOn, 40),
    summary: str(x.summary, 800),
    priorities,
    add,
    update,
    remove,
    corners,
    questions,
    warnings,
  };
}
