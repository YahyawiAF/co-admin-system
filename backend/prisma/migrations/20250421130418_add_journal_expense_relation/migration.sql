/*
  Warnings:

  - You are about to drop the `_ExpenseToJournal` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_ExpenseToJournal" DROP CONSTRAINT "_ExpenseToJournal_A_fkey";

-- DropForeignKey
ALTER TABLE "_ExpenseToJournal" DROP CONSTRAINT "_ExpenseToJournal_B_fkey";

-- AlterTable
ALTER TABLE "journals" ADD COLUMN     "expenseId" TEXT;

-- DropTable
DROP TABLE "_ExpenseToJournal";

-- AddForeignKey
ALTER TABLE "journals" ADD CONSTRAINT "journals_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
