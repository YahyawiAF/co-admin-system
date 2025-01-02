/*
  Warnings:

  - Made the column `createdAt` on table `journals` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updatedAt` on table `journals` required. This step will fail if there are existing NULL values in that column.
  - Made the column `createdAt` on table `members` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updatedAt` on table `members` required. This step will fail if there are existing NULL values in that column.
  - Made the column `deletedAt` on table `members` required. This step will fail if there are existing NULL values in that column.
  - Made the column `createdAt` on table `reservations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updatedAt` on table `reservations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `createdAt` on table `users` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updatedAt` on table `users` required. This step will fail if there are existing NULL values in that column.
  - Made the column `deletedAt` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "journals" ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "members" ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "updatedAt" SET NOT NULL,
ALTER COLUMN "deletedAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "reservations" ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET NOT NULL,
ALTER COLUMN "deletedAt" SET NOT NULL;
