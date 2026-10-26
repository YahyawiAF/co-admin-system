import { NextResponse, type NextRequest } from "next/server";

/**
 * "Remember this phone" for the visitor app.
 *
 * iPhone Safari wipes localStorage after 7 days without a visit, and the
 * home-screen app has its own storage — so a QR scan (always opened in Safari)
 * often found no visitor and asked to log in again. A cookie set by the server
 * (HttpOnly) is not wiped by that rule, so the scan can restore the visitor.
 *
 * The cookie only holds the member id, which the visitor app already keeps in
 * localStorage and uses for its API calls.
 */

const MAX_AGE = 400 * 24 * 60 * 60; // browsers cap cookie lifetime at 400 days
const ORG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/i;
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const cookieName = (org: string) => `cv_${org.toLowerCase()}`;

function orgFrom(req: NextRequest, body?: { org?: unknown }) {
  const org = String(body?.org ?? req.nextUrl.searchParams.get("org") ?? "");
  return ORG_RE.test(org) ? org : null;
}

export async function GET(req: NextRequest) {
  const org = orgFrom(req);
  if (!org) return NextResponse.json({ memberId: null }, { status: 400 });
  const id = req.cookies.get(cookieName(org))?.value || null;
  return NextResponse.json(
    { memberId: id && ID_RE.test(id) ? id : null },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { org?: unknown; memberId?: unknown };
  const org = orgFrom(req, body);
  const memberId = String(body.memberId ?? "");
  if (!org || !ID_RE.test(memberId)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookieName(org), memberId, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https",
    path: "/",
    maxAge: MAX_AGE,
  });
  return res;
}

export async function DELETE(req: NextRequest) {
  const org = orgFrom(req);
  if (!org) return NextResponse.json({ ok: false }, { status: 400 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookieName(org), "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
