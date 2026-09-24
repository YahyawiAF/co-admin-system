-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PointEvent" AS ENUM ('CHECK_IN', 'CHECK_OUT', 'CAFE_ORDER', 'INSTALL_PWA');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "PointEntryStatus" AS ENUM ('PENDING', 'CREDITED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AlterTable
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "points" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "member_point_entries" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "event" "PointEvent" NOT NULL,
    "status" "PointEntryStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3),
    "creditedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "member_point_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "member_trophies" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "trophyId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "member_trophies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "member_point_entries_memberId_status_idx" ON "member_point_entries"("memberId", "status");
CREATE INDEX IF NOT EXISTS "member_point_entries_memberId_event_status_idx" ON "member_point_entries"("memberId", "event", "status");
CREATE INDEX IF NOT EXISTS "member_point_entries_expiresAt_idx" ON "member_point_entries"("expiresAt");
CREATE INDEX IF NOT EXISTS "member_trophies_memberId_idx" ON "member_trophies"("memberId");

DO $$ BEGIN
  ALTER TABLE "member_point_entries" ADD CONSTRAINT "member_point_entries_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "member_trophies" ADD CONSTRAINT "member_trophies_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "member_trophies" ADD CONSTRAINT "member_trophies_memberId_trophyId_key"
    UNIQUE ("memberId", "trophyId");
EXCEPTION WHEN duplicate_object THEN null; END $$;
