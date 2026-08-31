-- AlterEnum
ALTER TYPE "FixtureKind" ADD VALUE 'ARROW';
ALTER TYPE "FixtureKind" ADD VALUE 'STAIRS';
ALTER TYPE "FixtureKind" ADD VALUE 'TEXT';

-- AlterTable
ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "receptionAwayStartedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "visit_requests" ADD COLUMN IF NOT EXISTS "seatLabel" TEXT;
ALTER TABLE "visit_requests" ADD COLUMN IF NOT EXISTS "spaceId" TEXT;
ALTER TABLE "visit_requests" ADD COLUMN IF NOT EXISTS "autoApproved" BOOLEAN NOT NULL DEFAULT false;
