/**
 * Portable business-manager core: no database, no framework.
 * The host app builds `MoneyFacts` from its own tables (an adapter) and stores `AnswerRecord`s.
 */

export const MONEY_KEYS = ['bank', 'safe', 'charges', 'payroll', 'taxes', 'promised', 'reserve'] as const;
export type MoneyKey = (typeof MONEY_KEYS)[number];

/** One answer the owner gave. `unknown` = "Je ne sais pas" (kept, but not used as a number). */
export type AnswerRecord = {
  key: string;
  value: number | null;
  label: string;
  note?: string | null;
  unknown: boolean;
  answeredAt: Date;
};

/** What the host app already knows. Anything left null/undefined is asked to the owner. */
export type MoneyFacts = {
  asOf: Date;
  /** Cash in the drawer now (the host's own cash register). */
  cashDrawer: { amount: number; detail: string };
  /** Safe / petty cash. `hasMovements` false = the app has never recorded anything, so it is confirmed with the owner. */
  safe: { amount: number; hasMovements: boolean };
  /** Bank balance, when the host tracks it. */
  bank?: { amount: number; at: Date } | null;
  /** Recurring monthly charges recorded in the app (count 0 = none recorded). */
  fixedCharges?: { monthly: number; count: number } | null;
  /** Monthly payroll + social contributions, when the host tracks it. */
  payroll?: { monthly: number } | null;
  /** Money taken in during the last full month. */
  lastFullMonth?: { label: string; income: number } | null;
  /** Host pages the questions can link to. */
  links?: { fixedCharges?: string };
};

export type Choice = { label: string; value: number; note?: string; recommended?: boolean };

export type Question = {
  key: MoneyKey;
  short: string;
  title: string;
  why: string;
  choices: Choice[];
  exactLabel?: string;
  unknownLabel?: string;
  more?: { label: string; href: string };
  /** MISSING = never answered, STALE = answer too old, UNKNOWN = owner said "je ne sais pas" */
  reason: 'MISSING' | 'STALE' | 'UNKNOWN';
  priority: number;
};

export type SourceKind = 'APP' | 'APP_UNCONFIRMED' | 'ANSWER' | 'DEFAULT' | 'MISSING' | 'UNKNOWN' | 'CALC';

export type MoneyLine = {
  key: string;
  label: string;
  detail?: string;
  /** null = not known yet */
  amount: number | null;
  /** +1 money you have, -1 money to keep */
  sign: 1 | -1;
  source: { kind: SourceKind; at?: string };
};

export type MoneyPlan = {
  /** UNKNOWN = a required figure is missing, PARTIAL = only taxes are missing, OK = complete */
  state: 'UNKNOWN' | 'PARTIAL' | 'OK';
  missing: string[];
  liquid: number | null;
  keep: number | null;
  invest: number | null;
  monthlyCosts: number | null;
  reserveMonths: number;
  lines: MoneyLine[];
  verdict:
    | { kind: 'MISSING' }
    | { kind: 'NO'; shortfall: number }
    | { kind: 'SMALL_TEST'; invest: number; income: number; incomeLabel: string; costs: number }
    | { kind: 'OK'; invest: number };
};
