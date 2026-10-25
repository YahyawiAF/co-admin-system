-- Follow-up of an advice: what was done, its cost, the figure to watch, the goal, notes and verdict
ALTER TABLE "business_initiatives" ADD COLUMN IF NOT EXISTS "recommendationTitle" TEXT;
ALTER TABLE "business_initiatives" ADD COLUMN IF NOT EXISTS "metric" TEXT;
ALTER TABLE "business_initiatives" ADD COLUMN IF NOT EXISTS "targetPct" DOUBLE PRECISION;
ALTER TABLE "business_initiatives" ADD COLUMN IF NOT EXISTS "cost" DOUBLE PRECISION;
ALTER TABLE "business_initiatives" ADD COLUMN IF NOT EXISTS "ownerVerdict" TEXT;
ALTER TABLE "business_initiatives" ADD COLUMN IF NOT EXISTS "notes" JSONB NOT NULL DEFAULT '[]';

-- Target (slot or client list), compared to the rest, and the sale tied to the action
ALTER TABLE "business_initiatives" ADD COLUMN IF NOT EXISTS "targetKind" TEXT NOT NULL DEFAULT 'ALL';
ALTER TABLE "business_initiatives" ADD COLUMN IF NOT EXISTS "targetDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "business_initiatives" ADD COLUMN IF NOT EXISTS "targetFromHour" INTEGER;
ALTER TABLE "business_initiatives" ADD COLUMN IF NOT EXISTS "targetToHour" INTEGER;
ALTER TABLE "business_initiatives" ADD COLUMN IF NOT EXISTS "targetSegment" TEXT;
ALTER TABLE "business_initiatives" ADD COLUMN IF NOT EXISTS "targetMemberIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "business_initiatives" ADD COLUMN IF NOT EXISTS "linkedKind" TEXT;
ALTER TABLE "business_initiatives" ADD COLUMN IF NOT EXISTS "linkedId" TEXT;
