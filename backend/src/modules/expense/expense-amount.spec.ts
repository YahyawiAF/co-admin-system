import { expenseMonths, expensesInPeriod, guessCategory, shareIn } from './expense-amount';

describe('pour quel mois', () => {
  const paidNov4 = { date: new Date(2026, 10, 4), amount: 2000, label: 'louer' };

  it('counts in the month it is paid by default', () => {
    expect(expenseMonths(paidNov4)).toEqual(['2026-11']);
    expect(shareIn(paidNov4, '2026-11')).toBe(2000);
  });

  it('last month’s rent paid today counts in last month only', () => {
    const rent = { ...paidNov4, forMonth: '2026-10' };
    expect(shareIn(rent, '2026-10')).toBe(2000);
    expect(shareIn(rent, '2026-11')).toBe(0);
  });

  it('spreads equipment over several months', () => {
    const e = { date: new Date(2026, 10, 1), amount: 35, forMonth: '2026-11', spreadMonths: 6 };
    expect(expenseMonths(e)).toEqual(['2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04']);
    expect(shareIn(e, '2027-01')).toBeCloseTo(5.83);
  });

  it('guesses the category from the label', () => {
    expect(guessCategory('louer')).toBe('LOYER');
    expect(guessCategory('partie de location de moi septembre')).toBe('LOYER');
    expect(guessCategory('packé de coffee')).toBe('STOCK_CAFE');
    expect(guessCategory('clean working space')).toBe('MENAGE');
    expect(guessCategory('connection')).toBe('INTERNET');
    expect(guessCategory('chahd')).toBe('AUTRE');
  });
});

describe('expensesInPeriod', () => {
  const rows = [
    { date: new Date(2026, 10, 4), amount: 2000, forMonth: '2026-10' },
    { date: new Date(2026, 10, 5), amount: 30 },
    { date: new Date(2026, 9, 3), amount: 9 },
  ];
  it('October gets its rent paid on 4 November', () => {
    expect(expensesInPeriod(rows, new Date(2026, 9, 1), new Date(2026, 9, 31, 23, 59))).toBe(2009);
  });
  it('November keeps only its own expenses', () => {
    expect(expensesInPeriod(rows, new Date(2026, 10, 1), new Date(2026, 10, 7, 23, 59))).toBe(30);
  });
});
