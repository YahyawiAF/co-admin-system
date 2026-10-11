-- Caisse / coffre days were stored one day early (local midnight written as a UTC date).
-- Two steps to avoid transient conflicts on the unique caisse date.
UPDATE "caisse_sessions" SET "date" = "date" + 100000;
UPDATE "caisse_sessions" SET "date" = "date" - 99999;
UPDATE "coffre_entries" SET "date" = "date" + 1;
