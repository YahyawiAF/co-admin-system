-- Quick expenses (no template), sources, recurring charges due day
ALTER TABLE "DailyExpense" ALTER COLUMN "expenseId" DROP NOT NULL;
ALTER TABLE "DailyExpense" ADD COLUMN IF NOT EXISTS "amount" DOUBLE PRECISION;
ALTER TABLE "DailyExpense" ADD COLUMN IF NOT EXISTS "label" TEXT;
ALTER TABLE "DailyExpense" ADD COLUMN IF NOT EXISTS "kind" "ExpenseType" NOT NULL DEFAULT 'JOURNALIER';
ALTER TABLE "DailyExpense" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'CAISSE';
CREATE INDEX IF NOT EXISTS "DailyExpense_date_idx" ON "DailyExpense"("date");

ALTER TABLE "DailyExpense" DROP CONSTRAINT IF EXISTS "DailyExpense_expenseId_fkey";
ALTER TABLE "DailyExpense" ADD CONSTRAINT "DailyExpense_expenseId_fkey"
  FOREIGN KEY ("expenseId") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Snapshot legacy rows so they survive template edits / deletion
UPDATE "DailyExpense" d
SET "amount" = COALESCE(d."amount", e."prix"),
    "label" = COALESCE(d."label", e."name"),
    "kind" = e."type"
FROM "expenses" e
WHERE d."expenseId" = e."id" AND (d."amount" IS NULL OR d."label" IS NULL);

ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "dueDay" INTEGER;

-- Caisse: cash kept in the drawer for the next day
ALTER TABLE "caisse_sessions" ADD COLUMN IF NOT EXISTS "keptFloat" DOUBLE PRECISION;

-- Coffre links (expense paid from coffre, drawer <-> coffre transfers)
ALTER TABLE "coffre_entries" ADD COLUMN IF NOT EXISTS "dailyExpenseId" TEXT;
ALTER TABLE "coffre_entries" ADD COLUMN IF NOT EXISTS "caisseMovementId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "coffre_entries_dailyExpenseId_key" ON "coffre_entries"("dailyExpenseId");
CREATE UNIQUE INDEX IF NOT EXISTS "coffre_entries_caisseMovementId_key" ON "coffre_entries"("caisseMovementId");

DO $$ BEGIN
  ALTER TABLE "coffre_entries" ADD CONSTRAINT "coffre_entries_dailyExpenseId_fkey"
    FOREIGN KEY ("dailyExpenseId") REFERENCES "DailyExpense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "coffre_entries" ADD CONSTRAINT "coffre_entries_caisseMovementId_fkey"
    FOREIGN KEY ("caisseMovementId") REFERENCES "caisse_movements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
