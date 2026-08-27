-- AlterTable
ALTER TABLE "abonnements" ADD COLUMN "reservedSeatLabel" TEXT;

-- AlterTable
ALTER TABLE "seat_bookings" ADD COLUMN "isPermanent" BOOLEAN NOT NULL DEFAULT false;
