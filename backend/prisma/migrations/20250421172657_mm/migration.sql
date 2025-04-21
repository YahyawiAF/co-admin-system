-- DropForeignKey
ALTER TABLE "journals" DROP CONSTRAINT "journals_memberID_fkey";

-- AlterTable
ALTER TABLE "journals" ALTER COLUMN "memberID" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "journals" ADD CONSTRAINT "journals_memberID_fkey" FOREIGN KEY ("memberID") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
