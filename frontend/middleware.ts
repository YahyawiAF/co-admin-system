import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Phones / tablets only — keep visitors on /m. Desktop stays free (/login, /dashboard, /m…). */
const MOBILE_UA =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ua = request.headers.get("user-agent") || "";
  const isMobile = MOBILE_UA.test(ua);

  // Service worker + PWA files must never redirect (closed-app push depends on /sw.js).
  if (
    pathname === "/sw.js" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/manifest.json"
  ) {
    return NextResponse.next();
  }

  if (!isMobile) {
    return NextResponse.next();
  }

  // Mobile: anything outside /m → visitor app
  if (!pathname.startsWith("/m")) {
    return NextResponse.redirect(new URL("/m", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|webmanifest|json)$).*)",
  ],
};
