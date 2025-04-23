/*
  Warnings:

  - You are about to drop the column `fonctionality` on the `members` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "members" DROP COLUMN "fonctionality",
ADD COLUMN     "functionality" TEXT;
