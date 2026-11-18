import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Phones / tablets go to /m unless the device was unlocked for admin. */
const MOBILE_UA =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i;

/**
 * Secret admin entry: opening /<ADMIN_ENTRY_KEY>/admin marks this device as an
 * admin device (cookie, 1 year). Without it, admin pages are hidden and every
 * device lands on /m. Changing the key locks out devices that only had the old link.
 * When ADMIN_ENTRY_KEY is not set, desktops stay free (old behaviour).
 */
const ADMIN_ENTRY_SUFFIX = "/admin";
const ADMIN_DEVICE_COOKIE = "admin_device";
const ONE_YEAR = 60 * 60 * 24 * 365;

async function sha256Hex(value: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ua = request.headers.get("user-agent") || "";
  const isMobile = MOBILE_UA.test(ua);
  const entryKey = process.env.ADMIN_ENTRY_KEY?.trim() || "";

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

  if (entryKey && pathname.replace(/\/+$/, "") === `/${entryKey}${ADMIN_ENTRY_SUFFIX}`) {
    const res = NextResponse.redirect(new URL("/login", request.url));
    res.cookies.set(ADMIN_DEVICE_COOKIE, await sha256Hex(entryKey), {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: ONE_YEAR,
    });
    return res;
  }

  const deviceCookie = request.cookies.get(ADMIN_DEVICE_COOKIE)?.value;
  const isAdminDevice =
    !!entryKey && !!deviceCookie && deviceCookie === (await sha256Hex(entryKey));

  if (isAdminDevice) {
    return NextResponse.next();
  }

  // No key configured: desktops stay free, phones go to /m (old behaviour).
  if (!entryKey && !isMobile) {
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
