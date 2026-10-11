import type { QueryClient } from "@tanstack/react-query";

/** Refresh every view that shows caisse, coffre or expense money. */
export function invalidateMoney(queryClient: QueryClient) {
  for (const key of [
    "caisse-summary",
    "caisse-month",
    "coffre",
    "expenses",
    "expenses-day",
    "expenses-month",
    "expense-suggestions",
    "analytics-finance-days",
    "analytics-finance-year",
    "performance",
  ]) {
    void queryClient.invalidateQueries({ queryKey: [key] });
  }
}

export const dt = (n: number | null | undefined, digits = 1) =>
  n == null
    ? "—"
    : `${n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: digits })} DT`;

export const EXPENSE_SOURCE_LABEL = {
  CAISSE: "Caisse",
  COFFRE: "Coffre",
  AUTRE: "Banque / autre",
} as const;
