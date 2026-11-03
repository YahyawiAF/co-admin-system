-- CreateTable
CREATE TABLE "forecast_snapshots" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "passes" DOUBLE PRECISION NOT NULL,
    "products" DOUBLE PRECISION NOT NULL,
    "subscriptions" DOUBLE PRECISION NOT NULL,
    "variable" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "rules" JSONB NOT NULL,

    CONSTRAINT "forecast_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "forecast_snapshots_facilityId_year_month_key" ON "forecast_snapshots"("facilityId", "year", "month");

-- AddForeignKey
ALTER TABLE "forecast_snapshots" ADD CONSTRAINT "forecast_snapshots_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

