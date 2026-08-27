import { MobileMember } from "src/api/mobile.repo";

const CACHE_KEY = "collabora_visitor_cache";

export type VisitorCache = {
  memberId: string;
  visitorNumber: number | null;
  phone: string | null;
  firstName: string | null;
  isSubscribed: boolean;
  accessToken?: string;
};

export function saveVisitorCache(
  member: MobileMember & {
    visitorNumber?: number | null;
    isSubscribed?: boolean;
  },
  accessToken?: string
) {
  if (typeof window === "undefined") return;
  const payload: VisitorCache = {
    memberId: member.id,
    visitorNumber: member.visitorNumber ?? null,
    phone: member.phone ?? null,
    firstName: member.firstName ?? null,
    isSubscribed: !!member.isSubscribed,
    accessToken,
  };
  localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  sessionStorage.setItem("memberId", member.id);
  if (accessToken) sessionStorage.setItem("memberToken", accessToken);
  if (member.phone) sessionStorage.setItem("memberPhone", member.phone);
  if (member.visitorNumber != null) {
    sessionStorage.setItem("visitorNumber", String(member.visitorNumber));
  }
}

export function loadVisitorCache(): VisitorCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as VisitorCache;
  } catch {
    return null;
  }
}

export function clearVisitorCache() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CACHE_KEY);
}
