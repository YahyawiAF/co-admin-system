import { dayLabel, isStale } from './questions';
import type { AnswerRecord, MoneyFacts, MoneyKey, MoneyLine, MoneyPlan, SourceKind } from './types';

export const DEFAULT_RESERVE_MONTHS = 2;
const round = (n: number) => Math.round(n * 100) / 100;

type Figure = { amount: number | null; source: MoneyLine['source'] };

function fromAnswer(key: MoneyKey, answers: Map<string, AnswerRecord>, asOf: Date): Figure {
  const a = answers.get(key);
  if (!a) return { amount: null, source: { kind: 'MISSING' } };
  if (a.unknown || a.value == null) return { amount: null, source: { kind: 'UNKNOWN' } };
  const at = dayLabel(a.answeredAt) + (isStale(key, a, asOf) ? ' · à revoir' : '');
  return { amount: a.value, source: { kind: 'ANSWER', at } };
}
const app = (amount: number, kind: SourceKind = 'APP'): Figure => ({ amount, source: { kind } });

/**
 * How much to keep and how much can be invested. Deterministic: rules compute, the AI only explains.
 *
 *   invest = max(0, cash + safe + bank − bills of the next 30 days − taxes − already promised − reserve)
 *   bills of the next 30 days = fixed charges + payroll (one month)
 *   reserve = N months × (fixed charges + payroll)
 *
 * Money owed by customers is never counted until it is paid.
 */
export function computeMoneyPlan(facts: MoneyFacts, answers: Map<string, AnswerRecord>): MoneyPlan {
  const asOf = facts.asOf;
  const ans = (k: MoneyKey) => fromAnswer(k, answers, asOf);

  const cash = app(facts.cashDrawer.amount);
  const safe = answers.has('safe') && !facts.safe.hasMovements
    ? ans('safe')
    : app(facts.safe.amount, facts.safe.hasMovements ? 'APP' : 'APP_UNCONFIRMED');
  // An unknown safe answer falls back to the app figure (never blocks the result)
  const safeUsed: Figure = safe.amount == null ? app(facts.safe.amount, 'APP_UNCONFIRMED') : safe;
  const bank = facts.bank ? { amount: facts.bank.amount, source: { kind: 'APP' as const, at: dayLabel(facts.bank.at) } } : ans('bank');
  const charges = facts.fixedCharges?.count ? app(facts.fixedCharges.monthly) : ans('charges');
  const payroll = facts.payroll ? app(facts.payroll.monthly) : ans('payroll');
  const taxes = ans('taxes');
  const promised = ans('promised');
  const reserveAns = ans('reserve');
  const reserveMonths = reserveAns.amount ?? DEFAULT_RESERVE_MONTHS;

  const required: Array<[string, Figure]> = [
    ['Banque', bank],
    ['Charges fixes', charges],
    ['Salaires + CNSS', payroll],
    ['Déjà promis', promised],
  ];
  const missing = required.filter(([, f]) => f.amount == null).map(([l]) => l);

  const monthlyCosts = charges.amount != null && payroll.amount != null ? round(charges.amount + payroll.amount) : null;
  const liquid = bank.amount != null ? round(cash.amount! + safeUsed.amount! + bank.amount) : null;
  const reserve = monthlyCosts != null ? round(reserveMonths * monthlyCosts) : null;

  const lines: MoneyLine[] = [
    { key: 'cash', label: 'Caisse', detail: facts.cashDrawer.detail, amount: cash.amount, sign: 1, source: cash.source },
    { key: 'safe', label: 'Coffre', amount: safeUsed.amount, sign: 1, source: safeUsed.source },
    { key: 'bank', label: 'Banque', amount: bank.amount, sign: 1, source: bank.source },
    {
      key: 'bills',
      label: 'Factures des 30 prochains jours',
      detail: 'charges fixes + salaires',
      amount: monthlyCosts,
      sign: -1,
      source: worst(charges.source, payroll.source),
    },
    { key: 'taxes', label: 'Impôts / TVA (3 mois)', amount: taxes.amount, sign: -1, source: taxes.source },
    { key: 'promised', label: 'Déjà promis', amount: promised.amount, sign: -1, source: promised.source },
    {
      key: 'reserve',
      label: `Réserve : ${reserveMonths} mois de charges`,
      amount: reserve,
      sign: -1,
      source: reserveAns.source.kind === 'ANSWER' ? reserveAns.source : { kind: 'DEFAULT' },
    },
  ];

  if (missing.length || liquid == null || monthlyCosts == null || reserve == null) {
    lines.push({ key: 'invest', label: 'Vous pouvez investir', amount: null, sign: 1, source: { kind: 'CALC' } });
    return {
      state: 'UNKNOWN',
      missing,
      liquid,
      keep: null,
      invest: null,
      monthlyCosts,
      reserveMonths,
      lines,
      verdict: { kind: 'MISSING' },
    };
  }

  const keep = round(monthlyCosts + (taxes.amount ?? 0) + promised.amount! + reserve);
  const invest = round(Math.max(0, liquid - keep));
  lines.push({ key: 'invest', label: 'Vous pouvez investir', amount: invest, sign: 1, source: { kind: 'CALC' } });

  const income = facts.lastFullMonth;
  const verdict: MoneyPlan['verdict'] =
    invest <= 0
      ? { kind: 'NO', shortfall: round(keep - liquid) }
      : income && income.income < monthlyCosts
        ? { kind: 'SMALL_TEST', invest, income: income.income, incomeLabel: income.label, costs: monthlyCosts }
        : { kind: 'OK', invest };

  return {
    state: taxes.amount == null ? 'PARTIAL' : 'OK',
    missing: [],
    liquid,
    keep,
    invest,
    monthlyCosts,
    reserveMonths,
    lines,
    verdict,
  };
}

const RANK: SourceKind[] = ['MISSING', 'UNKNOWN', 'APP_UNCONFIRMED', 'DEFAULT', 'ANSWER', 'APP', 'CALC'];
function worst(a: MoneyLine['source'], b: MoneyLine['source']) {
  return RANK.indexOf(a.kind) <= RANK.indexOf(b.kind) ? a : b;
}

/** Can an idea with this cost be paid without touching what must be kept? */
export function ideaFit(cost: number, plan: MoneyPlan, notNow = false) {
  if (notNow) return 'NOT_NOW' as const;
  if (plan.invest == null) return 'WAITING' as const;
  return cost <= plan.invest ? ('IN_BUDGET' as const) : ('OVER_BUDGET' as const);
}
