-- AlterTable: amount owed at checkout, kept when a late payment is re-billed
ALTER TABLE "journals" ADD COLUMN IF NOT EXISTS "amountAtCheckout" DOUBLE PRECISION;
