const ORG_KEY = "visitor_org";

export type VisitorCache = {
  memberId: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  accessToken?: string;
  visitorNumber?: number | null;
  orgSlug?: string;
};

function requireOrg(org?: string | null): string {
  const slug = org || getActiveOrg();
  if (!slug) {
    throw new Error("Organization slug required for visitor session");
  }
  return slug;
}

function cacheKey(org: string) {
  return `collabora_visitor_cache_${org}`;
}

function sessionMemberKey(org: string) {
  return `memberId_${org}`;
}

function sessionTokenKey(org: string) {
  return `memberToken_${org}`;
}

function sessionPhoneKey(org: string) {
  return `memberPhone_${org}`;
}

function anonKey(org: string) {
  return `visitor_anon_id_${org}`;
}

function pendingKey(org: string) {
  return `visitor_pending_${org}`;
}

export function getActiveOrg(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(ORG_KEY);
}

export function setActiveOrg(slug: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(ORG_KEY, slug);
  } catch {
    /* storage blocked (private mode / in-app browser) */
  }
}

/** crypto.randomUUID is missing on older iOS/Android and in-app QR-scanner browsers. */
function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function ensureAnonId(org: string): string {
  if (typeof window === "undefined") return "";
  const key = anonKey(org);
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = randomId();
    localStorage.setItem(key, id);
    return id;
  } catch {
    return randomId();
  }
}

export function loadVisitorCache(org?: string): VisitorCache | null {
  if (typeof window === "undefined") return null;
  try {
    const slug = org || getActiveOrg();
    if (!slug) return null;
    const raw = localStorage.getItem(cacheKey(slug));
    if (!raw) return null;
    return JSON.parse(raw) as VisitorCache;
  } catch {
    return null;
  }
}

/**
 * Long-lived, server-set cookie that survives iPhone Safari's 7-day wipe of
 * localStorage (see app/api/visitor-remember/route.ts). Restore: lib/visitor-remember.ts.
 */
export const REMEMBER_URL = "/api/visitor-remember";

export function rememberVisitor(org: string, memberId: string) {
  if (typeof window === "undefined") return;
  try {
    void fetch(REMEMBER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org, memberId }),
      credentials: "same-origin",
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* ignore */
  }
}

export function forgetVisitor(org: string) {
  if (typeof window === "undefined") return;
  try {
    void fetch(`${REMEMBER_URL}?org=${encodeURIComponent(org)}`, {
      method: "DELETE",
      credentials: "same-origin",
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* ignore */
  }
}

export function saveVisitorCache(
  member: {
    id: string;
    phone?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    visitorNumber?: number | null;
  },
  accessToken?: string,
  org?: string
) {
  const slug = requireOrg(org);
  const data: VisitorCache = {
    memberId: member.id,
    phone: member.phone || undefined,
    firstName: member.firstName || undefined,
    lastName: member.lastName || undefined,
    visitorNumber: member.visitorNumber,
    accessToken,
    orgSlug: slug,
  };
  localStorage.setItem(cacheKey(slug), JSON.stringify(data));
  rememberVisitor(slug, member.id);
  sessionStorage.setItem(sessionMemberKey(slug), member.id);
  if (accessToken) sessionStorage.setItem(sessionTokenKey(slug), accessToken);
  if (member.phone) sessionStorage.setItem(sessionPhoneKey(slug), member.phone);
  // Clear legacy global keys that caused cross-org bleed
  sessionStorage.removeItem("memberId");
  sessionStorage.removeItem("memberToken");
  sessionStorage.removeItem("memberPhone");
  localStorage.removeItem("collabora_visitor_cache");
}

export function clearVisitorCache(org?: string) {
  if (typeof window === "undefined") return;
  const slug = org || getActiveOrg();
  const mid =
    (slug && sessionStorage.getItem(sessionMemberKey(slug))) ||
    sessionStorage.getItem("memberId");
  if (mid) {
    sessionStorage.removeItem(`accueil_routed_${mid}`);
  }
  if (slug) {
    forgetVisitor(slug);
    localStorage.removeItem(cacheKey(slug));
    sessionStorage.removeItem(sessionMemberKey(slug));
    sessionStorage.removeItem(sessionTokenKey(slug));
    sessionStorage.removeItem(sessionPhoneKey(slug));
    sessionStorage.removeItem(pendingKey(slug));
  }
  localStorage.removeItem("collabora_visitor_cache");
  sessionStorage.removeItem("memberId");
  sessionStorage.removeItem("memberToken");
  sessionStorage.removeItem("memberPhone");
}

export type PendingRegister = {
  member: {
    id: string;
    phone?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    visitorNumber?: number | null;
  };
  accessToken?: string;
  firstName: string;
  lastName: string;
  phone: string;
};

export function loadPendingRegister(org: string): PendingRegister | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(pendingKey(org));
    if (!raw) return null;
    return JSON.parse(raw) as PendingRegister;
  } catch {
    return null;
  }
}

export function savePendingRegister(org: string, data: PendingRegister) {
  sessionStorage.setItem(pendingKey(org), JSON.stringify(data));
}

export function clearPendingRegister(org: string) {
  sessionStorage.removeItem(pendingKey(org));
}

const installNudgeKey = (org: string, memberId: string) =>
  `visitor-install-nudge:${org}:${memberId}`;

export function markInstallNudgePending(org: string, memberId: string) {
  sessionStorage.setItem(installNudgeKey(org, memberId), "1");
}

export function peekInstallNudgePending(
  org: string,
  memberId: string
): boolean {
  return sessionStorage.getItem(installNudgeKey(org, memberId)) === "1";
}

export function clearInstallNudgePending(org: string, memberId: string) {
  sessionStorage.removeItem(installNudgeKey(org, memberId));
}

const installSkipKey = (org: string) => `visitor-install-skipped:${org}`;

export function hasSkippedInstall(org: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(installSkipKey(org)) === "1";
}

export function skipInstall(org: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(installSkipKey(org), "1");
}

const qrEntryKey = (org: string) => `visitor-qr-entry:${org}`;

/** Survives the sign-up step and a tab switch (camera app → browser / PWA). */
export const QR_ENTRY_TTL_MS = 20 * 60_000;

/**
 * A scan time (ms) from the URL is still a check-in only for 20 min.
 * iOS Safari reloads old tabs when reopened: without this a tab left on the
 * QR page checked the visitor in again the next morning.
 */
export function isFreshScanTime(at: number): boolean {
  if (!Number.isFinite(at) || at <= 0) return false;
  const age = Date.now() - at;
  return age > -60_000 && age < QR_ENTRY_TTL_MS;
}

export function markQrEntry(org: string) {
  try {
    localStorage.setItem(qrEntryKey(org), String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function hasRecentQrEntry(org: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const at = Number(localStorage.getItem(qrEntryKey(org)));
    return !!at && Date.now() - at < QR_ENTRY_TTL_MS;
  } catch {
    return false;
  }
}

export function clearQrEntry(org: string) {
  try {
    localStorage.removeItem(qrEntryKey(org));
  } catch {
    /* ignore */
  }
  // Used once: a later reload of this page must not check in again
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("checkin")) return;
    url.searchParams.delete("checkin");
    window.history.replaceState(window.history.state, "", url.toString());
  } catch {
    /* ignore */
  }
}

/** Fresh QR check-in → the session screen shows the reward + quote of the day once. */
const checkinRewardKey = (org: string) => `visitor-checkin-reward:${org}`;
const CHECKIN_REWARD_TTL_MS = 10 * 60_000;

export function markCheckinReward(org: string) {
  try {
    localStorage.setItem(checkinRewardKey(org), String(Date.now()));
  } catch {
    /* ignore */
  }
}
export function hasCheckinReward(org: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const at = Number(localStorage.getItem(checkinRewardKey(org)));
    return !!at && Date.now() - at < CHECKIN_REWARD_TTL_MS;
  } catch {
    return false;
  }
}
export function clearCheckinReward(org: string) {
  try {
    localStorage.removeItem(checkinRewardKey(org));
  } catch {
    /* ignore */
  }
}


/** "Pointer mon arrivée" tapped → the session screen opens the tarif modal once. */
const tarifPromptKey = (org: string) => `visitor-tarif-prompt:${org}`;

export function markTarifPrompt(org: string) {
  try {
    localStorage.setItem(tarifPromptKey(org), String(Date.now()));
  } catch {
    /* ignore */
  }
}
export function hasTarifPrompt(org: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const at = Number(localStorage.getItem(tarifPromptKey(org)));
    return !!at && Date.now() - at < CHECKIN_REWARD_TTL_MS;
  } catch {
    return false;
  }
}
export function clearTarifPrompt(org: string) {
  try {
    localStorage.removeItem(tarifPromptKey(org));
  } catch {
    /* ignore */
  }
}
