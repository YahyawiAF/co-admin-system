import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Phones / tablets go to /m unless the device was unlocked for admin. */
const MOBILE_UA =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i;

/**
 * Secret admin entry, set in admin › Espace › Profil & QR › « Accès admin secret ».
 * Opening /<code>/admin marks this device as an admin device (cookie, 1 year).
 * Switch on: devices without it land on /m (admin hidden, phones and computers).
 * Switch off: old behaviour (computers free, phones → /m), unlocked phones still pass.
 * Changing the code locks out devices that only had the old link.
 */
const ADMIN_ENTRY_RE = /^\/([A-Za-z0-9_-]{6,40})\/admin\/?$/;
const ADMIN_DEVICE_COOKIE = "admin_device";
const ONE_YEAR = 60 * 60 * 24 * 365;
const GATE_CACHE_MS = 60_000;

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000").replace(/\/+$/, "");

type GateState = { hidden: boolean; allowed: boolean };
const gateCache = new Map<string, { at: number; state: GateState }>();

/** Asks the API (cached 1 min per device). API down → null: fall back to the old behaviour. */
async function gateState(device: string): Promise<GateState | null> {
  const hit = gateCache.get(device);
  if (hit && Date.now() - hit.at < GATE_CACHE_MS) return hit.state;
  try {
    const res = await fetch(
      `${API_URL}/organizations/admin-gate/check?device=${encodeURIComponent(device)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const state = (await res.json()) as GateState;
    if (gateCache.size > 500) gateCache.clear();
    gateCache.set(device, { at: Date.now(), state });
    return state;
  } catch {
    return null;
  }
}

async function verifyEntryKey(key: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${API_URL}/organizations/admin-gate/verify?key=${encodeURIComponent(key)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { valid: boolean; device?: string };
    return body.valid && body.device ? body.device : null;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ua = request.headers.get("user-agent") || "";
  const isMobile = MOBILE_UA.test(ua);

  // Service worker + PWA files must never redirect (closed-app push depends on /sw.js).
  if (
    pathname === "/sw.js" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/manifest.json" ||
    // visitor "remember this phone" cookie (called from /m pages)
    pathname === "/api/visitor-remember"
  ) {
    return NextResponse.next();
  }

  if (pathname === "/m" || pathname.startsWith("/m/")) {
    return NextResponse.next();
  }

  const entry = pathname.match(ADMIN_ENTRY_RE);
  if (entry) {
    const device = await verifyEntryKey(entry[1]);
    if (!device) {
      return NextResponse.redirect(new URL("/m", request.url));
    }
    gateCache.delete(device);
    const res = NextResponse.redirect(new URL("/login", request.url));
    res.cookies.set(ADMIN_DEVICE_COOKIE, device, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: ONE_YEAR,
    });
    return res;
  }

  const gate = await gateState(request.cookies.get(ADMIN_DEVICE_COOKIE)?.value || "");

  if (gate?.allowed) {
    return NextResponse.next();
  }

  // Switch off (or API unreachable): desktops stay free, phones go to /m.
  if (!gate?.hidden && !isMobile) {
    return NextResponse.next();
  }

  // Admin is hidden: anything outside /m → visitor app
  return NextResponse.redirect(new URL("/m", request.url));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|webmanifest|json)$).*)",
  ],
};
