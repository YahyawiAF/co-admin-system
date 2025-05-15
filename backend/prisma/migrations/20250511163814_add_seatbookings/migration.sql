-- CreateTable
CREATE TABLE "seat_bookings" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "isBooked" BOOLEAN NOT NULL DEFAULT false,
    "bookedAt" TIMESTAMP(3),
    "memberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seat_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seat_bookings_eventKey_seatId_key" ON "seat_bookings"("eventKey", "seatId");

-- AddForeignKey
ALTER TABLE "seat_bookings" ADD CONSTRAINT "seat_bookings_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
