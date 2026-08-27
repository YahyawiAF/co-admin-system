ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "visitorNumber" INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS "members_visitorNumber_key" ON "members"("visitorNumber");
