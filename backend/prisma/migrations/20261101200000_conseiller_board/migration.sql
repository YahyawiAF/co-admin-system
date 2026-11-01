-- Conseiller board: pause / resume, "intéressés", dropped actions, dismissed ideas
ALTER TABLE "business_initiatives" ADD COLUMN "interested" INTEGER;
ALTER TABLE "business_initiatives" ADD COLUMN "pauses" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "business_initiatives" ADD COLUMN "droppedAt" TIMESTAMP(3);
ALTER TABLE "business_initiatives" ADD COLUMN "dropReason" TEXT;

CREATE TABLE "advisor_dismissals" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "leverId" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "advisor_dismissals_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "advisor_dismissals_facilityId_createdAt_idx" ON "advisor_dismissals"("facilityId", "createdAt");
ALTER TABLE "advisor_dismissals" ADD CONSTRAINT "advisor_dismissals_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
