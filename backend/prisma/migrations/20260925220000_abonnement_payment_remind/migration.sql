-- AlterTable
ALTER TABLE "abonnements" ADD COLUMN IF NOT EXISTS "paymentRemindAt" TIMESTAMP(3);
