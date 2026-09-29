-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "MemberAvailability" AS ENUM ('OPEN_TO_CHAT', 'FOCUS');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "availability" "MemberAvailability";
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "lookingFor" TEXT[] DEFAULT ARRAY[]::TEXT[];
