const STORAGE_KEY = "visitor-notify-enabled";
const WARNED_KEY = "visitor-session-warned";

let audioCtx: AudioContext | null = null;
let unlocked = false;

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

/** Call from a user gesture so iOS/Safari allow later beeps. */
export async function unlockVisitorAudio() {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") await ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.01);
    unlocked = true;
  } catch {
    /* ignore */
  }
}

export function playNotifySound(kind: "ready" | "alert" | "message" = "alert") {
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

export async function enableVisitorNotifications(): Promise<boolean> {
  await unlockVisitorAudio();
  setNotifyOptIn(true);
  if (typeof Notification === "undefined") return unlocked;
  try {
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return unlocked;
    const p = await Notification.requestPermission();
    return p === "granted" || unlocked;
  } catch {
    return unlocked;
  }
}

export type VisitorNotifyPayload = {
  title: string;
  body: string;
  tag?: string;
  sound?: "ready" | "alert" | "message";
};

export function showVisitorNotification(payload: VisitorNotifyPayload) {
  if (!isNotifyOptIn() && typeof Notification !== "undefined") {
    // Still play sound if previously unlocked; popup only when allowed
  }
  playNotifySound(payload.sound || "alert");

  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(payload.title, {
      body: payload.body,
      tag: payload.tag || "visitor",
      icon: "/collabora-icon.svg",
      badge: "/collabora-icon.svg",
      renotify: true,
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
