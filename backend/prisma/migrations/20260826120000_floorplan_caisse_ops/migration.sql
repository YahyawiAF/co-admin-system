-- CreateTable
CREATE TABLE "spaces" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "floorPlanUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "capacityNormal" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tables" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "x" DOUBLE PRECISION NOT NULL DEFAULT 40,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 40,
    "width" DOUBLE PRECISION NOT NULL DEFAULT 120,
    "height" DOUBLE PRECISION NOT NULL DEFAULT 80,
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seats" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "tableId" TEXT,
    "label" TEXT NOT NULL,
    "offsetX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "offsetY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isOverflow" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "memberId" TEXT,
    "seatId" TEXT,
    "journalId" TEXT,
    "amount" DOUBLE PRECISION,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caisse_sessions" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "openingFloat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "countedClose" DOUBLE PRECISION,
    "expectedClose" DOUBLE PRECISION,
    "difference" DOUBLE PRECISION,
    "notes" TEXT,
    "externalOrgId" TEXT,
    "externalRef" TEXT,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "caisse_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caisse_movements" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "label" TEXT,
    "externalOrgId" TEXT,
    "externalRef" TEXT,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "caisse_movements_pkey" PRIMARY KEY ("id")
);

-- AlterTable DailyProduct / DailyExpense ERP fields
ALTER TABLE "DailyProduct" ADD COLUMN IF NOT EXISTS "externalOrgId" TEXT;
ALTER TABLE "DailyProduct" ADD COLUMN IF NOT EXISTS "externalRef" TEXT;
ALTER TABLE "DailyProduct" ADD COLUMN IF NOT EXISTS "syncedAt" TIMESTAMP(3);

ALTER TABLE "DailyExpense" ADD COLUMN IF NOT EXISTS "externalOrgId" TEXT;
ALTER TABLE "DailyExpense" ADD COLUMN IF NOT EXISTS "externalRef" TEXT;
ALTER TABLE "DailyExpense" ADD COLUMN IF NOT EXISTS "syncedAt" TIMESTAMP(3);

-- Indexes / FKs
CREATE UNIQUE INDEX "seats_spaceId_label_key" ON "seats"("spaceId", "label");
CREATE INDEX "ops_events_type_occurredAt_idx" ON "ops_events"("type", "occurredAt");
CREATE INDEX "ops_events_occurredAt_idx" ON "ops_events"("occurredAt");
CREATE UNIQUE INDEX "caisse_sessions_date_key" ON "caisse_sessions"("date");

ALTER TABLE "spaces" ADD CONSTRAINT "spaces_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tables" ADD CONSTRAINT "tables_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "seats" ADD CONSTRAINT "seats_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "seats" ADD CONSTRAINT "seats_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "caisse_movements" ADD CONSTRAINT "caisse_movements_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "caisse_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
