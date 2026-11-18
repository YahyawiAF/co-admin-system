import { http } from "@/lib/api/httpClient";
import {
  playNotifySound,
  unlockVisitorAudio,
  urlBase64ToUint8Array,
} from "@/lib/visitor-notify";

/**
 * Admin alerts for new requests (café order, booking, visit, message):
 * sound + blinking tab title + system notification while the tab is hidden,
 * and Web Push so they still arrive with the admin tab closed.
 */

const SOUND_KEY = "admin-alerts-sound";
const PUSH_KEY = "admin-alerts-push";

export type AdminAlert = {
  title: string;
  body: string;
  /** Same tag as the server push → the OS shows one notification, not two. */
  tag: string;
  url: string;
};

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function isSoundOn() {
  return read(SOUND_KEY) !== "off";
}

export function setSoundOn(on: boolean) {
  write(SOUND_KEY, on ? "on" : "off");
  if (on) void unlockVisitorAudio();
}

export function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function isPushOn() {
  return (
    notificationsSupported() &&
    Notification.permission === "granted" &&
    read(PUSH_KEY) === "on"
  );
}

/* ───────────── tab title blink ───────────── */

let baseTitle = "";
let blinkTimer: ReturnType<typeof setInterval> | null = null;
let missed = 0;

function stopBlink() {
  if (blinkTimer) clearInterval(blinkTimer);
  blinkTimer = null;
  missed = 0;
  if (baseTitle) document.title = baseTitle;
}

function startBlink(label: string) {
  if (!blinkTimer) baseTitle = document.title;
  missed += 1;
  if (blinkTimer) clearInterval(blinkTimer);
  let flip = false;
  const alertTitle = () => `(${missed}) ${label}`;
  document.title = alertTitle();
  blinkTimer = setInterval(() => {
    flip = !flip;
    document.title = flip ? baseTitle : alertTitle();
  }, 1000);
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) stopBlink();
  });
}

/* ───────────── one alert ───────────── */

async function showSystemNotification(a: AdminAlert) {
  const options: NotificationOptions = {
    body: a.body,
    tag: a.tag,
    icon: "/collabora-icon.svg",
    badge: "/collabora-icon.svg",
    requireInteraction: true,
    data: { url: a.url },
  };
  try {
    const reg = await navigator.serviceWorker?.getRegistration("/");
    if (reg) {
      await reg.showNotification(a.title, options);
      return;
    }
  } catch {
    /* fall back below */
  }
  try {
    const n = new Notification(a.title, options);
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* ignore */
  }
}

export function fireAdminAlert(a: AdminAlert) {
  if (typeof window === "undefined") return;
  if (isSoundOn()) playNotifySound("alert");
  if (!document.hidden) return;
  startBlink(a.title);
  if (notificationsSupported() && Notification.permission === "granted") {
    void showSystemNotification(a);
  }
}

/* ───────────── push (tab closed) ───────────── */

async function registerSw() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
    await navigator.serviceWorker.ready;
    return reg;
  } catch {
    return null;
  }
}

/** Ask permission (needs a click), subscribe this browser for the current organization. */
export async function enableAdminPush(
  organizationId: string | null
): Promise<"ok" | "denied" | "unsupported" | "error"> {
  if (!notificationsSupported()) return "unsupported";
  void unlockVisitorAudio();
  const permission =
    Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;
  if (permission !== "granted") return "denied";
  write(PUSH_KEY, "on");
  const ok = await syncAdminPush(organizationId);
  return ok ? "ok" : "error";
}

/** Re-send this browser's subscription (after reload / org switch). Silent. */
export async function syncAdminPush(organizationId: string | null) {
  if (!organizationId || !isPushOn() || !("PushManager" in window)) return false;
  try {
    const { publicKey } = await http.get<{ publicKey: string | null }>(
      "/admin/push/vapid-public-key"
    );
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || publicKey;
    if (!key) return false;
    const reg = await registerSw();
    if (!reg) return false;
    const sub =
      (await reg.pushManager.getSubscription()) ||
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      }));
    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;
    await http.post("/admin/push/subscribe", {
      organizationId,
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      userAgent: navigator.userAgent,
    });
    return true;
  } catch {
    return false;
  }
}

/** Stop alerts on this browser (toggle off, or logout). Keeps the visitor push of the same browser. */
export async function disableAdminPush() {
  write(PUSH_KEY, "off");
  try {
    const reg = await navigator.serviceWorker?.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await http.post("/admin/push/unsubscribe", { endpoint: sub.endpoint });
  } catch {
    /* ignore */
  }
}
