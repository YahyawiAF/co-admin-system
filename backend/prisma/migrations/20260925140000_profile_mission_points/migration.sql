-- Profile mission point events (details 800 + avatar 200)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'PointEvent' AND e.enumlabel = 'PROFILE_DETAILS'
  ) THEN
    ALTER TYPE "PointEvent" ADD VALUE 'PROFILE_DETAILS';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'PointEvent' AND e.enumlabel = 'PROFILE_AVATAR'
  ) THEN
    ALTER TYPE "PointEvent" ADD VALUE 'PROFILE_AVATAR';
  END IF;
END $$;
