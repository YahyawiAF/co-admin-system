-- Tarif promos: category-wide tarif offers + gift-with-pass vouchers. Additive only.

ALTER TABLE "promotions" ADD COLUMN IF NOT EXISTS "priceCategory" "PriceCategory";

DO $$ BEGIN
  CREATE TYPE "PromotionVoucherStatus" AS ENUM ('ACCEPTED', 'DECLINED', 'USED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "promotion_vouchers" (
  "id" TEXT NOT NULL,
  "promotionId" TEXT NOT NULL,
  "journalId" TEXT NOT NULL,
  "memberId" TEXT,
  "productId" TEXT NOT NULL,
  "status" "PromotionVoucherStatus" NOT NULL,
  "dailyProductId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "usedAt" TIMESTAMP(3),
  CONSTRAINT "promotion_vouchers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "promotion_vouchers_journalId_promotionId_key"
  ON "promotion_vouchers"("journalId", "promotionId");
CREATE INDEX IF NOT EXISTS "promotion_vouchers_memberId_status_idx"
  ON "promotion_vouchers"("memberId", "status");

DO $$ BEGIN
  ALTER TABLE "promotion_vouchers" ADD CONSTRAINT "promotion_vouchers_promotionId_fkey"
    FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Gift answers made in the app before reception approves the arrival
ALTER TABLE "visit_requests" ADD COLUMN IF NOT EXISTS "bundleIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "visit_requests" ADD COLUMN IF NOT EXISTS "bundleAnswered" BOOLEAN NOT NULL DEFAULT false;
