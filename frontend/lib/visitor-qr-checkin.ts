import { mobileApi, type MobileSession } from "@/lib/api/resources";
import {
  clearQrEntry,
  hasRecentQrEntry,
  isFreshScanTime,
  markCheckinReward,
} from "@/lib/visitorCache";

/**
 * After a QR scan (+ optional signup): open or create the AUTO session.
 * AUTO is the default tarif: nothing to pick, the price follows the time spent.
 * Clears the QR flag only when the API call succeeds so Accueil can retry.
 * `force` = caller already knows this is a check-in (entry page / ?checkin=<scan time>).
 */
/**
 * One start per member at a time: right after signup both the signup form and
 * Accueil react to the QR flag — without this they created two sessions.
 */
const inFlight = new Map<string, Promise<MobileSession | null>>();

export function startFromQrEntry(opts: {
  org: string;
  memberId: string;
  force?: boolean;
}): Promise<MobileSession | null> {
  if (!opts.force && !hasRecentQrEntry(opts.org)) return Promise.resolve(null);
  const running = inFlight.get(opts.memberId);
  if (running) return running;
  const job = (async () => {
    const session = await mobileApi.startAutoSession(opts.memberId);
    if (session && !session.alreadyOpen && !session.resumed) {
      markCheckinReward(opts.org);
    }
    clearQrEntry(opts.org);
    return session;
  })().finally(() => {
    inFlight.delete(opts.memberId);
  });
  inFlight.set(opts.memberId, job);
  return job;
}

/**
 * QR intent from localStorage or from ?checkin=<scan time> (survives iOS Safari
 * quirks). The scan time expires after 20 min, so a tab Safari reloads hours
 * later is not a new check-in (old `?checkin=1` links are ignored for the same reason).
 */
export function wantsQrCheckin(org: string): boolean {
  if (typeof window === "undefined") return false;
  if (hasRecentQrEntry(org)) return true;
  try {
    const at = Number(new URLSearchParams(window.location.search).get("checkin"));
    return isFreshScanTime(at);
  } catch {
    return false;
  }
}

/** Accueil URL that carries the scan time as check-in intent. */
export function qrCheckinHref(org: string, at: number): string {
  return `/m/${org}?checkin=${at}`;
}
