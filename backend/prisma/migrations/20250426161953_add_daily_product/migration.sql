-- CreateTable
CREATE TABLE "DailyProduct" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyProduct_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DailyProduct" ADD CONSTRAINT "DailyProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
