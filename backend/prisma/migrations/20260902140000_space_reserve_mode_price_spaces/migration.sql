-- CreateEnum
CREATE TYPE "SpaceReserveMode" AS ENUM ('SEAT', 'WHOLE', 'BOTH');

-- AlterTable
ALTER TABLE "spaces" ADD COLUMN "reserveMode" "SpaceReserveMode" NOT NULL DEFAULT 'BOTH';

UPDATE "spaces" SET "reserveMode" = 'WHOLE' WHERE "category" = 'SALLE';
UPDATE "spaces" SET "reserveMode" = 'SEAT' WHERE "category" IS NULL OR "category" = 'JOURNEE';
UPDATE "spaces" SET "reserveMode" = 'BOTH' WHERE "category" = 'OPEN_SPACE';

-- AlterTable
ALTER TABLE "prices" ADD COLUMN "occupySeat" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "prices" ADD COLUMN "occupyWhole" BOOLEAN NOT NULL DEFAULT false;

UPDATE "prices" SET "occupySeat" = false, "occupyWhole" = true WHERE "category" = 'SALLE';
UPDATE "prices" SET "occupySeat" = true, "occupyWhole" = true WHERE "category" = 'OPEN_SPACE';

-- CreateTable
CREATE TABLE "price_spaces" (
    "id" TEXT NOT NULL,
    "priceId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,

    CONSTRAINT "price_spaces_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "price_spaces_priceId_spaceId_key" ON "price_spaces"("priceId", "spaceId");
CREATE INDEX "price_spaces_spaceId_idx" ON "price_spaces"("spaceId");

ALTER TABLE "price_spaces" ADD CONSTRAINT "price_spaces_priceId_fkey" FOREIGN KEY ("priceId") REFERENCES "prices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "price_spaces" ADD CONSTRAINT "price_spaces_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "price_spaces" ("id", "priceId", "spaceId")
SELECT gen_random_uuid()::text, "id", "spaceId" FROM "prices" WHERE "spaceId" IS NOT NULL;

ALTER TABLE "visit_requests" ADD COLUMN "occupyWhole" BOOLEAN NOT NULL DEFAULT false;
