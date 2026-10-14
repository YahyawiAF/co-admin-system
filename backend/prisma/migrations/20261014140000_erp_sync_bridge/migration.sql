-- CreateTable: durable queue of entities still needing a push to supply-chain-pro (co-admin -> ERP bridge)
CREATE TABLE IF NOT EXISTS "sync_outbox" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_outbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sync_outbox_status_entityType_createdAt_idx" ON "sync_outbox"("status", "entityType", "createdAt");

-- CreateTable: co-admin entity id <-> supply-chain-pro entity id, one row per synced record
CREATE TABLE IF NOT EXISTS "sync_mappings" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_mappings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sync_mappings_entityType_entityId_key" ON "sync_mappings"("entityType", "entityId");
