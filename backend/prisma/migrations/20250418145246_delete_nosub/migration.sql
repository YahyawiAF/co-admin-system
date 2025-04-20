/*
  Warnings:

  - The values [NOPSubs] on the enum `Subscription` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Subscription_new" AS ENUM ('Journal', 'Membership');
ALTER TABLE "members" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TABLE "members" ALTER COLUMN "plan" TYPE "Subscription_new" USING ("plan"::text::"Subscription_new");
ALTER TYPE "Subscription" RENAME TO "Subscription_old";
ALTER TYPE "Subscription_new" RENAME TO "Subscription";
DROP TYPE "Subscription_old";
ALTER TABLE "members" ALTER COLUMN "plan" SET DEFAULT 'Journal';
COMMIT;

-- AlterTable
ALTER TABLE "members" ALTER COLUMN "plan" SET DEFAULT 'Journal';
