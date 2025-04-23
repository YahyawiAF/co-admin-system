-- CreateTable
CREATE TABLE "DailyExpense" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyExpense_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DailyExpense" ADD CONSTRAINT "DailyExpense_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expenses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
