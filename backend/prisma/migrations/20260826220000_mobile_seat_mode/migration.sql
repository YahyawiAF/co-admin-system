-- CreateEnum
CREATE TYPE "MobileSeatMode" AS ENUM ('ADMIN_ASSIGN', 'VISITOR_CHOOSE', 'AUTO_ASSIGN');

-- AlterTable
ALTER TABLE "facilities" ADD COLUMN "mobileSeatMode" "MobileSeatMode" NOT NULL DEFAULT 'ADMIN_ASSIGN';
ALTER TABLE "facilities" ADD COLUMN "receptionAway" BOOLEAN NOT NULL DEFAULT false;
