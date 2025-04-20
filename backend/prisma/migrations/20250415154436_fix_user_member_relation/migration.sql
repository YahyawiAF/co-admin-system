/*
  Modified:
  - Kept existing members with NULL `userId`.
  - Skipped making `userId` non-nullable.
  - Still applies the foreign key (but allows NULLs).
*/

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_memberId_fkey";

-- NOTE: We're skipping this to avoid failing on existing NULLs:
-- ALTER TABLE "members" ALTER COLUMN "userId" SET NOT NULL;

-- AddForeignKey (nullable foreign key)
ALTER TABLE "members"
  ADD CONSTRAINT "members_userId_fkey"
  FOREIGN KEY ("userId")
  REFERENCES "users"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
