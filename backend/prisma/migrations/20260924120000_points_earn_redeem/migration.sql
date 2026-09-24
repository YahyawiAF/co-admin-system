-- Extend PointEvent for earn-by-spend + redeem
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'PointEvent' AND e.enumlabel = 'PRODUCT_PAID'
  ) THEN
    ALTER TYPE "PointEvent" ADD VALUE 'PRODUCT_PAID';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'PointEvent' AND e.enumlabel = 'ADMIN_ADJUST'
  ) THEN
    ALTER TYPE "PointEvent" ADD VALUE 'ADMIN_ADJUST';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'PointEvent' AND e.enumlabel = 'REDEEM_VISIT'
  ) THEN
    ALTER TYPE "PointEvent" ADD VALUE 'REDEEM_VISIT';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'PointEvent' AND e.enumlabel = 'REDEEM_ORDER'
  ) THEN
    ALTER TYPE "PointEvent" ADD VALUE 'REDEEM_ORDER';
  END IF;
END $$;
