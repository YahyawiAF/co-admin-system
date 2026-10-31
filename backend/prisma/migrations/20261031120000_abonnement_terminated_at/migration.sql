-- Ended early by staff ("Terminer maintenant")
ALTER TABLE "abonnements" ADD COLUMN "terminatedAt" TIMESTAMP(3);

-- Backfill: past abonnements (day-based) that ended before their period was over
UPDATE "abonnements" a
SET "terminatedAt" = a."leaveDate"
FROM "prices" p
WHERE p."id" = a."priceId"
  AND a."leaveDate" IS NOT NULL
  AND a."leaveDate" < NOW()
  AND a."hoursQuota" IS NULL
  AND p."periodDays" IS NOT NULL
  AND (a."leaveDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Tunis')::date
    < (a."registredDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Tunis')::date + p."periodDays" - 1;
