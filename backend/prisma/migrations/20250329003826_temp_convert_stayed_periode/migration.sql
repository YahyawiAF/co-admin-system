/*
  Warnings:

  - Made the column `stayedPeriode` on table `abonnements` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "abonnements" ALTER COLUMN "stayedPeriode" SET NOT NULL,
ALTER COLUMN "stayedPeriode" SET DATA TYPE TEXT;
