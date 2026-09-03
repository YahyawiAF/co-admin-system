-- AlterTable
ALTER TABLE "spaces" ADD COLUMN IF NOT EXISTS "categories" "PriceCategory"[] DEFAULT ARRAY[]::"PriceCategory"[];

UPDATE "spaces"
SET "categories" = ARRAY["category"]::"PriceCategory"[]
WHERE "category" IS NOT NULL
  AND (cardinality("categories") = 0 OR "categories" IS NULL);
