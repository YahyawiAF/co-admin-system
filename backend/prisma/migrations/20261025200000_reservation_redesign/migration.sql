-- Visitor reservation redesign: fee + rules per facility, table description,
-- several places per booking request. Additive only.
ALTER TABLE "facilities"
  ADD COLUMN "reservationFee" DOUBLE PRECISION NOT NULL DEFAULT 2,
  ADD COLUMN "reservationFeePerPlace" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reservationMaxDaysAhead" INTEGER NOT NULL DEFAULT 14,
  ADD COLUMN "reservationMaxPlaces" INTEGER NOT NULL DEFAULT 4,
  ADD COLUMN "reservationAutoApprove" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "tables" ADD COLUMN "description" TEXT;

ALTER TABLE "booking_requests"
  ADD COLUMN "seatLabels" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "places" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "fee" DOUBLE PRECISION NOT NULL DEFAULT 0;
