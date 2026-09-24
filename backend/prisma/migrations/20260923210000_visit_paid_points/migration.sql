-- AlterEnum (safe if already present)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'PointEvent' AND e.enumlabel = 'VISIT_PAID'
  ) THEN
    ALTER TYPE "PointEvent" ADD VALUE 'VISIT_PAID';
  END IF;
END $$;

ALTER TABLE "member_point_entries" ADD COLUMN IF NOT EXISTS "refId" TEXT;

CREATE INDEX IF NOT EXISTS "member_point_entries_memberId_event_refId_idx"
  ON "member_point_entries"("memberId", "event", "refId");
