"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  CalendarDays,
  ChevronRight,
  Clock,
  MapPin,
  Mic,
  Sparkles,
  Users,
} from "lucide-react";
import { eventsApi } from "@/lib/api/resources";
import { useOrg } from "@/lib/org";
import { cn } from "@/lib/utils";
import type { EventKind, SpaceEvent } from "@/lib/types";

export const EVENT_KIND_LABEL: Record<EventKind, string> = {
  WORKSHOP: "Atelier",
  NETWORKING: "Networking",
  OTHER: "Événement",
};

const KIND_STYLE: Record<
  EventKind,
  { Icon: typeof Mic; cover: string; chip: string }
> = {
  WORKSHOP: {
    Icon: Mic,
    cover: "from-indigo-500 to-violet-500",
    chip: "bg-indigo-50 text-indigo-700",
  },
  NETWORKING: {
    Icon: Users,
    cover: "from-sky-500 to-cyan-500",
    chip: "bg-sky-50 text-sky-700",
  },
  OTHER: {
    Icon: Sparkles,
    cover: "from-amber-400 to-orange-500",
    chip: "bg-amber-50 text-amber-700",
  },
};

function eventSpots(event: SpaceEvent): { label: string; tone: string } {
  const reg = event.registration?.status;
  if (reg === "REGISTERED" || reg === "ATTENDED") {
    return { label: "Inscrit ✓", tone: "bg-emerald-50 text-emerald-700" };
  }
  if (event.capacity == null) {
    return { label: "Places illimitées", tone: "bg-slate-100 text-slate-600" };
  }
  const left = Math.max(0, event.capacity - (event.registeredCount || 0));
  if (left === 0) return { label: "Complet", tone: "bg-rose-50 text-rose-700" };
  if (left <= 5) {
    return {
      label: `Plus que ${left} place${left > 1 ? "s" : ""}`,
      tone: "bg-amber-50 text-amber-700",
    };
  }
  return { label: "Places disponibles", tone: "bg-slate-100 text-slate-600" };
}

function EventCover({
  event,
  className,
}: {
  event: SpaceEvent;
  className?: string;
}) {
  const style = KIND_STYLE[event.kind] || KIND_STYLE.OTHER;
  const start = new Date(event.startAt);
  return (
    <div className={cn("relative overflow-hidden", className)}>
      {event.coverImage ? (
        <img
          src={event.coverImage}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          className={cn(
            "flex h-full w-full items-center justify-center bg-gradient-to-br text-white/90",
            style.cover
          )}
        >
          <style.Icon className="h-9 w-9" />
        </div>
      )}
      <div className="absolute left-2 top-2 flex min-w-[2.75rem] flex-col items-center rounded-xl bg-white/95 px-2 py-1 leading-none shadow-sm">
        <span className="text-base font-bold tabular-nums text-slate-900">
          {format(start, "d")}
        </span>
        <span className="mt-0.5 text-[10px] font-semibold uppercase text-indigo-600">
          {format(start, "MMM", { locale: fr }).replace(".", "")}
        </span>
      </div>
    </div>
  );
}

/** Full-width card (Événements list). */
export function EventListCard({
  event,
  href,
}: {
  event: SpaceEvent;
  href: string;
}) {
  const style = KIND_STYLE[event.kind] || KIND_STYLE.OTHER;
  const spots = eventSpots(event);
  const start = new Date(event.startAt);
  return (
    <Link
      href={href}
      className="block overflow-hidden rounded-3xl bg-white shadow-sm transition active:scale-[0.99]"
    >
      <EventCover event={event} className="h-32" />
      <div className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
              style.chip
            )}
          >
            {EVENT_KIND_LABEL[event.kind]}
          </span>
          <span
            className={cn(
              "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
              spots.tone
            )}
          >
            {spots.label}
          </span>
        </div>
        <h2 className="mt-1.5 line-clamp-2 text-base font-bold leading-snug text-slate-900">
          {event.title}
        </h2>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {format(start, "EEE d MMM", { locale: fr })}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {format(start, "HH:mm")}
            {event.endAt ? ` – ${format(new Date(event.endAt), "HH:mm")}` : ""}
          </span>
          {event.location ? (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{event.location}</span>
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

/** Compact one-row event strip (Accueil / session). Renders nothing without events. */
export function EventsPreview() {
  const { slug, href } = useOrg();
  const { data = [] } = useQuery({
    queryKey: ["mobile-events", slug, "upcoming"],
    queryFn: () => eventsApi.list(slug, "upcoming"),
    staleTime: 60_000,
  });
  const events = data.slice(0, 4);
  if (!events.length) return null;

  return (
    <div className="rounded-3xl bg-white py-2.5 text-left shadow-sm">
      <div className="flex items-center justify-between px-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Événements
        </p>
        <Link
          href={href("/events")}
          className="inline-flex items-center text-[11px] font-medium text-indigo-600"
        >
          Tout voir
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
      <div
        className="mt-1.5 flex snap-x gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {events.map((event) => {
          const style = KIND_STYLE[event.kind] || KIND_STYLE.OTHER;
          const spots = eventSpots(event);
          const start = new Date(event.startAt);
          return (
            <Link
              key={event.id}
              href={href(`/events/${event.id}`)}
              className={cn(
                "flex shrink-0 snap-start items-center gap-2.5 rounded-2xl bg-slate-50 p-1.5 pr-3 ring-1 ring-slate-200/70 transition active:scale-[0.98]",
                events.length === 1 ? "w-full" : "w-60"
              )}
            >
              <span
                className={cn(
                  "relative flex h-11 w-11 shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br leading-none text-white",
                  style.cover
                )}
              >
                {event.coverImage ? (
                  <img
                    src={event.coverImage}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-40"
                  />
                ) : null}
                <span className="relative text-base font-bold tabular-nums">
                  {format(start, "d")}
                </span>
                <span className="relative mt-0.5 text-[9px] font-semibold uppercase">
                  {format(start, "MMM", { locale: fr }).replace(".", "")}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-slate-900">
                  {event.title}
                </span>
                <span className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-slate-500">
                  <Clock className="h-3 w-3 shrink-0" />
                  {format(start, "EEE HH:mm", { locale: fr })}
                  <span
                    className={cn(
                      "ml-1 truncate rounded px-1 text-[10px] font-semibold",
                      spots.tone
                    )}
                  >
                    {spots.label}
                  </span>
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
