-- AlterTable
ALTER TABLE "prices" ADD COLUMN IF NOT EXISTS "reserveSeatFromHour" INTEGER;
ALTER TABLE "prices" ADD COLUMN IF NOT EXISTS "reserveSeatToHour" INTEGER;
