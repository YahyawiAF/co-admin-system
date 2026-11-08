-- CreateEnum
CREATE TYPE "StockItemKind" AS ENUM ('INGREDIENT', 'UNIT');

-- CreateTable
CREATE TABLE "stock_items" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'pc',
    "kind" "StockItemKind" NOT NULL DEFAULT 'INGREDIENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_recipe_lines" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "product_recipe_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_purchases" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'CAISSE',
    "note" TEXT,
    "dailyExpenseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_lots" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustments" (
    "id" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quantity" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_items_organizationId_idx" ON "stock_items"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "product_recipe_lines_productId_stockItemId_key" ON "product_recipe_lines"("productId", "stockItemId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_purchases_dailyExpenseId_key" ON "stock_purchases"("dailyExpenseId");

-- CreateIndex
CREATE INDEX "stock_purchases_organizationId_date_idx" ON "stock_purchases"("organizationId", "date");

-- CreateIndex
CREATE INDEX "stock_lots_stockItemId_idx" ON "stock_lots"("stockItemId");

-- CreateIndex
CREATE INDEX "stock_adjustments_stockItemId_date_idx" ON "stock_adjustments"("stockItemId", "date");

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_recipe_lines" ADD CONSTRAINT "product_recipe_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_recipe_lines" ADD CONSTRAINT "product_recipe_lines_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "stock_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_purchases" ADD CONSTRAINT "stock_purchases_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_purchases" ADD CONSTRAINT "stock_purchases_dailyExpenseId_fkey" FOREIGN KEY ("dailyExpenseId") REFERENCES "DailyExpense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lots_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "stock_purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lots_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "stock_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "stock_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

