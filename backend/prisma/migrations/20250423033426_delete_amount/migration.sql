/*
  Warnings:

  - You are about to drop the column `amount` on the `DailyExpense` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "DailyExpense" DROP COLUMN "amount",
ALTER COLUMN "date" DROP NOT NULL;
