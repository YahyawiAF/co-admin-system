-- Directeur: memory of the business, monthly profit goal, owner's own corners.
ALTER TABLE "facilities" ADD COLUMN "directorGoalProfit" INTEGER NOT NULL DEFAULT 10000;
ALTER TABLE "facilities" ADD COLUMN "directorGoalDate" DATE;
ALTER TABLE "facilities" ADD COLUMN "directorCorners" JSONB;

CREATE TABLE "director_entries" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kind" TEXT NOT NULL,
    "corner" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "detail" TEXT,
    "source" TEXT NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "director_entries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "director_entries_facilityId_date_idx" ON "director_entries"("facilityId", "date");
ALTER TABLE "director_entries" ADD CONSTRAINT "director_entries_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
