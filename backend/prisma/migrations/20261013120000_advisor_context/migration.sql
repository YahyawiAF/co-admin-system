ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS "advisor_facts" (
  "id" TEXT NOT NULL,
  "facilityId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "detail" TEXT,
  "tag" TEXT,
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "distanceM" INTEGER,
  "memberGroupId" TEXT,
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "confirmed" BOOLEAN NOT NULL DEFAULT true,
  "externalId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "advisor_facts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "advisor_facts_facilityId_externalId_key" ON "advisor_facts"("facilityId", "externalId");
CREATE INDEX IF NOT EXISTS "advisor_facts_facilityId_kind_idx" ON "advisor_facts"("facilityId", "kind");
DO $$ BEGIN
  ALTER TABLE "advisor_facts" ADD CONSTRAINT "advisor_facts_facilityId_fkey"
    FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "advisor_questions" (
  "id" TEXT NOT NULL,
  "facilityId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "reportId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "advisor_questions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "advisor_questions_facilityId_key_key" ON "advisor_questions"("facilityId", "key");
DO $$ BEGIN
  ALTER TABLE "advisor_questions" ADD CONSTRAINT "advisor_questions_facilityId_fkey"
    FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
