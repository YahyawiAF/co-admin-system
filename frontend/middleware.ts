import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Phones / tablets only — keep visitors on /m. Desktop stays free (/login, /dashboard, /m…). */
const MOBILE_UA =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ua = request.headers.get("user-agent") || "";
  const isMobile = MOBILE_UA.test(ua);

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
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
