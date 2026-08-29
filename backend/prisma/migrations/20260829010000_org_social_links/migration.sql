-- AlterTable
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "facebookUrl" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "instagramUrl" TEXT;
