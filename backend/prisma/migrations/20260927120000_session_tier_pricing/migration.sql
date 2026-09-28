-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "JournalPricingMode" AS ENUM ('FIXED', 'AUTO');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "journals" ADD COLUMN IF NOT EXISTS "pricingMode" "JournalPricingMode" NOT NULL DEFAULT 'FIXED';
ALTER TABLE "journals" ADD COLUMN IF NOT EXISTS "fixedPriceId" TEXT;
ALTER TABLE "journals" ADD COLUMN IF NOT EXISTS "fixedServiceName" TEXT;
ALTER TABLE "journals" ADD COLUMN IF NOT EXISTS "fixedDurationHours" DOUBLE PRECISION;
ALTER TABLE "journals" ADD COLUMN IF NOT EXISTS "fixedAmount" DOUBLE PRECISION;
ALTER TABLE "journals" ADD COLUMN IF NOT EXISTS "fixedAt" TIMESTAMP(3);
ALTER TABLE "journals" ADD COLUMN IF NOT EXISTS "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "journals" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "journals" ADD COLUMN IF NOT EXISTS "lastPricingNotice" TEXT;

-- Existing paid visits: collected = owed
UPDATE "journals" SET "paidAmount" = "payedAmount" WHERE "isPayed" = true AND "paidAmount" = 0;

-- AlterTable
ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "sessionWarnBeforeMin" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "autoTierGraceMin" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "fixedGraceMin" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "overtimeSurchargeDt" DOUBLE PRECISION NOT NULL DEFAULT 0.75;
ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "overtimeNextTierMin" INTEGER NOT NULL DEFAULT 30;
