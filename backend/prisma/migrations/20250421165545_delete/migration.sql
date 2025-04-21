/*
  Warnings:

  - Made the column `registredTime` on table `journals` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "journals" ALTER COLUMN "registredTime" SET NOT NULL;
