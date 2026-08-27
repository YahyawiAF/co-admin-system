-- CreateEnum
CREATE TYPE "ProductOrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- AlterTable
ALTER TABLE "abonnements" ADD COLUMN "hoursQuota" DOUBLE PRECISION;
ALTER TABLE "abonnements" ADD COLUMN "hoursUsed" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "DailyProduct" ADD COLUMN "memberId" TEXT;
ALTER TABLE "DailyProduct" ADD COLUMN "journalId" TEXT;
ALTER TABLE "DailyProduct" ADD COLUMN "status" "ProductOrderStatus" NOT NULL DEFAULT 'CONFIRMED';
ALTER TABLE "DailyProduct" ADD COLUMN "isPayed" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "DailyProduct" ADD CONSTRAINT "DailyProduct_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
