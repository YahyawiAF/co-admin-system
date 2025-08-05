-- AlterTable
ALTER TABLE "users" ADD COLUMN     "resetPasswordCode" TEXT,
ADD COLUMN     "resetPasswordCodeExpires" TIMESTAMP(6);
