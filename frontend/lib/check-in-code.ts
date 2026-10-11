/** Value encoded in the per-session QR (read by the admin scanner). */
export function checkInQrPayload(code: string) {
  return `CHECKIN:${code}`;
}

export function checkInQrImageUrl(code: string, size = 280) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(
    checkInQrPayload(code)
  )}`;
}

/** Accepts `CHECKIN:ABC123`, a typed code (spaces / dashes ignored) or text ending with it. */
export function parseCheckInCode(raw: string): string | null {
  const cleaned = (raw || "").trim().toUpperCase().replace(/[\s-]/g, "");
  const match = cleaned.match(/(?:CHECKIN[:=/])?([A-Z0-9]{6})$/);
  return match ? match[1] : null;
}

/** "ABC123" → "ABC 123" for reading aloud / typing. */
export function formatCheckInCode(code: string) {
  return code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}
