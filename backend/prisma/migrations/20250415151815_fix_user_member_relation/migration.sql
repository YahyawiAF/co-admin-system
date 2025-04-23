/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `members` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "members" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "members_userId_key" ON "members"("userId");
