import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/** Idempotent statements for app-install promo (same as migration). */
const APP_INSTALL_PROMO_STEPS = [
  `DO $$ BEGIN
  CREATE TYPE "PromoValueKind" AS ENUM ('PERCENT', 'FIXED_DT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$`,
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
EXCEPTION
  WHEN duplicate_object THEN null;
END $$`,
  `DO $$ BEGIN
  ALTER TABLE "app_install_promos" ADD CONSTRAINT "app_install_promos_priceId_fkey"
    FOREIGN KEY ("priceId") REFERENCES "prices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$`,
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

const MEMBER_POINTS_STEPS = [
  `DO $$ BEGIN
  CREATE TYPE "PointEvent" AS ENUM ('CHECK_IN', 'CHECK_OUT', 'CAFE_ORDER', 'INSTALL_PWA', 'VISIT_PAID');
EXCEPTION WHEN duplicate_object THEN null; END $$`,
  `DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'PointEvent' AND e.enumlabel = 'VISIT_PAID'
  ) THEN
    ALTER TYPE "PointEvent" ADD VALUE 'VISIT_PAID';
  END IF;
END $$`,
  `DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'PointEvent' AND e.enumlabel = 'PRODUCT_PAID'
  ) THEN
    ALTER TYPE "PointEvent" ADD VALUE 'PRODUCT_PAID';
  END IF;
END $$`,
  `DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'PointEvent' AND e.enumlabel = 'ADMIN_ADJUST'
  ) THEN
    ALTER TYPE "PointEvent" ADD VALUE 'ADMIN_ADJUST';
  END IF;
END $$`,
  `DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'PointEvent' AND e.enumlabel = 'REDEEM_VISIT'
  ) THEN
    ALTER TYPE "PointEvent" ADD VALUE 'REDEEM_VISIT';
  END IF;
END $$`,
  `DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'PointEvent' AND e.enumlabel = 'REDEEM_ORDER'
  ) THEN
    ALTER TYPE "PointEvent" ADD VALUE 'REDEEM_ORDER';
  END IF;
END $$`,
  `DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'PointEvent' AND e.enumlabel = 'PROFILE_DETAILS'
  ) THEN
    ALTER TYPE "PointEvent" ADD VALUE 'PROFILE_DETAILS';
  END IF;
END $$`,
  `DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'PointEvent' AND e.enumlabel = 'PROFILE_AVATAR'
  ) THEN
    ALTER TYPE "PointEvent" ADD VALUE 'PROFILE_AVATAR';
  END IF;
END $$`,
  `DO $$ BEGIN
  CREATE TYPE "PointEntryStatus" AS ENUM ('PENDING', 'CREDITED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN null; END $$`,
  `ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "points" INTEGER NOT NULL DEFAULT 0`,
  `CREATE TABLE IF NOT EXISTS "member_point_entries" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "event" "PointEvent" NOT NULL,
    "status" "PointEntryStatus" NOT NULL DEFAULT 'PENDING',
    "refId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "creditedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "member_point_entries_pkey" PRIMARY KEY ("id")
  )`,
  `ALTER TABLE "member_point_entries" ADD COLUMN IF NOT EXISTS "refId" TEXT`,
  `CREATE TABLE IF NOT EXISTS "member_trophies" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "trophyId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "member_trophies_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "member_point_entries_memberId_status_idx" ON "member_point_entries"("memberId", "status")`,
  `CREATE INDEX IF NOT EXISTS "member_point_entries_memberId_event_status_idx" ON "member_point_entries"("memberId", "event", "status")`,
  `CREATE INDEX IF NOT EXISTS "member_point_entries_memberId_event_refId_idx" ON "member_point_entries"("memberId", "event", "refId")`,
  `CREATE INDEX IF NOT EXISTS "member_point_entries_expiresAt_idx" ON "member_point_entries"("expiresAt")`,
  `CREATE INDEX IF NOT EXISTS "member_trophies_memberId_idx" ON "member_trophies"("memberId")`,
  `DO $$ BEGIN
  ALTER TABLE "member_point_entries" ADD CONSTRAINT "member_point_entries_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; WHEN duplicate_table THEN null; END $$`,
  `DO $$ BEGIN
  ALTER TABLE "member_trophies" ADD CONSTRAINT "member_trophies_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; WHEN duplicate_table THEN null; END $$`,
  `DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'member_trophies_memberId_trophyId_key'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'member_trophies_memberId_trophyId_key'
  ) THEN
    ALTER TABLE "member_trophies" ADD CONSTRAINT "member_trophies_memberId_trophyId_key"
      UNIQUE ("memberId", "trophyId");
  END IF;
EXCEPTION WHEN duplicate_object THEN null; WHEN duplicate_table THEN null; END $$`,
  `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT gen_random_uuid()::text, '', NOW(), '20260923190000_member_points_trophies', NULL, NULL, NOW(), 1
WHERE EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
)
AND NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations"
  WHERE migration_name = '20260923190000_member_points_trophies'
)`,
  `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT gen_random_uuid()::text, '', NOW(), '20260923210000_visit_paid_points', NULL, NULL, NOW(), 1
WHERE EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
)
AND NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations"
  WHERE migration_name = '20260923210000_visit_paid_points'
)`,
  `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT gen_random_uuid()::text, '', NOW(), '20260924120000_points_earn_redeem', NULL, NULL, NOW(), 1
WHERE EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
)
AND NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations"
  WHERE migration_name = '20260924120000_points_earn_redeem'
)`,
  `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT gen_random_uuid()::text, '', NOW(), '20260925140000_profile_mission_points', NULL, NULL, NOW(), 1
WHERE EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
)
AND NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations"
  WHERE migration_name = '20260925140000_profile_mission_points'
)`,
];

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
    } catch (err) {
      this.logger.error(
        `Database unreachable — API will fail until Postgres is up: ${
          err instanceof Error ? err.message : err
        }`,
      );
      return;
    }
    try {
      for (const sql of APP_INSTALL_PROMO_STEPS) {
        await this.$executeRawUnsafe(sql);
      }
      this.logger.log('App-install promo schema ensured');
    } catch (err) {
      this.logger.warn(
        `Could not ensure app-install promo schema: ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
    try {
      for (const sql of MEMBER_POINTS_STEPS) {
        await this.$executeRawUnsafe(sql);
      }
      this.logger.log('Member points/trophies schema ensured');
    } catch (err) {
      this.logger.warn(
        `Could not ensure member points schema: ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
  }
}
