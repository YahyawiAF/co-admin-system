ALTER TABLE "member_outreach" ADD COLUMN IF NOT EXISTS "campaignId" TEXT;

CREATE TABLE IF NOT EXISTS "outreach_campaigns" (
  "id" TEXT NOT NULL,
  "facilityId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "segment" TEXT NOT NULL,
  "memberGroupId" TEXT,
  "memberIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "goal" TEXT NOT NULL DEFAULT 'ANY',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "sourceReportId" TEXT,
  "recommendationTitle" TEXT,
  "initiativeId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "outreach_campaigns_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "outreach_campaigns_facilityId_createdAt_idx" ON "outreach_campaigns"("facilityId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "outreach_campaigns" ADD CONSTRAINT "outreach_campaigns_facilityId_fkey"
    FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
