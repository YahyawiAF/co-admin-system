-- AlterTable: focus of the day + attendance share opt-in
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "todayFocus" VARCHAR(120);
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "todayFocusAt" TIMESTAMP(3);
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "shareAttendance" BOOLEAN NOT NULL DEFAULT false;
