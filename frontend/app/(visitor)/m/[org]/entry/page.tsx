"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { loadVisitorCache, markQrEntry } from "@/lib/visitorCache";
import { startFromQrEntry } from "@/lib/visitor-qr-checkin";

/**
 * QR landing (iPhone Camera → Safari).
 * - Always mark check-in intent (localStorage + ?checkin=1).
 * - If already known: start AUTO session here, then open /session
 *   (hard redirect — more reliable than router.replace on iOS).
 * - Else: Accueil with ?checkin=1 so signup / home can start the session.
 */
export default function VisitorEntryPage() {
  const params = useParams<{ org: string }>();
  const slug = params.org;
  const [label, setLabel] = useState("Pointage…");

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    void (async () => {
      markQrEntry(slug);
      const cache = loadVisitorCache(slug);
      if (cache?.memberId) {
        try {
          await startFromQrEntry({
            org: slug,
            memberId: cache.memberId,
            force: true,
          });
          if (cancelled) return;
          window.location.replace(`/m/${slug}/session`);
          return;
        } catch {
          if (cancelled) return;
          setLabel("Accueil…");
          window.location.replace(`/m/${slug}?checkin=1`);
          return;
        }
      }
      if (cancelled) return;
      setLabel("Accueil…");
      window.location.replace(`/m/${slug}?checkin=1`);
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
