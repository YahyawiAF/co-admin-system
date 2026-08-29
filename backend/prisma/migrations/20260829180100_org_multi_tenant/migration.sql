-- Multi-tenant isolation: org activation, member/product/price/group scoping, memberships

-- Organization CRM fields
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "activatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- Ensure at least one organization exists for backfill
INSERT INTO "organizations" ("id", "name", "slug", "isActive", "activatedAt", "createdAt")
SELECT gen_random_uuid(), 'Collabora Hub', 'collabora-hub', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "organizations" LIMIT 1);

-- Member organization scoping
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "members" m
SET "organizationId" = (
  SELECT o.id FROM "organizations" o ORDER BY o."createdAt" ASC LIMIT 1
)
WHERE m."organizationId" IS NULL;

ALTER TABLE "members" ALTER COLUMN "organizationId" SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE "members" ADD CONSTRAINT "members_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "members" DROP CONSTRAINT IF EXISTS "members_phone_key";
ALTER TABLE "members" DROP CONSTRAINT IF EXISTS "members_email_key";
ALTER TABLE "members" DROP CONSTRAINT IF EXISTS "members_visitorNumber_key";

CREATE UNIQUE INDEX IF NOT EXISTS "members_organizationId_phone_key"
  ON "members"("organizationId", "phone");
CREATE UNIQUE INDEX IF NOT EXISTS "members_organizationId_visitorNumber_key"
  ON "members"("organizationId", "visitorNumber");
CREATE INDEX IF NOT EXISTS "members_organizationId_idx" ON "members"("organizationId");

-- MemberGroup organization
ALTER TABLE "member_groups" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "member_groups" g
SET "organizationId" = (SELECT o.id FROM "organizations" o ORDER BY o."createdAt" ASC LIMIT 1)
WHERE g."organizationId" IS NULL;
ALTER TABLE "member_groups" ALTER COLUMN "organizationId" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "member_groups" ADD CONSTRAINT "member_groups_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "member_groups_organizationId_idx" ON "member_groups"("organizationId");

-- Product organization
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "products" p
SET "organizationId" = (SELECT o.id FROM "organizations" o ORDER BY o."createdAt" ASC LIMIT 1)
WHERE p."organizationId" IS NULL;
DO $$ BEGIN
  ALTER TABLE "products" ADD CONSTRAINT "products_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "products_organizationId_idx" ON "products"("organizationId");

-- Price organization
ALTER TABLE "prices" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "prices" p
SET "organizationId" = (SELECT o.id FROM "organizations" o ORDER BY o."createdAt" ASC LIMIT 1)
WHERE p."organizationId" IS NULL;
DO $$ BEGIN
  ALTER TABLE "prices" ADD CONSTRAINT "prices_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "prices_organizationId_idx" ON "prices"("organizationId");

-- Link orphan facilities to primary org
UPDATE "facilities" f
SET "organizationId" = (SELECT o.id FROM "organizations" o ORDER BY o."createdAt" ASC LIMIT 1)
WHERE f."organizationId" IS NULL;

-- Organization memberships
CREATE TABLE IF NOT EXISTS "organization_memberships" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'ORG_ADMIN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "organization_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "organization_memberships_userId_organizationId_key"
  ON "organization_memberships"("userId", "organizationId");
CREATE INDEX IF NOT EXISTS "organization_memberships_organizationId_idx"
  ON "organization_memberships"("organizationId");

DO $$ BEGIN
  ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Facility memberships (permission stubs)
CREATE TABLE IF NOT EXISTS "facility_memberships" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "facilityId" TEXT NOT NULL,
  "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "facility_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "facility_memberships_userId_facilityId_key"
  ON "facility_memberships"("userId", "facilityId");
CREATE INDEX IF NOT EXISTS "facility_memberships_facilityId_idx"
  ON "facility_memberships"("facilityId");

DO $$ BEGIN
  ALTER TABLE "facility_memberships" ADD CONSTRAINT "facility_memberships_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "facility_memberships" ADD CONSTRAINT "facility_memberships_facilityId_fkey"
    FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Promote existing ADMIN users to SUPER_ADMIN and attach to primary org
UPDATE "users" SET "role" = 'SUPER_ADMIN' WHERE "role" = 'ADMIN';

INSERT INTO "organization_memberships" ("id", "userId", "organizationId", "role", "createdAt", "updatedAt")
SELECT gen_random_uuid(), u.id, (SELECT o.id FROM "organizations" o ORDER BY o."createdAt" ASC LIMIT 1), 'SUPER_ADMIN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "users" u
WHERE u."role" = 'SUPER_ADMIN'
  AND NOT EXISTS (
    SELECT 1 FROM "organization_memberships" om WHERE om."userId" = u.id
  );
