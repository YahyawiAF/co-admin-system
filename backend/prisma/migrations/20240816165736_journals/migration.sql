-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('NOPLAN', 'BASIC', 'PRO');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "fonctionality" TEXT,
ADD COLUMN     "plan" "Plan" NOT NULL DEFAULT 'NOPLAN';

-- CreateTable
CREATE TABLE "journals" (
    "id" TEXT NOT NULL,
    "isPayed" BOOLEAN NOT NULL,
    "registredTime" TIMESTAMP(3) NOT NULL,
    "leaveTime" TIMESTAMP(3),
    "payedAmount" DOUBLE PRECISION NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP,
    "updatedAt" TIMESTAMP,

    CONSTRAINT "journals_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "journals" ADD CONSTRAINT "journals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
