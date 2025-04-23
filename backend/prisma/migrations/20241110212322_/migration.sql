/*
  Warnings:

  - You are about to drop the column `bio` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `fonctionality` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `plan` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `reservation` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "journals" DROP CONSTRAINT "journals_userId_fkey";

-- DropForeignKey
ALTER TABLE "reservation" DROP CONSTRAINT "reservation_userId_fkey";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "bio",
DROP COLUMN "fonctionality",
DROP COLUMN "plan";

-- DropTable
DROP TABLE "reservation";

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(256) NOT NULL,
    "fullname" VARCHAR(256),
    "fonctionality" TEXT,
    "bio" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "plan" "Subscription" NOT NULL DEFAULT 'NOPSubs',
    "createdAt" TIMESTAMP,
    "updatedAt" TIMESTAMP,
    "deletedAt" TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "isPayed" BOOLEAN NOT NULL,
    "registredTime" TIMESTAMP(3) NOT NULL,
    "leaveTime" TIMESTAMP(3),
    "payedAmount" DOUBLE PRECISION NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP,
    "updatedAt" TIMESTAMP,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_email_key" ON "clients"("email");

-- AddForeignKey
ALTER TABLE "journals" ADD CONSTRAINT "journals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
