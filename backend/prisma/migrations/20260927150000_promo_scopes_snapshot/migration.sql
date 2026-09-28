-- Global promo scope (tarif categories; empty = all)
ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "appInstallGlobalPromoScopes" "PriceCategory"[] NOT NULL DEFAULT ARRAY[]::"PriceCategory"[];

-- Promo snapshot on sales
ALTER TABLE "journals" ADD COLUMN IF NOT EXISTS "priceBeforePromo" DOUBLE PRECISION;
ALTER TABLE "journals" ADD COLUMN IF NOT EXISTS "promoDiscount" DOUBLE PRECISION;
ALTER TABLE "journals" ADD COLUMN IF NOT EXISTS "promoLabel" TEXT;

ALTER TABLE "abonnements" ADD COLUMN IF NOT EXISTS "priceBeforePromo" DOUBLE PRECISION;
ALTER TABLE "abonnements" ADD COLUMN IF NOT EXISTS "promoDiscount" DOUBLE PRECISION;
ALTER TABLE "abonnements" ADD COLUMN IF NOT EXISTS "promoLabel" TEXT;
