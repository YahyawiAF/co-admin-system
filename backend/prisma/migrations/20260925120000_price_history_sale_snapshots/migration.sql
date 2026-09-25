-- Price history (append-only catalog versions)
CREATE TABLE IF NOT EXISTS "price_histories" (
    "id" TEXT NOT NULL,
    "priceId" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "type" "PriceType" NOT NULL,
    "categories" "PriceCategory"[] DEFAULT ARRAY[]::"PriceCategory"[],
    "billingUnit" "BillingUnit",
    "durationHours" DOUBLE PRECISION,
    "periodDays" INTEGER,
    "spaceId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedByUserId" TEXT,
    "reason" TEXT,
    CONSTRAINT "price_histories_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "price_histories_priceId_changedAt_idx" ON "price_histories"("priceId", "changedAt");
CREATE INDEX IF NOT EXISTS "price_histories_organizationId_changedAt_idx" ON "price_histories"("organizationId", "changedAt");

ALTER TABLE "price_histories" DROP CONSTRAINT IF EXISTS "price_histories_priceId_fkey";
ALTER TABLE "price_histories"
  ADD CONSTRAINT "price_histories_priceId_fkey"
  FOREIGN KEY ("priceId") REFERENCES "prices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "price_histories" DROP CONSTRAINT IF EXISTS "price_histories_organizationId_fkey";
ALTER TABLE "price_histories"
  ADD CONSTRAINT "price_histories_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sale snapshots on journals
ALTER TABLE "journals" ADD COLUMN IF NOT EXISTS "serviceName" TEXT;
ALTER TABLE "journals" ADD COLUMN IF NOT EXISTS "listPrice" DOUBLE PRECISION;
ALTER TABLE "journals" ADD COLUMN IF NOT EXISTS "spaceId" TEXT;
ALTER TABLE "journals" ADD COLUMN IF NOT EXISTS "spaceName" TEXT;

CREATE INDEX IF NOT EXISTS "journals_priceId_idx" ON "journals"("priceId");
CREATE INDEX IF NOT EXISTS "journals_spaceId_idx" ON "journals"("spaceId");
CREATE INDEX IF NOT EXISTS "journals_memberID_priceId_idx" ON "journals"("memberID", "priceId");

-- Sale snapshots on abonnements
ALTER TABLE "abonnements" ADD COLUMN IF NOT EXISTS "serviceName" TEXT;
ALTER TABLE "abonnements" ADD COLUMN IF NOT EXISTS "listPrice" DOUBLE PRECISION;
ALTER TABLE "abonnements" ADD COLUMN IF NOT EXISTS "spaceId" TEXT;
ALTER TABLE "abonnements" ADD COLUMN IF NOT EXISTS "spaceName" TEXT;

CREATE INDEX IF NOT EXISTS "abonnements_priceId_idx" ON "abonnements"("priceId");
CREATE INDEX IF NOT EXISTS "abonnements_spaceId_idx" ON "abonnements"("spaceId");
CREATE INDEX IF NOT EXISTS "abonnements_memberID_priceId_idx" ON "abonnements"("memberID", "priceId");
