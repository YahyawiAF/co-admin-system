import { mobileApi } from "@/lib/api/resources";
import { REMEMBER_URL, forgetVisitor, saveVisitorCache } from "@/lib/visitorCache";

const inFlight = new Map<string, Promise<string | null>>();

/**
 * No visitor in localStorage: ask the cookie, check the member still exists,
 * and put them back in the local cache. Resolves to the member id or null.
 * Never takes longer than `timeoutMs` (the page must not hang on "Chargement…").
 */
export function restoreVisitor(org: string, timeoutMs = 2500): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const running = inFlight.get(org);
  if (running) return running;
  const job = (async () => {
    const res = await fetch(`${REMEMBER_URL}?org=${encodeURIComponent(org)}`, {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const { memberId } = (await res.json()) as { memberId: string | null };
    if (!memberId) return null;
    const status = await mobileApi.status(memberId).catch(() => null);
    const m = status?.member;
    if (!m?.id) {
      forgetVisitor(org);
      return null;
    }
    saveVisitorCache(
      { id: m.id, phone: m.phone, firstName: m.firstName, lastName: m.lastName, visitorNumber: m.visitorNumber },
      undefined,
      org
    );
    return m.id;
  })().catch(() => null);
  const timed = Promise.race([
    job,
    new Promise<null>((r) => setTimeout(() => r(null), timeoutMs)),
  ]).finally(() => inFlight.delete(org));
  inFlight.set(org, timed);
  return timed;
}
