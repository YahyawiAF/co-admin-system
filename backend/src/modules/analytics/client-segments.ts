/**
 * Finance › Clients: each client's group from their visit days (owner rules, 2026-11-20).
 * Plain functions, read only. Abonnement status is kept apart from the group.
 */
import { differenceInCalendarDays } from 'date-fns';
import { localDayKey } from '../../../common/parse-local-day';

export const CLIENT_SEGMENTS = ['NEW', 'OCCASIONAL', 'REGULAR', 'AT_RISK', 'INACTIVE'] as const;
export type ClientSegment = (typeof CLIENT_SEGMENTS)[number];

export type ClientRules = {
  /** Nouveau: first visit less than N days ago */
  newDays: number;
  /** Régulier: at least N visit days in the last 30 days */
  regularVisits: number;
  /** À risque: was regular, absent N days or more */
  riskDays: number;
  /** Inactif: no visit for N days or more */
  inactiveDays: number;
  /** At most one message every N days per client */
  messageGapDays: number;
};

export const DEFAULT_CLIENT_RULES: ClientRules = {
  newDays: 7,
  regularVisits: 4,
  riskDays: 10,
  inactiveDays: 30,
  messageGapDays: 7,
};

/** Window used to count visits ("en 30 jours"). */
export const WINDOW_DAYS = 30;

const LIMITS: Record<keyof ClientRules, [number, number]> = {
  newDays: [1, 30],
  regularVisits: [2, 30],
  riskDays: [3, 60],
  inactiveDays: [14, 180],
  messageGapDays: [1, 60],
};

/** Saved rules merged over the defaults; out-of-range values fall back to the default. */
export function clientRules(saved: unknown): ClientRules {
  const out = { ...DEFAULT_CLIENT_RULES };
  if (saved && typeof saved === 'object') {
    for (const k of Object.keys(LIMITS) as Array<keyof ClientRules>) {
      const v = Math.round(Number((saved as Record<string, unknown>)[k]));
      const [min, max] = LIMITS[k];
      if (Number.isFinite(v) && v >= min && v <= max) out[k] = v;
    }
  }
  if (out.riskDays >= out.inactiveDays) out.riskDays = Math.min(DEFAULT_CLIENT_RULES.riskDays, out.inactiveDays - 1);
  return out;
}

/** Checks an edit of the rules; throws a readable message when a value is out of range. */
export function checkClientRules(body: Partial<Record<keyof ClientRules, unknown>>, current: ClientRules): ClientRules {
  const next = { ...current };
  for (const k of Object.keys(LIMITS) as Array<keyof ClientRules>) {
    if (body[k] == null) continue;
    const v = Math.round(Number(body[k]));
    const [min, max] = LIMITS[k];
    if (!Number.isFinite(v) || v < min || v > max) throw new Error(`Valeur hors limites (${min}–${max})`);
    next[k] = v;
  }
  if (next.riskDays >= next.inactiveDays) throw new Error('« À risque » doit être plus court que « Inactif »');
  return next;
}

export const SEGMENT_LABEL: Record<ClientSegment, string> = {
  NEW: 'Nouveau',
  OCCASIONAL: 'Occasionnel',
  REGULAR: 'Régulier',
  AT_RISK: 'À risque',
  INACTIVE: 'Inactif',
};

export function segmentRules(r: ClientRules): Record<ClientSegment, string> {
  return {
    NEW: `1ʳᵉ visite il y a moins de ${r.newDays} jours`,
    OCCASIONAL: `Venu ces ${WINDOW_DAYS} jours, moins de ${r.regularVisits} fois`,
    REGULAR: `${r.regularVisits} visites ou plus en ${WINDOW_DAYS} jours`,
    AT_RISK: `Était régulier, absent depuis ${r.riskDays} jours ou plus`,
    INACTIVE: `Pas venu depuis ${r.inactiveDays} jours ou plus`,
  };
}

export type ClientActivity = {
  segment: ClientSegment;
  /** Plain-words reason shown under the badge */
  why: string;
  visitDays: number;
  /** Visit days in the last 30 days (today included) */
  visits30: number;
  /** yyyy-MM-dd */
  first: string;
  last: string;
  daysSinceFirst: number;
  daysSinceLast: number;
};

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;
const ago = (n: number) => (n === 0 ? "aujourd'hui" : n === 1 ? 'hier' : `il y a ${n} jours`);

/**
 * A client's group from their check-ins. Several check-ins the same day count as one visit.
 * Order: Nouveau, then Inactif, then Régulier / À risque, else Occasionnel — one group each.
 */
export function clientActivity(visits: Date[], now: Date, rules: ClientRules = DEFAULT_CLIENT_RULES): ClientActivity | null {
  const keys = [...new Set(visits.map((d) => localDayKey(d)))].sort();
  if (!keys.length) return null;
  const days = keys.map((k) => new Date(`${k}T12:00:00`));
  const since = (d: Date) => differenceInCalendarDays(now, d);
  const daysSinceFirst = since(days[0]);
  const daysSinceLast = since(days[days.length - 1]);
  const visits30 = days.filter((d) => since(d) < WINDOW_DAYS).length;
  /** Visit days in the 30 days that ended with the last visit: "was regular" */
  const lastDay = days[days.length - 1];
  const beforeLast = days.filter((d) => differenceInCalendarDays(lastDay, d) < WINDOW_DAYS).length;

  let segment: ClientSegment;
  let why: string;
  if (daysSinceFirst < rules.newDays) {
    segment = 'NEW';
    why =
      days.length === 1
        ? `1ʳᵉ visite ${ago(daysSinceFirst)}${daysSinceFirst >= 3 ? ', pas revenu' : ''}`
        : `1ʳᵉ visite ${ago(daysSinceFirst)}, déjà ${plural(days.length, 'visite')}`;
  } else if (daysSinceLast >= rules.inactiveDays) {
    segment = 'INACTIVE';
    why = `Pas venu depuis ${daysSinceLast} jours`;
  } else if (beforeLast >= rules.regularVisits && daysSinceLast >= rules.riskDays) {
    segment = 'AT_RISK';
    why = `Venait ${beforeLast} fois en ${WINDOW_DAYS} jours, absent depuis ${daysSinceLast} jours`;
  } else if (visits30 >= rules.regularVisits) {
    segment = 'REGULAR';
    why = `${plural(visits30, 'visite')} en ${WINDOW_DAYS} jours`;
  } else {
    segment = 'OCCASIONAL';
    why =
      daysSinceLast >= rules.riskDays
        ? `${plural(visits30, 'visite')} en ${WINDOW_DAYS} jours, dernière ${ago(daysSinceLast)}`
        : `${plural(visits30, 'visite')} en ${WINDOW_DAYS} jours`;
  }
  return { segment, why, visitDays: days.length, visits30, first: keys[0], last: keys[keys.length - 1], daysSinceFirst, daysSinceLast };
}
