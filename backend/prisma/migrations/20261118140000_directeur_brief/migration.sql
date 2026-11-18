-- Directeur: Claude's last brief. Its own step: the first Directeur migration was already applied in production before this column was added to it.
ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "directorBrief" JSONB;
