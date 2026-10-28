/**
 * Browser side of Learn & Share attribution. The server keeps the real record
 * (first touch per browser); this only remembers what to send it again.
 * Every storage call is guarded: Instagram's browser and private mode may refuse storage.
 */

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
export type CampaignParams = Partial<Record<(typeof UTM_KEYS)[number] | "c", string>>;

const DAY = 24 * 3600 * 1000;
/** Client-side memory only; the server applies the survey's own window. */
const KEEP_DAYS = 90;

function get(store: "local" | "session", key: string): string | null {
  try {
    return (store === "local" ? localStorage : sessionStorage).getItem(key);
  } catch {
    return null;
  }
}
function set(store: "local" | "session", key: string, value: string) {
  try {
    (store === "local" ? localStorage : sessionStorage).setItem(key, value);
  } catch {
    // storage blocked: the server still has the visit
  }
}
function del(store: "local" | "session", key: string) {
  try {
    (store === "local" ? localStorage : sessionStorage).removeItem(key);
  } catch {
    // ignore
  }
}

function randomKey() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

let memoryKey: string | null = null;

/** Random id for this browser and organization (no fingerprinting). */
export function visitorKey(org: string): string {
  const k = `ls_vk:${org}`;
  const stored = get("local", k) || get("session", k) || memoryKey;
  if (stored) return stored;
  const fresh = randomKey();
  memoryKey = fresh;
  set("local", k, fresh);
  set("session", k, fresh);
  return fresh;
}

/** Campaign values in the URL, or the ones remembered from an earlier visit. */
export function campaignParams(org: string, slug: string, search: URLSearchParams): CampaignParams {
  const fromUrl: CampaignParams = {};
  const c = search.get("c");
  if (c) fromUrl.c = c.slice(0, 32);
  for (const k of UTM_KEYS) {
    const v = search.get(k);
    if (v) fromUrl[k] = v.slice(0, 100);
  }
  const key = `ls_attr:${org}:${slug}`;
  if (Object.keys(fromUrl).length) {
    set("local", key, JSON.stringify({ at: Date.now(), p: fromUrl }));
    return fromUrl;
  }
  try {
    const raw = get("local", key);
    if (!raw) return {};
    const v = JSON.parse(raw) as { at?: number; p?: CampaignParams };
    if (!v.at || Date.now() - v.at > KEEP_DAYS * DAY) return {};
    return v.p || {};
  } catch {
    return {};
  }
}

/** One click per browser session for a tracked link, even if the page reloads. */
export function firstOpen(code: string | undefined): boolean {
  if (!code) return false;
  const k = `ls_open:${code}`;
  if (get("session", k)) return false;
  set("session", k, "1");
  return true;
}

/** Key for one submit attempt; kept until the server confirms, so retries are not counted twice. */
export function idempotencyKey(org: string, slug: string): string {
  const k = `ls_idem:${org}:${slug}`;
  const stored = get("session", k);
  if (stored) return stored;
  const fresh = randomKey();
  set("session", k, fresh);
  return fresh;
}
export function clearIdempotencyKey(org: string, slug: string) {
  del("session", `ls_idem:${org}:${slug}`);
}

export type SurveyDraft = {
  answers: Record<string, string | string[]>;
  name: string;
  phone: string;
  consent: boolean;
  step: number;
  startedAt: number;
};
export function readDraft(org: string, slug: string): SurveyDraft | null {
  try {
    const raw = get("session", `ls_draft:${org}:${slug}`);
    return raw ? (JSON.parse(raw) as SurveyDraft) : null;
  } catch {
    return null;
  }
}
export function saveDraft(org: string, slug: string, d: SurveyDraft) {
  set("session", `ls_draft:${org}:${slug}`, JSON.stringify(d));
}
export function clearDraft(org: string, slug: string) {
  del("session", `ls_draft:${org}:${slug}`);
}

/** Last answer sent from this browser: lets a later session sign-up link it to the person. */
export function rememberResponse(org: string, slug: string, responseId: string) {
  set("local", `ls_last:${org}`, JSON.stringify({ responseId, visitorKey: visitorKey(org), at: Date.now() }));
  set("local", `ls_done:${org}:${slug}`, String(Date.now()));
}
export function lastResponse(org: string): { responseId: string; visitorKey: string } | null {
  try {
    const raw = get("local", `ls_last:${org}`);
    if (!raw) return null;
    const v = JSON.parse(raw) as { responseId?: string; visitorKey?: string; at?: number };
    if (!v.responseId || !v.visitorKey || !v.at || Date.now() - v.at > KEEP_DAYS * DAY) return null;
    return { responseId: v.responseId, visitorKey: v.visitorKey };
  } catch {
    return null;
  }
}
export function answeredAt(org: string, slug: string): number | null {
  const v = Number(get("local", `ls_done:${org}:${slug}`));
  return Number.isFinite(v) && v > 0 ? v : null;
}
