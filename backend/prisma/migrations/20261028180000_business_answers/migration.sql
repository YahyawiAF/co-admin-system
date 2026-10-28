-- Conseiller: owner answers (money questions) and tool requests. Additive only.
CREATE TABLE "business_answers" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "label" TEXT NOT NULL,
    "note" TEXT,
    "unknown" BOOLEAN NOT NULL DEFAULT false,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "business_answers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "business_answers_facilityId_key_key" ON "business_answers"("facilityId", "key");
ALTER TABLE "business_answers" ADD CONSTRAINT "business_answers_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "feature_proposals" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'SUGGESTED',
    "deferredUntil" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "feature_proposals_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "feature_proposals_facilityId_key_key" ON "feature_proposals"("facilityId", "key");
ALTER TABLE "feature_proposals" ADD CONSTRAINT "feature_proposals_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
