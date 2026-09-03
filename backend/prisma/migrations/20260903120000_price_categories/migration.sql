-- AlterTable
ALTER TABLE "prices" ADD COLUMN IF NOT EXISTS "categories" "PriceCategory"[] DEFAULT ARRAY[]::"PriceCategory"[];

-- Backfill from legacy single category
UPDATE "prices"
SET "categories" = ARRAY["category"]::"PriceCategory"[]
WHERE "category" IS NOT NULL
  AND (cardinality("categories") = 0 OR "categories" IS NULL);
