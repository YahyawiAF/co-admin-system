ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "businessContext" TEXT;

DO $$ BEGIN
  CREATE TYPE "AdvisorReportStatus" AS ENUM ('PENDING', 'DONE', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "advisor_reports" (
  "id" TEXT NOT NULL,
  "facilityId" TEXT NOT NULL,
  "status" "AdvisorReportStatus" NOT NULL DEFAULT 'PENDING',
  "trigger" TEXT NOT NULL DEFAULT 'MANUAL',
  "periodFrom" TIMESTAMP(3) NOT NULL,
  "periodTo" TIMESTAMP(3) NOT NULL,
  "snapshot" JSONB NOT NULL,
  "result" JSONB,
  "error" TEXT,
  "model" TEXT NOT NULL,
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "advisor_reports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "advisor_reports_facilityId_createdAt_idx" ON "advisor_reports"("facilityId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "advisor_reports" ADD CONSTRAINT "advisor_reports_facilityId_fkey"
    FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "business_initiatives" (
  "id" TEXT NOT NULL,
  "facilityId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL DEFAULT 'NEW_REVENUE',
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "sourceReportId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "business_initiatives_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "business_initiatives_facilityId_startDate_idx" ON "business_initiatives"("facilityId", "startDate");
DO $$ BEGIN
  ALTER TABLE "business_initiatives" ADD CONSTRAINT "business_initiatives_facilityId_fkey"
    FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
