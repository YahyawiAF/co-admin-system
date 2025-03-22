/*
  Warnings:

  - Made the column `priceId` on table `journals` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "journals" DROP CONSTRAINT "journals_priceId_fkey";

-- AlterTable
ALTER TABLE "journals" ALTER COLUMN "priceId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "journals" ADD CONSTRAINT "journals_priceId_fkey" FOREIGN KEY ("priceId") REFERENCES "prices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
