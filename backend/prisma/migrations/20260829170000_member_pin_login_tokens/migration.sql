-- AlterTable
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "pinHash" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "member_login_tokens" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "shortCode" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_login_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "member_login_tokens_tokenHash_key" ON "member_login_tokens"("tokenHash");
CREATE INDEX IF NOT EXISTS "member_login_tokens_memberId_shortCode_idx" ON "member_login_tokens"("memberId", "shortCode");
CREATE INDEX IF NOT EXISTS "member_login_tokens_expiresAt_idx" ON "member_login_tokens"("expiresAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "member_login_tokens" ADD CONSTRAINT "member_login_tokens_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
