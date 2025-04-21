/*
  Warnings:

  - Made the column `memberID` on table `journals` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "journals" DROP CONSTRAINT "journals_memberID_fkey";

-- AlterTable
ALTER TABLE "journals" ALTER COLUMN "memberID" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "journals" ADD CONSTRAINT "journals_memberID_fkey" FOREIGN KEY ("memberID") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
