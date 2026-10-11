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
