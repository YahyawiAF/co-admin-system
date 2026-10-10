-- AlterTable: day the abonnement was paid (revenue date)
ALTER TABLE "abonnements" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);

-- Existing paid abonnements: best known collection day is when they were entered
UPDATE "abonnements"
SET "paidAt" = COALESCE("createdAt", "registredDate")
WHERE "isPayed" = true AND "paidAt" IS NULL;

CREATE INDEX IF NOT EXISTS "abonnements_paidAt_idx" ON "abonnements"("paidAt");
