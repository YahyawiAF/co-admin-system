const PREFIX = "ch_cache_v1:";

type Envelope<T> = {
  savedAt: number;
  data: T;
};

function key(name: string, id?: string | null) {
  return `${PREFIX}${name}${id ? `:${id}` : ""}`;
}

export function readLocalCache<T>(name: string, id?: string | null): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key(name, id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Envelope<T>;
    return parsed?.data ?? null;
  } catch {
    return null;
  }
}

export function writeLocalCache<T>(
  name: string,
  data: T,
  id?: string | null
) {
  if (typeof window === "undefined") return;
  try {
    const envelope: Envelope<T> = { savedAt: Date.now(), data };
    localStorage.setItem(key(name, id), JSON.stringify(envelope));
  } catch {
    /* quota / private mode */
  }
}

export function clearLocalCache(name: string, id?: string | null) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key(name, id));
}

export function readLocalCacheMeta(name: string, id?: string | null) {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key(name, id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Envelope<unknown>;
    return { savedAt: parsed.savedAt };
  } catch {
    return null;
  }
}
