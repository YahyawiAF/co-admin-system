-- Promotions on several products, or on the whole café
ALTER TABLE "promotions" ADD COLUMN "productIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "promotions" ADD COLUMN "allProducts" BOOLEAN NOT NULL DEFAULT false;

-- A gift voucher can cover any product of its promotion
ALTER TABLE "promotion_vouchers" ALTER COLUMN "productId" DROP NOT NULL;
