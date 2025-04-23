-- CreateEnum
CREATE TYPE "JournalType" AS ENUM ('DEMI_JOURNEE', 'JOURNEE');

-- AlterTable
ALTER TABLE "journals" ADD COLUMN     "journalType" "JournalType" NOT NULL DEFAULT 'DEMI_JOURNEE';
