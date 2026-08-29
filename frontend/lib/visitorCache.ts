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
    const slug = org || getActiveOrg();
    if (!slug) return null;
    const raw = localStorage.getItem(cacheKey(slug));
    if (!raw) return null;
    return JSON.parse(raw) as VisitorCache;
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
  if (slug) {
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
