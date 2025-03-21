-- AlterTable
ALTER TABLE "journals" ADD COLUMN     "priceId" TEXT;

-- AddForeignKey
ALTER TABLE "journals" ADD CONSTRAINT "journals_priceId_fkey" FOREIGN KEY ("priceId") REFERENCES "prices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
