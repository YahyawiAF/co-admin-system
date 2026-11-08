-- Conseil IA: goal in DT, health-check area, lever, AI tool drafts, and tools linked to a solution
ALTER TABLE "business_initiatives" ADD COLUMN "goalAmount" DOUBLE PRECISION;
ALTER TABLE "business_initiatives" ADD COLUMN "area" TEXT;
ALTER TABLE "business_initiatives" ADD COLUMN "leverId" TEXT;
ALTER TABLE "business_initiatives" ADD COLUMN "tools" JSONB NOT NULL DEFAULT '[]';

CREATE TABLE "initiative_links" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "stepIndex" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "initiative_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "initiative_links_initiativeId_kind_targetId_key" ON "initiative_links"("initiativeId", "kind", "targetId");
CREATE INDEX "initiative_links_kind_targetId_idx" ON "initiative_links"("kind", "targetId");
ALTER TABLE "initiative_links" ADD CONSTRAINT "initiative_links_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "business_initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing single linked sale becomes a link row
INSERT INTO "initiative_links" ("id", "initiativeId", "kind", "targetId")
SELECT gen_random_uuid()::text, "id", "linkedKind", "linkedId" FROM "business_initiatives"
WHERE "linkedKind" IS NOT NULL AND "linkedId" IS NOT NULL
ON CONFLICT DO NOTHING;
