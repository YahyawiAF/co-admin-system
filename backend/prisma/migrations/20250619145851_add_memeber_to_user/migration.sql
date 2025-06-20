/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `members` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'MEMBER';

-- AlterTable
ALTER TABLE "members" ALTER COLUMN "userId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "memeberID" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "members_userId_key" ON "members"("userId");

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
