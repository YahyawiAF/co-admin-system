/**
 * One-shot: apply app-install promo DDL using DATABASE_URL from .env
 * Usage: node scripts/ensure-promo-schema.mjs
 */
const { readFileSync } = require('fs');
const { join } = require('path');
const { PrismaClient } = require('@prisma/client');

function loadEnv() {
  try {
    const raw = readFileSync(join(__dirname, '..', '.env'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (!m) continue;
      const key = m[1].trim();
      let val = m[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}

loadEnv();

const steps = [
  `DO $$ BEGIN
  CREATE TYPE "PromoValueKind" AS ENUM ('PERCENT', 'FIXED_DT');
EXCEPTION WHEN duplicate_object THEN null; END $$`,
  `ALTER TABLE "facilities" DROP COLUMN IF EXISTS "appInstallPromoAmount"`,
  `ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "appInstallGlobalPromoActive" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "appInstallGlobalPromoKind" "PromoValueKind"`,
  `ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "appInstallGlobalPromoValue" DOUBLE PRECISION`,
  `ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "appInstallPromoClaimedAt" TIMESTAMP(3)`,
  `CREATE TABLE IF NOT EXISTS "app_install_promos" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "priceId" TEXT NOT NULL,
    "valueKind" "PromoValueKind" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "app_install_promos_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "app_install_promos_facilityId_idx" ON "app_install_promos"("facilityId")`,
  `CREATE INDEX IF NOT EXISTS "app_install_promos_priceId_idx" ON "app_install_promos"("priceId")`,
  `DO $$ BEGIN
  ALTER TABLE "app_install_promos" ADD CONSTRAINT "app_install_promos_facilityId_fkey"
    FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$`,
  `DO $$ BEGIN
  ALTER TABLE "app_install_promos" ADD CONSTRAINT "app_install_promos_priceId_fkey"
    FOREIGN KEY ("priceId") REFERENCES "prices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$`,
  `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT gen_random_uuid()::text, '', NOW(), '20260922120000_app_install_promo', NULL, NULL, NOW(), 1
WHERE EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
)
AND NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations"
  WHERE migration_name = '20260922120000_app_install_promo'
)`,
];

async function main() {
  const prisma = new PrismaClient();
  try {
    for (const sql of steps) {
      await prisma.$executeRawUnsafe(sql);
    }
    console.log('OK: app-install promo schema applied');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
