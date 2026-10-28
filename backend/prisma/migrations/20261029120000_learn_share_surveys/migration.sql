-- Learn & Share: public surveys, per-browser attribution, responses, learning sessions. Additive only.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'EventKind' AND e.enumlabel = 'LEARNING'
  ) THEN
    ALTER TYPE "EventKind" ADD VALUE 'LEARNING';
  END IF;
END $$;

CREATE TYPE "SurveyStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED', 'CLOSED');

CREATE TABLE "surveys" (
  "id" TEXT NOT NULL,
  "facilityId" TEXT NOT NULL,
  "slug" VARCHAR(60) NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "intro" TEXT,
  "description" TEXT,
  "purpose" TEXT,
  "audience" TEXT,
  "status" "SurveyStatus" NOT NULL DEFAULT 'DRAFT',
  "closesAt" TIMESTAMP(3),
  "questions" JSONB NOT NULL DEFAULT '[]',
  "settings" JSONB NOT NULL DEFAULT '{}',
  "templateCode" VARCHAR(40),
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "surveys_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "surveys_facilityId_slug_key" ON "surveys"("facilityId", "slug");
CREATE INDEX "surveys_status_idx" ON "surveys"("status");
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "share_links"
  ADD COLUMN "label" VARCHAR(80),
  ADD COLUMN "source" VARCHAR(40),
  ADD COLUMN "medium" VARCHAR(40),
  ADD COLUMN "campaign" VARCHAR(80),
  ADD COLUMN "content" VARCHAR(80),
  ADD COLUMN "term" VARCHAR(80);
CREATE INDEX "share_links_kind_targetId_idx" ON "share_links"("kind", "targetId");

CREATE TABLE "survey_visits" (
  "id" TEXT NOT NULL,
  "surveyId" TEXT NOT NULL,
  "visitorKey" VARCHAR(64) NOT NULL,
  "linkId" TEXT,
  "source" VARCHAR(40) NOT NULL,
  "medium" VARCHAR(40),
  "campaign" VARCHAR(80),
  "content" VARCHAR(80),
  "term" VARCHAR(80),
  "method" VARCHAR(10) NOT NULL,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  CONSTRAINT "survey_visits_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "survey_visits_surveyId_visitorKey_key" ON "survey_visits"("surveyId", "visitorKey");
CREATE INDEX "survey_visits_surveyId_firstSeenAt_idx" ON "survey_visits"("surveyId", "firstSeenAt");
CREATE INDEX "survey_visits_linkId_idx" ON "survey_visits"("linkId");
ALTER TABLE "survey_visits" ADD CONSTRAINT "survey_visits_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "survey_visits" ADD CONSTRAINT "survey_visits_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "share_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "survey_responses" (
  "id" TEXT NOT NULL,
  "surveyId" TEXT NOT NULL,
  "visitorKey" VARCHAR(64) NOT NULL,
  "idempotencyKey" VARCHAR(64) NOT NULL,
  "linkId" TEXT,
  "source" VARCHAR(40) NOT NULL,
  "medium" VARCHAR(40),
  "campaign" VARCHAR(80),
  "content" VARCHAR(80),
  "term" VARCHAR(80),
  "method" VARCHAR(10) NOT NULL,
  "answers" JSONB NOT NULL,
  "role" VARCHAR(8),
  "subjects" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "contactName" VARCHAR(80),
  "contactPhone" VARCHAR(32),
  "contactConsentAt" TIMESTAMP(3),
  "memberId" TEXT,
  "memberLinkMethod" VARCHAR(16),
  "memberLinkedAt" TIMESTAMP(3),
  "memberLinkedBy" TEXT,
  "supersededAt" TIMESTAMP(3),
  "flagged" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "survey_responses_idempotencyKey_key" ON "survey_responses"("idempotencyKey");
CREATE INDEX "survey_responses_surveyId_createdAt_idx" ON "survey_responses"("surveyId", "createdAt");
CREATE INDEX "survey_responses_surveyId_source_idx" ON "survey_responses"("surveyId", "source");
CREATE INDEX "survey_responses_surveyId_visitorKey_idx" ON "survey_responses"("surveyId", "visitorKey");
CREATE INDEX "survey_responses_linkId_idx" ON "survey_responses"("linkId");
CREATE INDEX "survey_responses_memberId_idx" ON "survey_responses"("memberId");
CREATE INDEX "survey_responses_contactPhone_idx" ON "survey_responses"("contactPhone");
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "share_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "events"
  ADD COLUMN "surveyId" TEXT,
  ADD COLUMN "subject" VARCHAR(80),
  ADD COLUMN "hostMemberId" TEXT,
  ADD COLUMN "hostResponseId" TEXT,
  ADD COLUMN "rewardNote" TEXT,
  ADD COLUMN "rewardGivenAt" TIMESTAMP(3);
CREATE INDEX "events_surveyId_idx" ON "events"("surveyId");
ALTER TABLE "events" ADD CONSTRAINT "events_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "surveys"("id") ON DELETE SET NULL ON UPDATE CASCADE;
