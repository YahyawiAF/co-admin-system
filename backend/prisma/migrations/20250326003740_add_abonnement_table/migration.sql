/*
  Warnings:

  - Changed the type of `timePeriod` on the `prices` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "prices" DROP COLUMN "timePeriod",
ADD COLUMN     "timePeriod" JSONB NOT NULL;

-- CreateTable
CREATE TABLE "abonnements" (
    "id" TEXT NOT NULL,
    "isPayed" BOOLEAN NOT NULL,
    "registredDate" TIMESTAMP(3) NOT NULL,
    "leaveDate" TIMESTAMP(3),
    "stayedPeriode" TIMESTAMP(3),
    "payedAmount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6),
    "memberID" TEXT NOT NULL,
    "isReservation" BOOLEAN NOT NULL DEFAULT false,
    "priceId" TEXT NOT NULL,

    CONSTRAINT "abonnements_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "abonnements" ADD CONSTRAINT "abonnements_memberID_fkey" FOREIGN KEY ("memberID") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abonnements" ADD CONSTRAINT "abonnements_priceId_fkey" FOREIGN KEY ("priceId") REFERENCES "prices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
