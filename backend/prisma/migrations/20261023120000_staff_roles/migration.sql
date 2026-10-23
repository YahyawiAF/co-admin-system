-- Staff role with per-module permissions, hide-instead-of-delete, and an audit log the admin reviews.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'STAFF';

ALTER TABLE "organization_memberships" ADD COLUMN IF NOT EXISTS "permissions" JSONB;

ALTER TABLE "journals" ADD COLUMN IF NOT EXISTS "hiddenAt" TIMESTAMP(3);
ALTER TABLE "journals" ADD COLUMN IF NOT EXISTS "hiddenByUserId" TEXT;
ALTER TABLE "abonnements" ADD COLUMN IF NOT EXISTS "hiddenAt" TIMESTAMP(3);
ALTER TABLE "abonnements" ADD COLUMN IF NOT EXISTS "hiddenByUserId" TEXT;
ALTER TABLE "member_ledger" ADD COLUMN IF NOT EXISTS "hiddenAt" TIMESTAMP(3);
ALTER TABLE "member_ledger" ADD COLUMN IF NOT EXISTS "hiddenByUserId" TEXT;

DO $$ BEGIN
  CREATE TYPE "StaffActionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REVERTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "staff_actions" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT,
    "userId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "summary" TEXT,
    "before" JSONB,
    "after" JSONB,
    "status" "StaffActionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    CONSTRAINT "staff_actions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "staff_actions_organizationId_status_createdAt_idx" ON "staff_actions"("organizationId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "staff_actions_userId_createdAt_idx" ON "staff_actions"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "staff_actions_entityType_entityId_idx" ON "staff_actions"("entityType", "entityId");

DO $$ BEGIN
  ALTER TABLE "staff_actions" ADD CONSTRAINT "staff_actions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "staff_actions" ADD CONSTRAINT "staff_actions_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
