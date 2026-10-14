/**
 * One-shot: enqueue every existing Member/Price/Abonnement/Journal/Product/DailyProduct
 * that has no SyncMapping yet, so the ERP bridge (src/modules/erp-sync) does a full historical
 * sync to supply-chain-pro instead of only covering changes from now on.
 * Safe to re-run — skips anything already mapped or already queued.
 * Usage: node scripts/backfill-sync-outbox.cjs
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
      const val = m[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}

loadEnv();

const prisma = new PrismaClient();

const ENTITIES = [
  {
    entityType: 'member',
    load: () => prisma.member.findMany({ where: { deletedAt: null }, select: { id: true } }),
  },
  {
    entityType: 'price',
    load: () => prisma.price.findMany({ select: { id: true } }),
  },
  {
    entityType: 'abonnement',
    load: () => prisma.abonnement.findMany({ select: { id: true } }),
  },
  {
    entityType: 'journal',
    load: () => prisma.journal.findMany({ select: { id: true } }),
  },
  {
    entityType: 'product',
    load: () => prisma.product.findMany({ select: { id: true } }),
  },
  {
    entityType: 'dailyProduct',
    load: () =>
      prisma.dailyProduct.findMany({
        where: { status: { not: 'CANCELLED' } },
        select: { id: true },
      }),
  },
];

async function backfill(entityType, load) {
  const rows = await load();
  let queued = 0;
  for (const row of rows) {
    const mapped = await prisma.syncMapping.findUnique({
      where: { entityType_entityId: { entityType, entityId: row.id } },
    });
    if (mapped) continue;
    const pending = await prisma.syncOutbox.findFirst({
      where: { entityType, entityId: row.id, status: 'PENDING' },
    });
    if (pending) continue;
    await prisma.syncOutbox.create({
      data: { entityType, entityId: row.id, operation: 'CREATE' },
    });
    queued++;
  }
  console.log(`${entityType}: queued ${queued} of ${rows.length}`);
}

async function main() {
  for (const { entityType, load } of ENTITIES) {
    await backfill(entityType, load);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
