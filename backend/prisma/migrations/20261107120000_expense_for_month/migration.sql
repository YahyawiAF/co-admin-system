-- Expense « pour quel mois », spread over months, category
ALTER TABLE "DailyExpense" ADD COLUMN "forMonth" TEXT;
ALTER TABLE "DailyExpense" ADD COLUMN "spreadMonths" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "DailyExpense" ADD COLUMN "category" TEXT;
CREATE INDEX "DailyExpense_forMonth_idx" ON "DailyExpense"("forMonth");
