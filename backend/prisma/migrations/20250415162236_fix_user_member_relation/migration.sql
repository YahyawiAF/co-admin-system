/*
  Warnings:

  - You are about to drop the column `userId` on the `members` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "members" DROP CONSTRAINT "members_userId_fkey";

-- DropIndex
DROP INDEX "members_userId_key";

-- AlterTable
ALTER TABLE "members" DROP COLUMN "userId";

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
