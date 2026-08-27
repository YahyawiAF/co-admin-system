-- AlterTable
ALTER TABLE "spaces" ADD COLUMN "category" "PriceCategory";

-- Backfill from space names
UPDATE "spaces"
SET "category" = 'SALLE'
WHERE "category" IS NULL
  AND name ~* 'salle|r[eé]union|meeting';

UPDATE "spaces"
SET "category" = 'OPEN_SPACE'
WHERE "category" IS NULL
  AND name ~* 'open|ouvert';

UPDATE "spaces"
SET "category" = 'JOURNEE'
WHERE "category" IS NULL;

-- Hourly visit tarifs: empty duration = open meter (keep subscription hour quotas)
UPDATE "prices"
SET "durationHours" = NULL
WHERE "billingUnit" = 'HOURLY'
  AND ("category" IS NULL OR "category" <> 'ABONNEMENT');
