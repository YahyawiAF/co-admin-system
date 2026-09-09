"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Sparkles, X } from "lucide-react";
import { useState } from "react";
import { eventsApi } from "@/lib/api/resources";
import { useOrg } from "@/lib/org";

const dismissKey = (id: string) => `announce-dismissed:${id}`;

/**
 * Announcement slot on Accueil — shows the next upcoming event
 * as a light dismissible banner. Renders nothing when there is
 * no announcement or it was dismissed this session.
 */
export function AnnouncementBanner() {
  const { slug, href } = useOrg();
  const [dismissed, setDismissed] = useState<string | null>(null);

  const { data: events } = useQuery({
    queryKey: ["mobile-events", slug, "upcoming"],
    queryFn: () => eventsApi.list(slug, "upcoming"),
    staleTime: 5 * 60_000,
  });

  const next = (events || [])[0];
  if (!next) return null;
  if (dismissed === next.id) return null;
  if (
    typeof window !== "undefined" &&
    sessionStorage.getItem(dismissKey(next.id)) === "1"
  ) {
    return null;
  }

  const dateLabel = next.startAt
    ? format(new Date(next.startAt), "d MMM", { locale: fr })
    : null;

  return (
    <div className="flex items-center gap-2.5 rounded-2xl bg-white px-3.5 py-2.5 shadow-sm">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
        <Sparkles className="h-4 w-4" />
      </span>
      <p className="min-w-0 flex-1 truncate text-sm">
        <span className="font-semibold text-slate-900">{next.title}</span>
        {dateLabel ? (
          <span className="text-slate-500"> · {dateLabel}</span>
        ) : null}{" "}
        <Link
          href={href(`/events/${next.id}`)}
          className="font-medium text-indigo-600"
        >
          Voir
        </Link>
      </p>
      <button
        type="button"
        aria-label="Fermer"
        className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-100"
        onClick={() => {
          try {
            sessionStorage.setItem(dismissKey(next.id), "1");
          } catch {
            /* ignore */
          }
          setDismissed(next.id);
        }}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
