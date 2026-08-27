-- AlterTable
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "community_messages" (
    "id" TEXT NOT NULL,
    "fromMemberId" TEXT NOT NULL,
    "toMemberId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "community_messages_toMemberId_createdAt_idx" ON "community_messages"("toMemberId", "createdAt");
CREATE INDEX IF NOT EXISTS "community_messages_fromMemberId_createdAt_idx" ON "community_messages"("fromMemberId", "createdAt");

ALTER TABLE "community_messages" DROP CONSTRAINT IF EXISTS "community_messages_fromMemberId_fkey";
ALTER TABLE "community_messages" ADD CONSTRAINT "community_messages_fromMemberId_fkey" FOREIGN KEY ("fromMemberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "community_messages" DROP CONSTRAINT IF EXISTS "community_messages_toMemberId_fkey";
ALTER TABLE "community_messages" ADD CONSTRAINT "community_messages_toMemberId_fkey" FOREIGN KEY ("toMemberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
