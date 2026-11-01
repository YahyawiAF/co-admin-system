-- Relances: member's answer, follow-up date and Suivi closing
ALTER TABLE "member_outreach" ADD COLUMN "outcome" TEXT;
ALTER TABLE "member_outreach" ADD COLUMN "note" TEXT;
ALTER TABLE "member_outreach" ADD COLUMN "followUpAt" TIMESTAMP(3);
ALTER TABLE "member_outreach" ADD COLUMN "closedAt" TIMESTAMP(3);
ALTER TABLE "member_outreach" ADD COLUMN "closedResult" TEXT;
ALTER TABLE "member_outreach" ADD COLUMN "closedAuto" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "member_outreach_closedAt_idx" ON "member_outreach"("closedAt");
