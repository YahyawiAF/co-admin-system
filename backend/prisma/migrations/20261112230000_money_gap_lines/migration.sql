-- AlterTable
ALTER TABLE "DailyExpense" ADD COLUMN "afterCount" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "money_gap_lines" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT,
    "fromSafe" BOOLEAN NOT NULL DEFAULT false,
    "dailyExpenseId" TEXT,
    "caisseSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "money_gap_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "money_gap_lines_dailyExpenseId_key" ON "money_gap_lines"("dailyExpenseId");

-- CreateIndex
CREATE INDEX "money_gap_lines_month_idx" ON "money_gap_lines"("month");

-- AddForeignKey
ALTER TABLE "money_gap_lines" ADD CONSTRAINT "money_gap_lines_dailyExpenseId_fkey" FOREIGN KEY ("dailyExpenseId") REFERENCES "DailyExpense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
