-- Conseil IA is replaced by the Directeur: every action tried through it becomes a memory note,
-- so the brain keeps what was tried and what the owner thought. The initiatives table stays.
INSERT INTO "director_entries" ("id", "facilityId", "date", "kind", "corner", "text", "detail", "source", "origin", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  i."facilityId",
  (i."startDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Tunis')::date,
  'TEST',
  CASE i."category"
    WHEN 'ACQUISITION' THEN 'marketing'
    WHEN 'NEW_REVENUE' THEN 'revenus'
    WHEN 'PROMO' THEN 'creux'
    WHEN 'PRICING' THEN 'prix'
    WHEN 'CAFE' THEN 'cafe'
    WHEN 'RETENTION' THEN 'abos'
    ELSE 'couts'
  END,
  left('Action testée : ' || i."title", 300),
  left(concat_ws(' · ',
    CASE
      WHEN i."droppedAt" IS NOT NULL THEN 'Abandonnée' || coalesce(' (' || i."dropReason" || ')', '')
      WHEN i."endDate" IS NOT NULL THEN 'Du ' || to_char(i."startDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Tunis', 'DD/MM/YYYY') || ' au ' || to_char(i."endDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Tunis', 'DD/MM/YYYY')
      ELSE 'Depuis le ' || to_char(i."startDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Tunis', 'DD/MM/YYYY')
    END,
    CASE i."ownerVerdict"
      WHEN 'WORKING' THEN 'Avis : ça marche'
      WHEN 'MIXED' THEN 'Avis : mitigé'
      WHEN 'NOT_WORKING' THEN 'Avis : pas d’effet'
      ELSE NULL
    END,
    nullif(i."description", ''),
    nullif((SELECT string_agg(n->>'text', ' / ') FROM jsonb_array_elements(CASE WHEN jsonb_typeof(i."notes") = 'array' THEN i."notes" ELSE '[]'::jsonb END) n), '')
  ), 500),
  'APP',
  'conseil:' || i."id",
  (now() AT TIME ZONE 'UTC'),
  (now() AT TIME ZONE 'UTC')
FROM "business_initiatives" i
WHERE NOT EXISTS (SELECT 1 FROM "director_entries" e WHERE e."origin" = 'conseil:' || i."id");
