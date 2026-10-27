-- Reservation cancel: who/when, and the fee kept as a member debt. Additive only.
ALTER TABLE "booking_requests"
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelledBy" VARCHAR(16),
  ADD COLUMN "cancelFee" DOUBLE PRECISION,
  ADD COLUMN "feeLedgerId" TEXT;
