-- Conseiller funnel: planned steps, channels, typed reach, tracked share links, paid events. Additive only.
ALTER TABLE "business_initiatives"
  ADD COLUMN "objective" TEXT,
  ADD COLUMN "hypothesis" TEXT,
  ADD COLUMN "channels" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "steps" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "manualFunnel" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "events" ADD COLUMN "price" DOUBLE PRECISION;

ALTER TABLE "event_registrations"
  ADD COLUMN "paidAmount" DOUBLE PRECISION,
  ADD COLUMN "paidAt" TIMESTAMP(3),
  ADD COLUMN "sourceCode" TEXT;

CREATE TABLE "share_links" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "facilityId" TEXT NOT NULL,
  "initiativeId" TEXT,
  "kind" TEXT NOT NULL DEFAULT 'EVENT',
  "targetId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "opens" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "share_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "share_links_code_key" ON "share_links"("code");
CREATE INDEX "share_links_initiativeId_idx" ON "share_links"("initiativeId");
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "business_initiatives"("id") ON DELETE SET NULL ON UPDATE CASCADE;
