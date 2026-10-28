"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  isFreshScanTime,
  loadVisitorCache,
  markQrEntry,
} from "@/lib/visitorCache";
import { restoreVisitor } from "@/lib/visitor-remember";
import { qrCheckinHref, startFromQrEntry } from "@/lib/visitor-qr-checkin";

/**
 * First load (the scan): write the scan time into the URL as ?at=.
 * A reload brings it back: past 20 min it is iOS Safari reopening an old tab,
 * not a scan → null (open Accueil, no check-in).
 */
function scanTime(): number | null {
  const url = new URL(window.location.href);
  const stamped = Number(url.searchParams.get("at"));
  if (stamped) return isFreshScanTime(stamped) ? stamped : null;
  const now = Date.now();
  url.searchParams.set("at", String(now));
  window.history.replaceState(window.history.state, "", url.toString());
  return now;
}

/**
 * QR landing (iPhone Camera → Safari).
 * - Mark check-in intent (localStorage + ?checkin=<scan time>), unless this
 *   is a reload of a scan older than 20 min (see scanTime).
 * - If already known: start AUTO session here, then open /session
 *   (hard redirect — more reliable than router.replace on iOS).
 * - Else: Accueil with ?checkin=<scan time> so signup / home can start the session.
 */
export default function VisitorEntryPage() {
  const params = useParams<{ org: string }>();
  const slug = params.org;
  const [label, setLabel] = useState("Pointage…");

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    void (async () => {
      const at = scanTime();
      if (!at) {
        window.location.replace(`/m/${slug}`);
        return;
      }
      markQrEntry(slug);
      // Safari can wipe localStorage after 7 days: fall back to the long-lived cookie
      const memberId = loadVisitorCache(slug)?.memberId || (await restoreVisitor(slug));
      if (memberId) {
        try {
          await startFromQrEntry({
            org: slug,
            memberId,
            force: true,
          });
          if (cancelled) return;
          window.location.replace(`/m/${slug}/session`);
          return;
        } catch {
          if (cancelled) return;
          setLabel("Accueil…");
          window.location.replace(qrCheckinHref(slug, at));
          return;
        }
      }
      if (cancelled) return;
      setLabel("Accueil…");
      window.location.replace(qrCheckinHref(slug, at));
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <div className="mobile-shell mx-auto flex min-h-dvh max-w-[480px] items-center justify-center bg-[#f3f6fb] text-slate-500">
      {label}
    </div>
  );
}
