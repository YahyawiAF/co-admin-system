/*
  Warnings:

  - You are about to drop the column `expenseId` on the `journals` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "journals" DROP CONSTRAINT "journals_expenseId_fkey";

-- AlterTable
ALTER TABLE "journals" DROP COLUMN "expenseId";

-- CreateTable
CREATE TABLE "_JournalExpenses" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_JournalExpenses_AB_unique" ON "_JournalExpenses"("A", "B");

-- CreateIndex
CREATE INDEX "_JournalExpenses_B_index" ON "_JournalExpenses"("B");

-- AddForeignKey
ALTER TABLE "_JournalExpenses" ADD CONSTRAINT "_JournalExpenses_A_fkey" FOREIGN KEY ("A") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_JournalExpenses" ADD CONSTRAINT "_JournalExpenses_B_fkey" FOREIGN KEY ("B") REFERENCES "journals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
