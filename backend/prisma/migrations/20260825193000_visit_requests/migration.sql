DO $$ BEGIN
  CREATE TYPE "VisitRequestType" AS ENUM ('DAY', 'SUBSCRIPTION');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "VisitRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "visit_requests" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "priceId" TEXT NOT NULL,
  "type" "VisitRequestType" NOT NULL,
  "status" "VisitRequestStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "visit_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "visit_requests_status_idx" ON "visit_requests"("status");

ALTER TABLE "visit_requests" ADD CONSTRAINT "visit_requests_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "visit_requests" ADD CONSTRAINT "visit_requests_priceId_fkey"
  FOREIGN KEY ("priceId") REFERENCES "prices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
