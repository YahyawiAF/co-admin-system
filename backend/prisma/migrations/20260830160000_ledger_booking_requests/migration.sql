-- CreateEnum
CREATE TYPE "LedgerKind" AS ENUM ('CREDIT', 'ECHEANCE');

-- CreateEnum
CREATE TYPE "BookingRequestKind" AS ENUM ('ROOM', 'SEAT');

-- CreateTable
CREATE TABLE "member_ledger" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "kind" "LedgerKind" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "dueDate" TIMESTAMP(3),
    "source" TEXT,
    "journalId" TEXT,
    "abonnementId" TEXT,
    "settled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_requests" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "kind" "BookingRequestKind" NOT NULL,
    "spaceId" TEXT,
    "spaceName" TEXT,
    "seatLabel" TEXT,
    "seatSpaceId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "status" "VisitRequestStatus" NOT NULL DEFAULT 'PENDING',
    "journalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "member_ledger_memberId_createdAt_idx" ON "member_ledger"("memberId", "createdAt");

-- CreateIndex
CREATE INDEX "member_ledger_kind_settled_idx" ON "member_ledger"("kind", "settled");

-- CreateIndex
CREATE INDEX "booking_requests_status_createdAt_idx" ON "booking_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "booking_requests_memberId_idx" ON "booking_requests"("memberId");

-- AddForeignKey
ALTER TABLE "member_ledger" ADD CONSTRAINT "member_ledger_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
