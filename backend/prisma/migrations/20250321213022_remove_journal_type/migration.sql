/*
  Warnings:

  - You are about to drop the column `journalType` on the `journals` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "journals" DROP COLUMN "journalType";

-- DropEnum
DROP TYPE "JournalType";
