-- Short code per check-in, shown as a QR on the visitor's session screen
-- (no 0/O/1/I/L so it can be typed at reception)
CREATE OR REPLACE FUNCTION gen_checkin_code() RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars))::INT + 1, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Volatile default: existing rows each get their own code
ALTER TABLE "journals" ADD COLUMN IF NOT EXISTS "checkInCode" TEXT NOT NULL DEFAULT gen_checkin_code();

CREATE INDEX IF NOT EXISTS "journals_checkInCode_idx" ON "journals"("checkInCode");
