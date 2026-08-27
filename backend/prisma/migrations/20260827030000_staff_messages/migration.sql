-- CreateTable
CREATE TABLE "staff_messages" (
    "id" TEXT NOT NULL,
    "toMemberId" TEXT NOT NULL,
    "fromUserId" TEXT,
    "text" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_messages_toMemberId_createdAt_idx" ON "staff_messages"("toMemberId", "createdAt");

-- AddForeignKey
ALTER TABLE "staff_messages" ADD CONSTRAINT "staff_messages_toMemberId_fkey" FOREIGN KEY ("toMemberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
