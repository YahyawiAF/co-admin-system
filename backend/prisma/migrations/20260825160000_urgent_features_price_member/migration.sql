-- AlterTable Member: phone Int -> String, add passwordHash
ALTER TABLE "members" ALTER COLUMN "phone" SET DATA TYPE VARCHAR(32) USING ("phone"::text);
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PriceCategory" AS ENUM ('JOURNEE', 'ABONNEMENT', 'SALLE', 'OPEN_SPACE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "BillingUnit" AS ENUM ('PACK', 'HOURLY', 'PERIOD');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AlterTable Price
ALTER TABLE "prices" ADD COLUMN IF NOT EXISTS "category" "PriceCategory";
ALTER TABLE "prices" ADD COLUMN IF NOT EXISTS "durationHours" DOUBLE PRECISION;
ALTER TABLE "prices" ADD COLUMN IF NOT EXISTS "billingUnit" "BillingUnit";
ALTER TABLE "prices" ADD COLUMN IF NOT EXISTS "periodDays" INTEGER;
