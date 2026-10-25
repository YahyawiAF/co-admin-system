import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Profile QR shown by a visitor ("Mon QR"): reception picks a place, then scans it.
 * Payload `MEMBER:<memberId>.<expiresAtSeconds>.<signature>` — signed so it can't be
 * forged from a member id, and short-lived so a screenshot stops working.
 */
export const MEMBER_QR_PREFIX = 'MEMBER:';
export const MEMBER_QR_TTL_SECONDS = 15 * 60;

function secret() {
  return (
    process.env.MEMBER_QR_SECRET ||
    process.env.JWT_ACCESS_SECRET ||
    'member-qr-dev-secret'
  );
}

function sign(memberId: string, exp: number) {
  return createHmac('sha256', secret())
    .update(`${memberId}.${exp}`)
    .digest('base64url')
    .slice(0, 22);
}

export function issueMemberQr(memberId: string, now = Date.now()) {
  const exp = Math.floor(now / 1000) + MEMBER_QR_TTL_SECONDS;
  return {
    payload: `${MEMBER_QR_PREFIX}${memberId}.${exp}.${sign(memberId, exp)}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

export function isMemberQr(raw: string) {
  return (raw || '').trim().toUpperCase().startsWith(MEMBER_QR_PREFIX);
}

export type MemberQrCheck =
  | { ok: true; memberId: string }
  | { ok: false; reason: 'invalid' | 'expired' };

export function verifyMemberQr(raw: string, now = Date.now()): MemberQrCheck {
  const body = (raw || '').trim().slice(MEMBER_QR_PREFIX.length);
  const [memberId, expRaw, sig] = body.split('.');
  const exp = Number(expRaw);
  if (!memberId || !Number.isFinite(exp) || !sig) {
    return { ok: false, reason: 'invalid' };
  }
  const expected = Buffer.from(sign(memberId, exp));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return { ok: false, reason: 'invalid' };
  }
  if (exp * 1000 < now) return { ok: false, reason: 'expired' };
  return { ok: true, memberId };
}
