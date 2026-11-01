-- Part of the price given away by staff ("Offert"), instead of a debt
ALTER TABLE "journals" ADD COLUMN "offeredAmount" DOUBLE PRECISION;
ALTER TABLE "abonnements" ADD COLUMN "offeredAmount" DOUBLE PRECISION;
