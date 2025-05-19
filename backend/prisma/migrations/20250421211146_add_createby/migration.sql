-- AlterTable
ALTER TABLE "journals" ADD COLUMN     "createdbyUserID" TEXT;

-- AddForeignKey
ALTER TABLE "journals" ADD CONSTRAINT "journals_createdbyUserID_fkey" FOREIGN KEY ("createdbyUserID") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
