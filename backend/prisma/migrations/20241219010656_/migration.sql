-- AlterTable
ALTER TABLE "members" ALTER COLUMN "deletedAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "deletedAt" DROP NOT NULL;
