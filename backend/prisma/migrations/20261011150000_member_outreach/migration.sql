CREATE TABLE IF NOT EXISTS "member_outreach" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "member_outreach_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "member_outreach_memberId_createdAt_idx" ON "member_outreach"("memberId", "createdAt");
CREATE INDEX IF NOT EXISTS "member_outreach_createdAt_idx" ON "member_outreach"("createdAt");

DO $$ BEGIN
  ALTER TABLE "member_outreach" ADD CONSTRAINT "member_outreach_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
