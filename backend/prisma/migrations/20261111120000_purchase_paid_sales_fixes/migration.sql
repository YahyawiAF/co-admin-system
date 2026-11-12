-- Purchases bought on credit, supplier name
ALTER TABLE "stock_purchases" ADD COLUMN "supplier" TEXT;
ALTER TABLE "stock_purchases" ADD COLUMN "paid" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "stock_purchases" ADD COLUMN "paidAt" TIMESTAMP(3);

-- Reason of an inventory count correction
ALTER TABLE "stock_adjustments" ADD COLUMN "reason" TEXT;

-- Sales added or corrected later
ALTER TABLE "DailyProduct" ADD COLUMN "editedAt" TIMESTAMP(3);
