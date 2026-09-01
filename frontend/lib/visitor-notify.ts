const STORAGE_KEY = "visitor-notify-enabled";
const WARNED_KEY = "visitor-session-warned";

let audioCtx: AudioContext | null = null;
let unlocked = false;
let audioEl: HTMLAudioElement | null = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  return audioCtx;
}

/** Short beep as data-URI — more reliable on iOS than oscillators alone. */
function getAudioEl() {
  if (typeof window === "undefined") return null;
  if (!audioEl) {
    // tiny WAV beep (~0.15s)
    audioEl = new Audio(
      "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Onp2YjHx0cXR8h5Odm5WIenRvdH6JlZ+blYl8dW91fYmUn5uViXx1b3V9iZSfm5WJfHVvdX2JlJ+blYl8dW91fYmUn5uViXx1b3V9iZSfm5WJfHVvdX2JlJ+blYl8dW91fYmUn5uViXx1b3V9iZSfm5WJfHVvdX2JlJ+blYl8dW91fYmUn5uViXx1b3V9iZSfm5WJfHVvdX2JlJ+blYl8dW91fYmUn5uViXx1b3V9iZSfm5WJfHVvdX2JlJ+blYl8"
    );
    audioEl.preload = "auto";
  }
  return audioEl;
}

/** Call from a user gesture so iOS/Safari allow later beeps. */
export async function unlockVisitorAudio() {
  const ctx = getCtx();
  const el = getAudioEl();
  try {
    if (ctx && ctx.state === "suspended") await ctx.resume();
    if (el) {
      el.volume = 0.01;
      await el.play().catch(() => undefined);
      el.pause();
      el.currentTime = 0;
      el.volume = 1;
    }
    if (ctx) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.01);
    }
    unlocked = true;
  } catch {
    /* ignore */
  }
}

export function playNotifySound(kind: "ready" | "alert" | "message" = "alert") {
  const el = getAudioEl();
  if (el) {
    el.currentTime = 0;
    void el.play().catch(() => undefined);
  }

  const ctx = getCtx();
  if (!ctx) return;
  void ctx.resume().catch(() => undefined);

  const now = ctx.currentTime;
  const tones =
    kind === "ready"
      ? [880, 1175]
      : kind === "message"
        ? [660, 880]
        : [740, 520];

  tones.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02 + i * 0.12);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22 + i * 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + i * 0.12);
    osc.stop(now + 0.28 + i * 0.12);
  });
}

export function isNotifyOptIn(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "1";
}

export function setNotifyOptIn(on: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
}

export function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function isStandalonePwa() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registerServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  try {
    return await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
  } catch {
    return null;
  }
}

async function subscribePush(memberId: string): Promise<boolean> {
  if (!memberId || typeof window === "undefined") return false;
  if (!("PushManager" in window) || !("serviceWorker" in navigator)) return false;

  const vapid =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    (await fetchVapidKey());
  if (!vapid) {
    console.warn("[push] missing VAPID public key");
    return false;
  }

  const reg = await registerServiceWorker();
  if (!reg) {
    console.warn("[push] service worker registration failed");
    return false;
  }
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    // Re-post existing subscription so server always has it after redeploy
  } else {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      });
    } catch (e) {
      console.warn("[push] subscribe failed", e);
      return false;
    }
  }

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

  const api = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
  try {
    const res = await fetch(`${api}/mobile/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberId,
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        userAgent: navigator.userAgent,
      }),
    });
    if (!res.ok) {
      console.warn("[push] server subscribe failed", await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[push] network error", e);
    return false;
  }
}

export async function ensurePushSubscription(memberId?: string | null) {
  if (!memberId || !isNotifyOptIn()) return false;
  if (typeof Notification === "undefined") return false;
  if (Notification.permission !== "granted") return false;
  return subscribePush(memberId);
}

async function fetchVapidKey(): Promise<string | null> {
  try {
    const api = process.env.NEXT_PUBLIC_API_URL || "";
    const res = await fetch(`${api}/mobile/push/vapid-public-key`);
    if (!res.ok) return null;
    const data = (await res.json()) as { publicKey?: string | null };
    return data.publicKey || null;
  } catch {
    return null;
  }
}

export async function enableVisitorNotifications(
  memberId?: string | null
): Promise<{ ok: boolean; needInstall: boolean }> {
  await unlockVisitorAudio();
  setNotifyOptIn(true);

  const needInstall = isIosDevice() && !isStandalonePwa();

  if (typeof Notification === "undefined") {
    return { ok: unlocked, needInstall };
  }

  try {
    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") {
      return { ok: unlocked, needInstall };
    }
    if (memberId) {
      const pushed = await subscribePush(memberId);
      return { ok: pushed, needInstall };
    }
    return { ok: true, needInstall };
  } catch {
    return { ok: unlocked, needInstall };
  }
}

export type VisitorNotifyPayload = {
  title: string;
  body: string;
  tag?: string;
  sound?: "ready" | "alert" | "message";
};

export function showVisitorNotification(payload: VisitorNotifyPayload) {
  playNotifySound(payload.sound || "alert");
  try {
    navigator.vibrate?.([200, 80, 120, 80, 200]);
  } catch {
    /* ignore */
  }

  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(payload.title, {
      body: payload.body,
      tag: payload.tag || "visitor",
      icon: "/collabora-icon.svg",
      badge: "/collabora-icon.svg",
      requireInteraction: (payload.tag || "").startsWith("session-end"),
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* ignore */
  }
}

export function sessionWarnKey(sessionId: string) {
  return `${WARNED_KEY}:${sessionId}`;
}

export function hasSessionWarned(sessionId: string) {
  if (typeof window === "undefined") return true;
  return sessionStorage.getItem(sessionWarnKey(sessionId)) === "1";
}

export function markSessionWarned(sessionId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(sessionWarnKey(sessionId), "1");
}
