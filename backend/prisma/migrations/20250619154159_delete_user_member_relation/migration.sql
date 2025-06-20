/*
  Warnings:

  - The `phone` column on the `members` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `userId` column on the `members` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- DropForeignKey
ALTER TABLE "members" DROP CONSTRAINT "members_userId_fkey";

-- DropIndex
DROP INDEX "members_userId_key";

-- AlterTable
ALTER TABLE "members" DROP COLUMN "phone",
ADD COLUMN     "phone" INTEGER,
DROP COLUMN "userId",
ADD COLUMN     "userId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "members_phone_key" ON "members"("phone");
