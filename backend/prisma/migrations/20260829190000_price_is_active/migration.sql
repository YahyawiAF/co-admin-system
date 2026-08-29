-- Price active flag for tarif visibility
ALTER TABLE "prices" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS "prices_isActive_idx" ON "prices"("isActive");
