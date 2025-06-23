-- AlterTable
ALTER TABLE "DailyProduct" ADD COLUMN     "memberId" TEXT;

-- AddForeignKey
ALTER TABLE "DailyProduct" ADD CONSTRAINT "DailyProduct_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
