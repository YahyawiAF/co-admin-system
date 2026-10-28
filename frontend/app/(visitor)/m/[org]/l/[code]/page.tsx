"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { eventsApi } from "@/lib/api/resources";
import { useOrg } from "@/lib/org";
import { firstOpenThisSession, rememberShareSource } from "@/lib/share-source";

/** Tracked share link (Story, WhatsApp…): counts the open, then goes to the event. */
export default function ShareLinkPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { href } = useOrg();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!code || started.current) return;
    started.current = true;
    const go = (targetId: string) => router.replace(href(`/events/${targetId}`));
    // Reload of the same link in this tab: don't count it twice
    const cached = (() => {
      try {
        return sessionStorage.getItem(`share-target:${code}`);
      } catch {
        return null;
      }
    })();
    if (cached && !firstOpenThisSession(code)) {
      go(cached);
      return;
    }
    eventsApi
      .openLink(code)
      .then((link) => {
        rememberShareSource(link.targetId, link.code);
        try {
          sessionStorage.setItem(`share-target:${code}`, link.targetId);
        } catch {
          // storage blocked: fine
        }
        firstOpenThisSession(code);
        go(link.targetId);
      })
      .catch(() => setFailed(true));
  }, [code, href, router]);

  if (failed) {
    return (
      <div className="advisor-in space-y-3 rounded-3xl bg-white p-6 text-center shadow-sm">
        <p className="font-semibold">Ce lien n&apos;existe plus.</p>
        <Link href={href("/events")} className="text-sm font-medium text-blue-700 underline">
          Voir les événements
        </Link>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center p-10 text-sm text-slate-500" aria-live="polite">
      Ouverture…
    </div>
  );
}

