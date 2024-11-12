/*
  Warnings:

  - The `plan` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "Subscription" AS ENUM ('NOPSubs', 'Monthly', 'Weekly');

-- AlterTable
ALTER TABLE "users" DROP COLUMN "plan",
ADD COLUMN     "plan" "Subscription" NOT NULL DEFAULT 'NOPSubs';

-- DropEnum
DROP TYPE "Plan";

-- CreateTable
CREATE TABLE "Prices" (
    "id" TEXT NOT NULL,
    "journalPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "demiJournal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monthSubscription" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "weekSubscription" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "meetingRoomHourly" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "meetingRoomMonthly" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation" (
    "id" TEXT NOT NULL,
    "isPayed" BOOLEAN NOT NULL,
    "registredTime" TIMESTAMP(3) NOT NULL,
    "leaveTime" TIMESTAMP(3),
    "payedAmount" DOUBLE PRECISION NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP,
    "updatedAt" TIMESTAMP,

    CONSTRAINT "reservation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
