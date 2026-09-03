-- AlterTable
ALTER TABLE "visit_requests" ADD COLUMN IF NOT EXISTS "receptionAckedAt" TIMESTAMP(3);
