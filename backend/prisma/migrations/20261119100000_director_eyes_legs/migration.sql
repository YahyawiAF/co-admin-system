-- Directeur: the brain's priorities, the watches the app measures, looks, and the order channel
ALTER TABLE "DailyProduct" ADD COLUMN IF NOT EXISTS "channel" TEXT;
ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "directorLooks" JSONB;
ALTER TABLE "feature_proposals" ADD COLUMN IF NOT EXISTS "problem" TEXT;
ALTER TABLE "feature_proposals" ADD COLUMN IF NOT EXISTS "capability" TEXT;
ALTER TABLE "feature_proposals" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'RULES';

CREATE TABLE IF NOT EXISTS "director_priorities" (
  "id" TEXT NOT NULL,
  "facilityId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "corner" TEXT NOT NULL,
  "why" TEXT NOT NULL DEFAULT '',
  "steps" JSONB NOT NULL DEFAULT '[]',
  "legs" JSONB NOT NULL DEFAULT '[]',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "source" TEXT NOT NULL DEFAULT 'CLAUDE',
  "basedOn" TEXT,
  "startDate" DATE NOT NULL,
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "director_priorities_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "director_priorities_facilityId_status_idx" ON "director_priorities"("facilityId", "status");
ALTER TABLE "director_priorities" ADD CONSTRAINT "director_priorities_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "director_watches" (
  "id" TEXT NOT NULL,
  "facilityId" TEXT NOT NULL,
  "priorityId" TEXT,
  "eye" TEXT NOT NULL,
  "params" JSONB NOT NULL DEFAULT '{}',
  "label" TEXT NOT NULL,
  "startDate" DATE NOT NULL,
  "days" INTEGER NOT NULL DEFAULT 14,
  "goal" DOUBLE PRECISION,
  "stoppedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "director_watches_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "director_watches_facilityId_startDate_idx" ON "director_watches"("facilityId", "startDate");
ALTER TABLE "director_watches" ADD CONSTRAINT "director_watches_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "director_watches" ADD CONSTRAINT "director_watches_priorityId_fkey" FOREIGN KEY ("priorityId") REFERENCES "director_priorities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
