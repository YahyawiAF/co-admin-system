-- CreateEnum
CREATE TYPE "EventKind" AS ENUM ('WORKSHOP', 'NETWORKING', 'OTHER');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventRegistrationStatus" AS ENUM ('REGISTERED', 'CANCELLED', 'ATTENDED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- AlterTable
ALTER TABLE "facilities" ADD COLUMN "organizationId" TEXT;

-- CreateIndex
CREATE INDEX "facilities_organizationId_idx" ON "facilities"("organizationId");

-- AddForeignKey
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed one organization from the existing facility
DO $$
DECLARE
  fac RECORD;
  org_id TEXT;
  org_slug TEXT;
BEGIN
  SELECT * INTO fac FROM facilities ORDER BY "createdAt" ASC LIMIT 1;
  IF FOUND THEN
    org_id := gen_random_uuid()::text;
    org_slug := lower(regexp_replace(regexp_replace(fac.name, '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'));
    IF org_slug IS NULL OR org_slug = '' THEN
      org_slug := 'collabora-hub';
    END IF;
    INSERT INTO organizations (id, name, slug, logo, "createdAt")
    VALUES (org_id, COALESCE(NULLIF(fac.name, ''), 'Collabora Hub'), org_slug, fac.logo, NOW());
    UPDATE facilities SET "organizationId" = org_id WHERE id = fac.id;
  ELSE
    INSERT INTO organizations (id, name, slug, "createdAt")
    VALUES (gen_random_uuid()::text, 'Collabora Hub', 'collabora-hub', NOW());
  END IF;
END $$;

-- AlterTable members community fields
ALTER TABLE "members" ADD COLUMN "skills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "members" ADD COLUMN "services" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "members" ADD COLUMN "linkedinUrl" TEXT;
ALTER TABLE "members" ADD COLUMN "openToCollaboration" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "members" ADD COLUMN "showInDirectory" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" "EventKind" NOT NULL DEFAULT 'OTHER',
    "location" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "coverImage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_registrations" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" "EventRegistrationStatus" NOT NULL DEFAULT 'REGISTERED',
    "attendanceCode" TEXT NOT NULL,
    "checkedInAt" TIMESTAMP(3),
    "feedbackRating" INTEGER,
    "feedbackComment" TEXT,
    "feedbackAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "events_facilityId_startAt_idx" ON "events"("facilityId", "startAt");
CREATE INDEX "events_status_startAt_idx" ON "events"("status", "startAt");
CREATE UNIQUE INDEX "event_registrations_attendanceCode_key" ON "event_registrations"("attendanceCode");
CREATE UNIQUE INDEX "event_registrations_eventId_memberId_key" ON "event_registrations"("eventId", "memberId");
CREATE INDEX "event_registrations_eventId_status_idx" ON "event_registrations"("eventId", "status");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
