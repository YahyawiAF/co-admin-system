/*
  Warnings:

  - Made the column `userId` on table `members` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_memberId_fkey";

-- AlterTable
ALTER TABLE "members" ALTER COLUMN "userId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
