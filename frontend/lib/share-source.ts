/**
 * Which tracked share link brought a visitor to an event (Story, WhatsApp…).
 * Kept a week in the browser so a sign-up in between still counts the link.
 */
const KEY = "share-source:";
const WEEK_MS = 7 * 24 * 3600 * 1000;

export function rememberShareSource(targetId: string, code: string) {
  try {
    localStorage.setItem(KEY + targetId, JSON.stringify({ code, at: Date.now() }));
  } catch {
    // Private mode / storage blocked: the open is still counted, only the sign-up link is lost
  }
}

export function readShareSource(targetId: string): string | undefined {
  try {
    const raw = localStorage.getItem(KEY + targetId);
    if (!raw) return undefined;
    const v = JSON.parse(raw) as { code?: string; at?: number };
    if (!v.code || !v.at || Date.now() - v.at > WEEK_MS) return undefined;
    return v.code;
  } catch {
    return undefined;
  }
}

/** One count per browser session, even if the page reloads. */
export function firstOpenThisSession(code: string) {
  try {
    const k = `share-open:${code}`;
    if (sessionStorage.getItem(k)) return false;
    sessionStorage.setItem(k, "1");
    return true;
  } catch {
    return true;
  }
}
