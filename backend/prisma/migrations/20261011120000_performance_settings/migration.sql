ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "openHour" INTEGER NOT NULL DEFAULT 8;
ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "closeHour" INTEGER NOT NULL DEFAULT 25;
ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "alwaysOpen" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "regularVisitsPerWeek" INTEGER NOT NULL DEFAULT 4;
ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "inactiveAlertDays" INTEGER NOT NULL DEFAULT 7;

CREATE TABLE IF NOT EXISTS "monthly_targets" (
  "id" TEXT NOT NULL,
  "facilityId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "revenue" DOUBLE PRECISION NOT NULL,
  "occupancyPct" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "monthly_targets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "monthly_targets_facilityId_year_month_key"
  ON "monthly_targets"("facilityId", "year", "month");

DO $$ BEGIN
  ALTER TABLE "monthly_targets"
    ADD CONSTRAINT "monthly_targets_facilityId_fkey"
    FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
