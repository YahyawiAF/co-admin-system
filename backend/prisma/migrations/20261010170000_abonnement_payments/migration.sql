-- CreateTable: each amount collected for an abonnement, dated (advance, remainder…)
CREATE TABLE IF NOT EXISTS "abonnement_payments" (
    "id" TEXT NOT NULL,
    "abonnementId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "abonnement_payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "abonnement_payments_paidAt_idx" ON "abonnement_payments"("paidAt");
CREATE INDEX IF NOT EXISTS "abonnement_payments_abonnementId_idx" ON "abonnement_payments"("abonnementId");

ALTER TABLE "abonnement_payments"
  ADD CONSTRAINT "abonnement_payments_abonnementId_fkey"
  FOREIGN KEY ("abonnementId") REFERENCES "abonnements"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing money received: one payment per abonnement, on the best known collection day
INSERT INTO "abonnement_payments" ("id", "abonnementId", "amount", "paidAt", "createdAt")
SELECT gen_random_uuid()::text, a."id", a."payedAmount",
       COALESCE(a."paidAt", a."createdAt", a."registredDate"), CURRENT_TIMESTAMP
FROM "abonnements" a
WHERE a."payedAmount" > 0
  AND NOT EXISTS (
    SELECT 1 FROM "abonnement_payments" p WHERE p."abonnementId" = a."id"
  );
