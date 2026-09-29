-- CreateTable: "Fil du jour" community notes (wiped daily)
CREATE TABLE IF NOT EXISTS "community_notes" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "text" VARCHAR(120) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "community_notes_organizationId_createdAt_idx" ON "community_notes"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "community_notes_memberId_createdAt_idx" ON "community_notes"("memberId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "community_notes" ADD CONSTRAINT "community_notes_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
