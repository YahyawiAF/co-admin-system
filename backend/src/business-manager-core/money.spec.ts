import { computeMoneyPlan, ideaFit } from './money';
import { featureIdeas } from './features';
import { knowledge, pendingQuestions } from './questions';
import type { AnswerRecord, MoneyFacts } from './types';

const NOW = new Date(2026, 9, 28, 12);
const facts = (over: Partial<MoneyFacts> = {}): MoneyFacts => ({
  asOf: NOW,
  cashDrawer: { amount: 120, detail: 'test' },
  safe: { amount: 0, hasMovements: false },
  lastFullMonth: { label: 'septembre', income: 107.1 },
  ...over,
});
const ans = (rows: Array<[string, number | null, boolean?, Date?]>) =>
  new Map<string, AnswerRecord>(
    rows.map(([key, value, unknown, at]) => [
      key,
      { key, value, label: String(value), unknown: !!unknown, answeredAt: at ?? NOW },
    ]),
  );

const complete = () =>
  ans([
    ['bank', 20000],
    ['charges', 4300],
    ['payroll', 0],
    ['taxes', 500],
    ['promised', 0],
    ['reserve', 2],
  ]);

describe('computeMoneyPlan', () => {
  it('is UNKNOWN and invests nothing while the bank balance is missing', () => {
    const p = computeMoneyPlan(facts(), new Map());
    expect(p.state).toBe('UNKNOWN');
    expect(p.invest).toBeNull();
    expect(p.missing).toEqual(['Banque', 'Charges fixes', 'Salaires + CNSS', 'Déjà promis']);
  });

  it('keeps one month of bills, taxes, promises and the reserve', () => {
    const p = computeMoneyPlan(facts(), complete());
    // liquid 120 + 0 + 20000; keep 4300 + 500 + 0 + 2×4300
    expect(p.liquid).toBe(20120);
    expect(p.keep).toBe(13400);
    expect(p.invest).toBe(6720);
    expect(p.state).toBe('OK');
    // September brought 107 DT for 4 300 DT of costs: small test only
    expect(p.verdict.kind).toBe('SMALL_TEST');
  });

  it('never goes below zero and reports the shortfall', () => {
    const a = complete();
    a.set('bank', { key: 'bank', value: 3000, label: '', unknown: false, answeredAt: NOW });
    const p = computeMoneyPlan(facts(), a);
    expect(p.invest).toBe(0);
    expect(p.verdict).toEqual({ kind: 'NO', shortfall: 10280 });
  });

  it('is PARTIAL when only taxes are unknown, and computes without them', () => {
    const a = complete();
    a.set('taxes', { key: 'taxes', value: null, label: '', unknown: true, answeredAt: NOW });
    const p = computeMoneyPlan(facts(), a);
    expect(p.state).toBe('PARTIAL');
    expect(p.invest).toBe(7220);
  });

  it('uses the reserve months chosen by the owner, 2 by default', () => {
    const a = complete();
    a.delete('reserve');
    expect(computeMoneyPlan(facts(), a).reserveMonths).toBe(2);
    a.set('reserve', { key: 'reserve', value: 3, label: '', unknown: false, answeredAt: NOW });
    expect(computeMoneyPlan(facts(), a).keep).toBe(4300 + 500 + 3 * 4300);
  });

  it('prefers figures recorded in the app over answers', () => {
    const p = computeMoneyPlan(
      facts({ fixedCharges: { monthly: 1000, count: 3 }, safe: { amount: 500, hasMovements: true } }),
      complete(),
    );
    expect(p.monthlyCosts).toBe(1000);
    expect(p.liquid).toBe(20620);
    expect(p.lines.find((l) => l.key === 'safe')!.source.kind).toBe('APP');
  });

  it('says OK when the last month covered the costs', () => {
    const p = computeMoneyPlan(facts({ lastFullMonth: { label: 'sept', income: 9000 } }), complete());
    expect(p.verdict).toEqual({ kind: 'OK', invest: 6720 });
  });
});

describe('questions', () => {
  it('asks the bank first and skips what the app knows', () => {
    const q = pendingQuestions(facts({ fixedCharges: { monthly: 1000, count: 2 } }), new Map());
    expect(q[0].key).toBe('bank');
    expect(q.map((x) => x.key)).not.toContain('charges');
  });

  it('asks the bank again after 30 days, quoting the old figure', () => {
    const old = new Date(2026, 8, 1);
    const q = pendingQuestions(facts(), ans([['bank', 5000, false, old]]));
    const bank = q.find((x) => x.key === 'bank')!;
    expect(bank.reason).toBe('STALE');
    expect(bank.title).toContain('01/09');
  });

  it('puts "je ne sais pas" answers after new questions', () => {
    const q = pendingQuestions(facts(), ans([['bank', null, true]]));
    expect(q[q.length - 1].key).toBe('bank');
  });

  it('counts what it knows', () => {
    expect(knowledge(facts(), complete())).toEqual({ known: 6, total: 10 });
  });
});

describe('ideas and features', () => {
  it('checks an idea against the budget', () => {
    const p = computeMoneyPlan(facts(), complete());
    expect(ideaFit(120, p)).toBe('IN_BUDGET');
    expect(ideaFit(9000, p)).toBe('OVER_BUDGET');
    expect(ideaFit(120, computeMoneyPlan(facts(), new Map()))).toBe('WAITING');
  });

  it('asks for a bank field once the owner had to type the bank balance', () => {
    expect(featureIdeas(facts(), new Map())).toEqual([]);
    expect(featureIdeas(facts(), complete()).map((f) => f.key)).toEqual(['bank-balance-at-close']);
  });
});
