import { mobileApi, type MobileSession } from "@/lib/api/resources";
import {
  clearQrEntry,
  hasRecentQrEntry,
  markTarifPrompt,
} from "@/lib/visitorCache";

/**
 * After a QR scan (+ optional signup): open or create the AUTO session.
 * Clears the QR flag only when the API call succeeds so Accueil can retry.
 * `force` = caller already knows this is a check-in (entry page / ?checkin=1).
 */
export async function startFromQrEntry(opts: {
  org: string;
  memberId: string;
  force?: boolean;
}): Promise<MobileSession | null> {
  if (!opts.force && !hasRecentQrEntry(opts.org)) return null;
  const session = await mobileApi.startAutoSession(opts.memberId);
  if (
    session?.pricingMode === "AUTO" &&
    !session.alreadyOpen &&
    !session.resumed
  ) {
    markTarifPrompt(opts.org);
  }
  clearQrEntry(opts.org);
  return session;
}

/** QR intent from localStorage or from ?checkin=1 (survives iOS Safari quirks). */
export function wantsQrCheckin(org: string): boolean {
  if (typeof window === "undefined") return false;
  if (hasRecentQrEntry(org)) return true;
  try {
    return new URLSearchParams(window.location.search).get("checkin") === "1";
  } catch {
    return false;
  }
}
