/*
  Warnings:

  - You are about to drop the column `adminId` on the `responses` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "responses" DROP CONSTRAINT "responses_adminId_fkey";

-- AlterTable
ALTER TABLE "responses" DROP COLUMN "adminId";
