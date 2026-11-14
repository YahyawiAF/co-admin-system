-- The space rules show before every check-in by default.
ALTER TABLE "facilities" ALTER COLUMN "houseRulesBeforeForfait" SET DEFAULT true;
ALTER TABLE "facilities" ALTER COLUMN "houseRulesFrequency" SET DEFAULT 'ALWAYS';
UPDATE "facilities" SET "houseRulesBeforeForfait" = true, "houseRulesFrequency" = 'ALWAYS';
