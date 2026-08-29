-- AlterTable
ALTER TABLE "spaces" ADD COLUMN IF NOT EXISTS "wifiSsid" TEXT;
ALTER TABLE "spaces" ADD COLUMN IF NOT EXISTS "wifiPassword" TEXT;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "StaffMessageDirection" AS ENUM ('TO_MEMBER', 'TO_STAFF');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "staff_messages" ADD COLUMN IF NOT EXISTS "direction" "StaffMessageDirection" NOT NULL DEFAULT 'TO_MEMBER';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "staff_messages_direction_readAt_idx" ON "staff_messages"("direction", "readAt");
