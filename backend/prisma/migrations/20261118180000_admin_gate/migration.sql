-- AlterTable
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "adminGateEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "adminGateKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_adminGateKey_key" ON "organizations"("adminGateKey");
