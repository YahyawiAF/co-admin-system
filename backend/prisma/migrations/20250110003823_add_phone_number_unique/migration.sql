/*
  Warnings:

  - A unique constraint covering the columns `[phone]` on the table `members` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "members" ADD COLUMN     "phone" VARCHAR(56);

-- CreateIndex
CREATE UNIQUE INDEX "members_phone_key" ON "members"("phone");
