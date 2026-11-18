-- Directeur: lessons the director challenges and the texts the owner wants it to learn
ALTER TABLE "director_entries" ADD COLUMN IF NOT EXISTS "status" TEXT;
ALTER TABLE "director_entries" ADD COLUMN IF NOT EXISTS "confidence" INTEGER;
ALTER TABLE "director_entries" ADD COLUMN IF NOT EXISTS "domain" TEXT;
ALTER TABLE "director_entries" ADD COLUMN IF NOT EXISTS "origin" TEXT;
ALTER TABLE "director_entries" ADD COLUMN IF NOT EXISTS "evidence" JSONB;
ALTER TABLE "director_entries" ADD COLUMN IF NOT EXISTS "debate" JSONB;
ALTER TABLE "director_entries" ADD COLUMN IF NOT EXISTS "history" JSONB;
ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "directorLearn" JSONB;
ALTER TABLE "director_priorities" ADD COLUMN IF NOT EXISTS "lessonIds" JSONB NOT NULL DEFAULT '[]';

-- Lessons already written as notes start adopted at 50
UPDATE "director_entries" SET "status" = 'ADOPTED', "confidence" = 50, "domain" = 'coworking'
WHERE "kind" = 'LESSON' AND "status" IS NULL;

-- First lessons: positioning (from the owner's video summary, 2026-11-18), one set per space
INSERT INTO "director_entries" ("id", "facilityId", "date", "kind", "corner", "text", "detail", "source", "status", "confidence", "domain", "origin", "history", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, f."id", DATE '2026-11-18', 'LESSON', s.corner, s.text, s.detail, 'APP', 'ADOPTED', s.confidence, '*', s.origin,
       jsonb_build_array(jsonb_build_object('date', '2026-11-18', 'change', 'Leçon de départ', 'why', 'Résumé « Positionnement » donné par le propriétaire')),
       (now() AT TIME ZONE 'UTC'), (now() AT TIME ZONE 'UTC')
FROM "facilities" f
CROSS JOIN (VALUES
  ('seed:positioning-1', 'marketing', 60,
   'Choisir le public avant le prix : le même produit au même prix paraît cher à un public et bon marché à un autre.',
   'Le client n’achète pas l’offre, il achète ce qu’elle lui apporte : le calme pour réviser, du temps gagné, un lieu pro, un problème réglé.'),
  ('seed:positioning-2', 'prix', 55,
   'Une offre qui se vend mal n’est pas forcément mauvaise : changer d’abord le public visé ou la phrase, une seule chose, avant une remise ou un nouveau produit.',
   'Quand ceux qui cliquent achètent mais que peu cliquent, c’est le message ou le public qui bloque, pas l’offre.'),
  ('seed:positioning-3', 'marketing', 55,
   'Une offre qui marche avec un public : la montrer à un public proche, avec un message pour lui, plutôt que la modifier.',
   'Ce qui plaît aux étudiants peut plaire aux freelances, dit dans leurs mots.')
) AS s(origin, corner, confidence, text, detail)
WHERE NOT EXISTS (SELECT 1 FROM "director_entries" e WHERE e."facilityId" = f."id" AND e."origin" = s.origin);
