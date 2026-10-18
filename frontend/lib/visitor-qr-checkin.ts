import { mobileApi, type MobileSession } from "@/lib/api/resources";
import {
  clearQrEntry,
  hasRecentQrEntry,
  markTarifPrompt,
} from "@/lib/visitorCache";

/**
 * After a QR scan (+ optional signup): open or create the AUTO session.
 * Clears the QR flag only when the API call succeeds so Accueil can retry.
 */
export async function startFromQrEntry(opts: {
  org: string;
  memberId: string;
}): Promise<MobileSession | null> {
  if (!hasRecentQrEntry(opts.org)) return null;
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
