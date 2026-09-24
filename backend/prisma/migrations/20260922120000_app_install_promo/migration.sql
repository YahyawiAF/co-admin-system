-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PromoValueKind" AS ENUM ('PERCENT', 'FIXED_DT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Drop legacy single-amount column if present (unreleased)
ALTER TABLE "facilities" DROP COLUMN IF EXISTS "appInstallPromoAmount";

-- Global one-time app-install promo on facility
ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "appInstallGlobalPromoActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "appInstallGlobalPromoKind" "PromoValueKind";
ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "appInstallGlobalPromoValue" DOUBLE PRECISION;

-- One-time claim tracking on members
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "appInstallPromoClaimedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "app_install_promos" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "priceId" TEXT NOT NULL,
    "valueKind" "PromoValueKind" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_install_promos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "app_install_promos_facilityId_idx" ON "app_install_promos"("facilityId");
CREATE INDEX IF NOT EXISTS "app_install_promos_priceId_idx" ON "app_install_promos"("priceId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "app_install_promos" ADD CONSTRAINT "app_install_promos_facilityId_fkey"
    FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "app_install_promos" ADD CONSTRAINT "app_install_promos_priceId_fkey"
    FOREIGN KEY ("priceId") REFERENCES "prices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
