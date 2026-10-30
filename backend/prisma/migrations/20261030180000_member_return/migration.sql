-- Member return: profile type, source, away reason, first-visit promos. Additive only.

DO $$ BEGIN
  CREATE TYPE "MemberProfileType" AS ENUM ('STUDENT', 'PUPIL', 'PRO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "profileType" "MemberProfileType";
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "profileTypeAt" TIMESTAMP(3);
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "heardFrom" TEXT;
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "heardFromAskedAt" TIMESTAMP(3);
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "awayReason" TEXT;
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "awayReasonAt" TIMESTAMP(3);
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "recallAt" TIMESTAMP(3);

ALTER TABLE "promotions" ADD COLUMN IF NOT EXISTS "requiresApp" BOOLEAN NOT NULL DEFAULT false;

-- Fill the profile from the free-text "fonction" when it is clear
UPDATE "members" SET "profileType" = 'STUDENT'
  WHERE "profileType" IS NULL AND "functionality" ~* '(é|e)tudiant';
UPDATE "members" SET "profileType" = 'PUPIL'
  WHERE "profileType" IS NULL AND "functionality" ~* '(é|e)l(è|e)ve|lyc(é|e)e|bac';
UPDATE "members" SET "profileType" = 'PRO'
  WHERE "profileType" IS NULL AND btrim(coalesce("functionality", '')) <> '';
UPDATE "members" SET "profileTypeAt" = now()
  WHERE "profileType" IS NOT NULL AND "profileTypeAt" IS NULL;
