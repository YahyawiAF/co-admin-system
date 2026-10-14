ALTER TABLE "DailyProduct" ADD COLUMN IF NOT EXISTS "unitPrice" DOUBLE PRECISION;
ALTER TABLE "DailyProduct" ADD COLUMN IF NOT EXISTS "promotionId" TEXT;

CREATE TABLE IF NOT EXISTS "promotions" (
  "id" TEXT NOT NULL,
  "facilityId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "target" TEXT NOT NULL,
  "productId" TEXT,
  "priceId" TEXT,
  "valueKind" "PromoValueKind" NOT NULL DEFAULT 'PERCENT',
  "value" DOUBLE PRECISION NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "daysOfWeek" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  "fromHour" INTEGER,
  "toHour" INTEGER,
  "audience" TEXT NOT NULL DEFAULT 'ALL',
  "maxUsesPerMember" INTEGER,
  "maxUses" INTEGER,
  "style" TEXT NOT NULL DEFAULT 'GOLD',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "views" INTEGER NOT NULL DEFAULT 0,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "promotions_facilityId_isActive_idx" ON "promotions"("facilityId", "isActive");

CREATE TABLE IF NOT EXISTS "promotion_uses" (
  "id" TEXT NOT NULL,
  "promotionId" TEXT NOT NULL,
  "memberId" TEXT,
  "dailyProductId" TEXT,
  "journalId" TEXT,
  "amount" DOUBLE PRECISION NOT NULL,
  "discount" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "promotion_uses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "promotion_uses_promotionId_memberId_idx" ON "promotion_uses"("promotionId", "memberId");

DO $$ BEGIN
  ALTER TABLE "promotions" ADD CONSTRAINT "promotions_facilityId_fkey"
    FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "promotions" ADD CONSTRAINT "promotions_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "promotions" ADD CONSTRAINT "promotions_priceId_fkey"
    FOREIGN KEY ("priceId") REFERENCES "prices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "promotion_uses" ADD CONSTRAINT "promotion_uses_promotionId_fkey"
    FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
