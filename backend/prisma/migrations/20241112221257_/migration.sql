/*
  Warnings:

  - You are about to drop the column `userId` on the `journals` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `reservations` table. All the data in the column will be lost.
  - You are about to drop the `clients` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "journals" DROP CONSTRAINT "journals_userId_fkey";

-- DropForeignKey
ALTER TABLE "reservations" DROP CONSTRAINT "reservations_userId_fkey";

-- AlterTable
ALTER TABLE "journals" DROP COLUMN "userId",
ADD COLUMN     "memberID" TEXT;

-- AlterTable
ALTER TABLE "reservations" DROP COLUMN "userId",
ADD COLUMN     "memberID" TEXT;

-- DropTable
DROP TABLE "clients";

-- CreateTable
CREATE TABLE "members" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(256),
    "firstName" VARCHAR(56),
    "lastName" VARCHAR(56),
    "fonctionality" TEXT,
    "bio" TEXT,
    "credits" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "plan" "Subscription" DEFAULT 'NOPSubs',
    "createdAt" TIMESTAMP,
    "updatedAt" TIMESTAMP,
    "deletedAt" TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "members_email_key" ON "members"("email");

-- AddForeignKey
ALTER TABLE "journals" ADD CONSTRAINT "journals_memberID_fkey" FOREIGN KEY ("memberID") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_memberID_fkey" FOREIGN KEY ("memberID") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
