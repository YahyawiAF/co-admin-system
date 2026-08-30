-- AlterTable
ALTER TABLE "spaces" ADD COLUMN IF NOT EXISTS "openForReservation" BOOLEAN NOT NULL DEFAULT false;
