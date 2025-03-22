-- DropForeignKey
ALTER TABLE "journals" DROP CONSTRAINT "journals_priceId_fkey";

-- AlterTable
ALTER TABLE "journals" ALTER COLUMN "priceId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "journals" ADD CONSTRAINT "journals_priceId_fkey" FOREIGN KEY ("priceId") REFERENCES "prices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
