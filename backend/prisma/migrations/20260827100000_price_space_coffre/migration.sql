-- AlterTable
ALTER TABLE "prices" ADD COLUMN "spaceId" TEXT;

-- CreateIndex
CREATE INDEX "prices_spaceId_idx" ON "prices"("spaceId");

-- AddForeignKey
ALTER TABLE "prices" ADD CONSTRAINT "prices_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "coffre_entries" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "label" TEXT,
    "caisseSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coffre_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coffre_entries_date_idx" ON "coffre_entries"("date");

-- AddForeignKey
ALTER TABLE "coffre_entries" ADD CONSTRAINT "coffre_entries_caisseSessionId_fkey" FOREIGN KEY ("caisseSessionId") REFERENCES "caisse_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
