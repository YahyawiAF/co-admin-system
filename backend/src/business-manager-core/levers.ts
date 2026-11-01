/**
 * Lever map: the ways a business grows, checked against what the owner is
 * doing. A lever the numbers point to, with no action on it, is a missing
 * idea. Plain TypeScript; the list of levers comes from the host
 * (co-admin: `modules/analytics/levers-coworking.ts`).
 */

export type LeverGroup = 'ATTRACT' | 'RETURN' | 'SPEND' | 'FILL';

export const LEVER_GROUP_LABEL: Record<LeverGroup, string> = {
  ATTRACT: 'Attirer des nouveaux',
  RETURN: 'Faire revenir',
  SPEND: 'Faire payer plus',
  FILL: 'Remplir les creux',
};

/** What the owner did (an action / initiative). */
export type ActionRecord = {
  id: string;
  title: string;
  category: string | null;
  objective: string | null;
  channels: string[];
  startDate: Date;
  endDate: Date | null;
  /** WORKING | MIXED | NOT_WORKING */
  verdict: string | null;
  /** What the action sells, when tied to one (e.g. EVENT) */
  linkedKind?: string | null;
  /** Days aimed at (0 = Sunday); empty = every day */
  targetDays?: number[];
};

/** A relance list worked on recently (count of contacts in the last 30 days). */
export type OutreachRecord = { reason: string; contacts: number };

export type LeverIdea = {
  title: string;
  /** One or two sentences with the numbers behind the idea */
  why: string;
  steps: string[];
  /** What "Ajouter au plan" creates (host initiative payload) */
  plan: Record<string, unknown>;
};

export type LeverDef = {
  id: string;
  group: LeverGroup;
  title: string;
  /** What the numbers say, short */
  signal: string;
  /** 0–1: how strongly the numbers point to this lever */
  strength: number;
  /** Estimated money per month if done (host currency) */
  gain: number;
  /** Set when a needed figure is missing; the lever cannot be judged */
  noData?: string;
  /** An action on this lever */
  matchesAction?: (a: ActionRecord) => boolean;
  /** Relance reasons that count as working this lever */
  outreachReasons?: string[];
  /** Already handled by the app itself (e.g. an automatic nudge) */
  builtIn?: string;
  idea?: LeverIdea;
};

export type LeverStatus = 'WORKING' | 'IN_PROGRESS' | 'MISSING' | 'NO_DATA' | 'OK';

export type LeverResult = {
  id: string;
  group: LeverGroup;
  title: string;
  signal: string;
  status: LeverStatus;
  /** Short text next to the status (the action, why no data…) */
  note: string | null;
  gain: number;
  strength: number;
  actionId: string | null;
};

export type MissingIdea = LeverIdea & { leverId: string; group: LeverGroup; gain: number };

export type LeverMap = {
  groups: Array<{ group: LeverGroup; label: string; levers: LeverResult[] }>;
  missing: MissingIdea[];
  counts: Record<LeverStatus, number>;
};

/** Strength from which an uncovered lever is reported as missing. */
export const MISSING_FROM = 0.5;
/** An action counts for this long after it started when it has no end date. */
const ACTIVE_DAYS = 60;
const DAY = 86_400_000;

function activeAction(actions: ActionRecord[], def: LeverDef, now: Date) {
  if (!def.matchesAction) return null;
  const live = actions.filter((a) => {
    if (!def.matchesAction!(a) || a.startDate > now) return false;
    if (a.endDate) return a.endDate.getTime() >= now.getTime() - 14 * DAY;
    return a.startDate.getTime() >= now.getTime() - ACTIVE_DAYS * DAY;
  });
  return live.sort((a, b) => b.startDate.getTime() - a.startDate.getTime())[0] ?? null;
}

export function evaluateLevers(
  defs: LeverDef[],
  actions: ActionRecord[],
  outreach: OutreachRecord[],
  now: Date,
  opts: { maxIdeas?: number } = {},
): LeverMap {
  const results: LeverResult[] = defs.map((def) => {
    const base = { id: def.id, group: def.group, title: def.title, signal: def.signal, gain: Math.round(def.gain), strength: def.strength };
    if (def.noData) return { ...base, status: 'NO_DATA', note: def.noData, actionId: null };
    const action = activeAction(actions, def, now);
    if (action) {
      const working = action.verdict === 'WORKING';
      return { ...base, status: working ? 'WORKING' : 'IN_PROGRESS', note: action.title, actionId: action.id };
    }
    const contacts = (def.outreachReasons ?? []).reduce(
      (n, r) => n + (outreach.find((o) => o.reason === r)?.contacts ?? 0),
      0,
    );
    if (contacts > 0) {
      return { ...base, status: 'IN_PROGRESS', note: `${contacts} relance${contacts > 1 ? 's' : ''} en 30 jours`, actionId: null };
    }
    if (def.builtIn) return { ...base, status: 'IN_PROGRESS', note: def.builtIn, actionId: null };
    if (def.strength >= MISSING_FROM) return { ...base, status: 'MISSING', note: null, actionId: null };
    return { ...base, status: 'OK', note: 'pas prioritaire', actionId: null };
  });

  const order: LeverGroup[] = ['ATTRACT', 'RETURN', 'SPEND', 'FILL'];
  const rank: Record<LeverStatus, number> = { MISSING: 0, NO_DATA: 1, IN_PROGRESS: 2, WORKING: 3, OK: 4 };
  const groups = order.map((group) => ({
    group,
    label: LEVER_GROUP_LABEL[group],
    levers: results
      .filter((r) => r.group === group)
      .sort((a, b) => rank[a.status] - rank[b.status] || b.gain - a.gain),
  }));

  const missing = defs
    .filter((d) => d.idea && results.find((r) => r.id === d.id)?.status === 'MISSING')
    .sort((a, b) => b.gain - a.gain)
    .slice(0, opts.maxIdeas ?? 3)
    .map((d) => ({ ...d.idea!, leverId: d.id, group: d.group, gain: Math.round(d.gain) }));

  const counts = { WORKING: 0, IN_PROGRESS: 0, MISSING: 0, NO_DATA: 0, OK: 0 } as Record<LeverStatus, number>;
  for (const r of results) counts[r.status] += 1;

  return { groups, missing, counts };
}
