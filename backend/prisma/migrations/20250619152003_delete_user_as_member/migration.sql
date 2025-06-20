/*
  Warnings:

  - The values [MEMBER] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - The `userId` column on the `members` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `memeberID` on the `users` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'USER');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'USER';
COMMIT;

-- DropForeignKey
ALTER TABLE "members" DROP CONSTRAINT "members_userId_fkey";

-- DropIndex
DROP INDEX "members_userId_key";

-- DropIndex
DROP INDEX "users_memeberID_key";

-- AlterTable
ALTER TABLE "members" DROP COLUMN "userId",
ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "memeberID";
