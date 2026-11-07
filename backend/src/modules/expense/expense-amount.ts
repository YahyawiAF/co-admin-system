export const EXPENSE_SOURCES = ['CAISSE', 'COFFRE', 'AUTRE'] as const;
export type ExpenseSource = (typeof EXPENSE_SOURCES)[number];

type ExpenseRow = {
  amount?: number | null;
  label?: string | null;
  expense?: { amount: number; name?: string } | null;
};

/** Spent amount (legacy rows fall back to the template amount). */
export function expenseAmount(de: ExpenseRow): number {
  return de.amount ?? de.expense?.amount ?? 0;
}

export function expenseLabel(de: ExpenseRow): string {
  return de.label || de.expense?.name || 'Dépense';
}

export function normalizeSource(source?: string | null): ExpenseSource {
  return (EXPENSE_SOURCES as readonly string[]).includes(source || '')
    ? (source as ExpenseSource)
    : 'CAISSE';
}

export const EXPENSE_CATEGORIES = [
  'LOYER',
  'ENERGIE',
  'INTERNET',
  'SALAIRES',
  'STOCK_CAFE',
  'MENAGE',
  'EQUIPEMENT',
  'AUTRE',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  LOYER: 'Loyer',
  ENERGIE: 'Électricité & eau',
  INTERNET: 'Internet',
  SALAIRES: 'Salaires',
  STOCK_CAFE: 'Stock café',
  MENAGE: 'Ménage',
  EQUIPEMENT: 'Équipement',
  AUTRE: 'Autre',
};

const GUESS: Array<[ExpenseCategory, RegExp]> = [
  ['LOYER', /lou(e|é)r|loyer|location|rent/i],
  ['ENERGIE', /steg|sonede|[ée]lectri|gaz\b|facture d.?eau/i],
  ['INTERNET', /internet|connexion|connection|wifi|fibre|ooredoo|topnet|orange/i],
  ['SALAIRES', /salaire|cnss|paie/i],
  ['STOCK_CAFE', /caf(e|é)|coffee|lait|milk|sucre|gobelet|goubl|eau\b|water|cake|brownie|g[aâ]teau|soda|jus/i],
  ['MENAGE', /clean|m[ée]nage|nettoy|air fresh|savon|javel|produit/i],
  ['EQUIPEMENT', /chaise|table|rallonge|[ée]quipement|lampe|clim|imprim|papier|plomb/i],
];

/** Category from the label when the owner did not pick one. */
export function guessCategory(label?: string | null): ExpenseCategory {
  const l = label || '';
  return GUESS.find(([, re]) => re.test(l))?.[0] ?? 'AUTRE';
}

export function normalizeCategory(c?: string | null, label?: string | null): ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(c || '') ? (c as ExpenseCategory) : guessCategory(label);
}

/** yyyy-MM of a date (local). */
export const monthKeyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export function shiftMonthKey(key: string, by: number) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return monthKeyOf(d);
}

type Attributable = { date?: Date | null; createdAt?: Date | null; forMonth?: string | null; spreadMonths?: number | null };

/** Months an expense counts in (« pour quel mois », spread). */
export function expenseMonths(de: Attributable): string[] {
  const first = de.forMonth && /^\d{4}-\d{2}$/.test(de.forMonth) ? de.forMonth : monthKeyOf(de.date ?? de.createdAt ?? new Date());
  const n = Math.max(1, Math.min(36, de.spreadMonths ?? 1));
  return Array.from({ length: n }, (_, i) => shiftMonthKey(first, i));
}

/** Part of an expense that counts in a month (0 when it is for another month). */
export function shareIn(de: Attributable & Parameters<typeof expenseAmount>[0], monthKey: string) {
  const months = expenseMonths(de);
  return months.includes(monthKey) ? Math.round((expenseAmount(de) / months.length) * 100) / 100 : 0;
}

const monthBounds = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return { first: new Date(y, m - 1, 1), last: new Date(y, m, 0, 23, 59, 59, 999), days: new Date(y, m, 0).getDate() };
};

/**
 * Expenses that count in [start, end]. Plain daily purchases count on their
 * day. An expense « pour un mois » (or spread) counts in its month(s): in full
 * when the period starts on the 1st (month to date), else by the days covered.
 * Rows can be paid outside the period (last month's rent paid today).
 */
export function expensesInPeriod(rows: Array<Attributable & Parameters<typeof expenseAmount>[0]>, start: Date, end: Date) {
  let total = 0;
  for (const r of rows) {
    const paid = r.date ?? r.createdAt ?? null;
    const tagged = !!r.forMonth || (r.spreadMonths ?? 1) > 1;
    if (!tagged) {
      if (paid && paid >= start && paid <= end) total += expenseAmount(r);
      continue;
    }
    const months = expenseMonths(r);
    const part = expenseAmount(r) / months.length;
    for (const m of months) {
      const b = monthBounds(m);
      if (b.last < start || b.first > end) continue;
      if (start.getDate() === 1 && start.getMonth() === b.first.getMonth() && start.getFullYear() === b.first.getFullYear()) {
        total += part;
        continue;
      }
      const from = Math.max(b.first.getTime(), start.getTime());
      const to = Math.min(b.last.getTime(), end.getTime());
      const days = Math.max(0, Math.round((to - from) / 86_400_000));
      total += (part * Math.min(days, b.days)) / b.days;
    }
  }
  return Math.round(total * 100) / 100;
}
