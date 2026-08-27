const LEGACY_CACHE_KEY = "collabora_visitor_cache";
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

function cacheKey(org?: string) {
  const slug = org || getActiveOrg();
  return slug ? `collabora_visitor_cache_${slug}` : LEGACY_CACHE_KEY;
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
  sessionStorage.setItem(ORG_KEY, slug);
}

export function ensureAnonId(org: string): string {
  if (typeof window === "undefined") return "";
  const key = anonKey(org);
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(key, id);
  return id;
}

export function loadVisitorCache(org?: string): VisitorCache | null {
  if (typeof window === "undefined") return null;
  try {
    const key = cacheKey(org);
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as VisitorCache;
    if (org) {
      const legacy = localStorage.getItem(LEGACY_CACHE_KEY);
      if (legacy) {
        const data = JSON.parse(legacy) as VisitorCache;
        saveVisitorCache(
          {
            id: data.memberId,
            phone: data.phone,
            firstName: data.firstName,
            lastName: data.lastName,
            visitorNumber: data.visitorNumber,
          },
          data.accessToken,
          org
        );
        return loadVisitorCache(org);
      }
    }
    return null;
  } catch {
    return null;
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
  const slug = org || getActiveOrg() || undefined;
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
  sessionStorage.setItem("memberId", member.id);
  if (accessToken) sessionStorage.setItem("memberToken", accessToken);
  if (member.phone) sessionStorage.setItem("memberPhone", member.phone);
}

export function clearVisitorCache(org?: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(cacheKey(org));
  localStorage.removeItem(LEGACY_CACHE_KEY);
  sessionStorage.removeItem("memberId");
  sessionStorage.removeItem("memberToken");
  sessionStorage.removeItem("memberPhone");
  const slug = org || getActiveOrg();
  if (slug) sessionStorage.removeItem(pendingKey(slug));
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
