/*
  Warnings:

  - The `phone` column on the `members` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "members" DROP COLUMN "phone",
ADD COLUMN     "phone" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "members_phone_key" ON "members"("phone");
