/*
  Warnings:

  - You are about to drop the column `resetPasswordToken` on the `users` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "PriceType" AS ENUM ('journal', 'abonnement');

-- AlterTable
ALTER TABLE "users" DROP COLUMN "resetPasswordToken";

-- CreateTable
CREATE TABLE "prices" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "timePeriod" TEXT NOT NULL,
    "type" "PriceType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prices_pkey" PRIMARY KEY ("id")
);
