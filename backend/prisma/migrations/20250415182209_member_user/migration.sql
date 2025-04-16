/*
  Warnings:

  - The `phone` column on the `members` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `memberId` on the `users` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_memberId_fkey";

-- DropIndex
DROP INDEX "users_memberId_key";

-- AlterTable
ALTER TABLE "members" DROP COLUMN "phone",
ADD COLUMN     "phone" INTEGER;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "memberId";

-- CreateIndex
CREATE UNIQUE INDEX "members_phone_key" ON "members"("phone");
