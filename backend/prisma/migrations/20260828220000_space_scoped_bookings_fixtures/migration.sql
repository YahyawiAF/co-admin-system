-- AlterTable
ALTER TABLE "abonnements" ADD COLUMN "reservedSeatSpaceId" TEXT;

-- AlterTable
ALTER TABLE "seat_bookings" ADD COLUMN "spaceId" TEXT;

-- Backfill spaceId from the first matching seat label (stops cross-space collisions)
UPDATE "seat_bookings" AS b
SET "spaceId" = s."spaceId"
FROM (
  SELECT DISTINCT ON ("label") "id", "label", "spaceId"
  FROM "seats"
  ORDER BY "label", "createdAt" ASC
) AS s
WHERE b."seatId" = s."label" AND b."spaceId" IS NULL;

-- Drop bookings that cannot be mapped to a space
DELETE FROM "seat_bookings" WHERE "spaceId" IS NULL;

-- Make spaceId required
ALTER TABLE "seat_bookings" ALTER COLUMN "spaceId" SET NOT NULL;

-- Unique is now per space
DROP INDEX IF EXISTS "seat_bookings_eventKey_seatId_key";
CREATE UNIQUE INDEX "seat_bookings_eventKey_spaceId_seatId_key" ON "seat_bookings"("eventKey", "spaceId", "seatId");

-- CreateEnum
CREATE TYPE "FixtureKind" AS ENUM ('ARMCHAIR', 'TV', 'TRIANGLE', 'CIRCLE', 'DOOR', 'TOILET', 'KITCHEN');

-- CreateTable
CREATE TABLE "space_fixtures" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "kind" "FixtureKind" NOT NULL,
    "label" TEXT,
    "x" DOUBLE PRECISION NOT NULL DEFAULT 40,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 40,
    "width" DOUBLE PRECISION NOT NULL DEFAULT 48,
    "height" DOUBLE PRECISION NOT NULL DEFAULT 48,
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "space_fixtures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "space_fixtures_spaceId_idx" ON "space_fixtures"("spaceId");
CREATE INDEX "seat_bookings_spaceId_idx" ON "seat_bookings"("spaceId");

-- AddForeignKey
ALTER TABLE "space_fixtures" ADD CONSTRAINT "space_fixtures_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "seat_bookings" ADD CONSTRAINT "seat_bookings_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
