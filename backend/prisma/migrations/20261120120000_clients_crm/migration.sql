-- Finance › Clients: never-contact switch, staff note, group rules
ALTER TABLE "members" ADD COLUMN "doNotContact" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "members" ADD COLUMN "doNotContactAt" TIMESTAMP(3);
ALTER TABLE "members" ADD COLUMN "staffNote" TEXT;
ALTER TABLE "facilities" ADD COLUMN "clientRules" JSONB;

-- Visits per client, by date (client groups)
CREATE INDEX "journals_memberID_registredTime_idx" ON "journals"("memberID", "registredTime");
