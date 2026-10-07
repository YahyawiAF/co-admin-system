-- AlterTable: member / group discount snapshot and amount owed on abonnements
ALTER TABLE "abonnements" ADD COLUMN IF NOT EXISTS "discountPercent" DOUBLE PRECISION;
ALTER TABLE "abonnements" ADD COLUMN IF NOT EXISTS "amountDue" DOUBLE PRECISION;
