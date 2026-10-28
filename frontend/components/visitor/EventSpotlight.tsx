"use client";

import { useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronRight } from "lucide-react";
import { eventsApi } from "@/lib/api/resources";
import { useOrg } from "@/lib/org";
import { cn } from "@/lib/utils";
import type { EventKind, SpaceEvent } from "@/lib/types";
import { EVENT_KIND_LABEL, eventSpots, useMyEventStatuses, weekdayShort } from "./EventCard";

/** Poster art when the event has no cover photo. */
const ART: Record<EventKind, { bg: string; a: string; b: string; tone: string }> = {
  WORKSHOP: { bg: "linear-gradient(135deg,#312e81,#6d28d9 55%,#db2777)", a: "rgba(251,191,36,.35)", b: "rgba(99,102,241,.45)", tone: "#6d28d9" },
  NETWORKING: { bg: "linear-gradient(135deg,#0c4a6e,#0891b2 60%,#22d3ee)", a: "rgba(255,255,255,.18)", b: "rgba(14,165,233,.5)", tone: "#0e7490" },
  OTHER: { bg: "linear-gradient(135deg,#7c2d12,#ea580c 55%,#f59e0b)", a: "rgba(254,243,199,.25)", b: "rgba(220,38,38,.35)", tone: "#c2410c" },
  LEARNING: { bg: "linear-gradient(135deg,#064e3b,#059669 55%,#2dd4bf)", a: "rgba(236,253,245,.22)", b: "rgba(16,185,129,.45)", tone: "#047857" },
};

const MAX = 5;

/**
 * Home "À l’affiche": one upcoming event at a time, like a cinema poster.
 * Rotates every 6.5 s with a soft fade (story bars show the next one), pauses
 * while touched or hovered, swipe / tap the sides to change. Reduced motion:
 * no auto-rotation, no zoom.
 */
export function EventSpotlight({ className }: { className?: string }) {
  const { slug, href } = useOrg();
  const statuses = useMyEventStatuses();
  const { data = [] } = useQuery({
    queryKey: ["mobile-events", slug, "upcoming"],
    queryFn: () => eventsApi.list(slug, "upcoming"),
    staleTime: 60_000,
  });
  const events = data.slice(0, MAX);
  const [index, setIndex] = useState(0);
  const [round, setRound] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);

  if (!events.length) return null;
  const i = index % events.length;
  const event = events[i];
  const many = events.length > 1;

  const go = (n: number) => {
    setIndex((n + events.length) % events.length);
    setRound((r) => r + 1);
  };

  return (
    <section
      aria-roledescription="carrousel"
      aria-label="Événements à l’affiche"
      className={cn(
        "relative h-[196px] overflow-hidden rounded-[22px] bg-slate-900 text-white shadow-[0_10px_24px_-16px_rgba(15,23,42,.7)]",
        className
      )}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={(e) => {
        // keyboard only: a tap focuses the button on Android and would pause for good
        if (e.target.matches(":focus-visible")) setPaused(true);
      }}
      onBlur={() => setPaused(false)}
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
        setPaused(true);
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        touchX.current = null;
        setPaused(false);
        const end = e.changedTouches[0]?.clientX;
        if (many && start != null && end != null && Math.abs(end - start) > 40) go(i + (end < start ? 1 : -1));
      }}
    >
      <Poster key={`${event.id}-${round}`} event={event} paused={paused} />

      {many ? (
        <div className="absolute inset-x-3 top-2.5 z-[2] flex gap-1">
          {events.map((e, k) => (
            <button
              key={e.id}
              type="button"
              aria-label={`Voir ${e.title}`}
              aria-current={k === i}
              onClick={() => go(k)}
              className="flex-1 py-[5px]"
            >
              <span className="block h-[3px] overflow-hidden rounded-full bg-white/30">
                {k < i ? (
                  <span className="block h-full w-full rounded-full bg-white" />
                ) : k === i ? (
                  <span
                    key={round}
                    className="v-story block h-full rounded-full bg-white motion-reduce:w-full"
                    style={{ animationPlayState: paused ? "paused" : "running" }}
                    onAnimationEnd={() => go(i + 1)}
                  />
                ) : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <span
        className={cn(
          "absolute left-3 z-[2] flex h-[22px] items-center gap-1.5 rounded-[7px] bg-slate-900/45 px-2 text-[10px] font-extrabold uppercase tracking-[.08em]",
          many ? "top-[30px]" : "top-3"
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />À l’affiche{many ? ` · ${i + 1}/${events.length}` : ""}
      </span>

      {many ? (
        <>
          <button
            type="button"
            aria-label="Événement précédent"
            onClick={() => go(i - 1)}
            className="absolute bottom-[64px] left-0 top-14 z-[1] w-[30%]"
          />
          <button
            type="button"
            aria-label="Événement suivant"
            onClick={() => go(i + 1)}
            className="absolute bottom-[64px] right-0 top-14 z-[1] w-[30%]"
          />
        </>
      ) : null}

      <Details key={`d-${event.id}-${round}`} event={event} status={statuses.get(event.id)} href={href(`/events/${event.id}`)} many={many} />
    </section>
  );
}

function Poster({ event, paused }: { event: SpaceEvent; paused: boolean }) {
  const art = ART[event.kind] || ART.OTHER;
  const zoom: CSSProperties = { animationPlayState: paused ? "paused" : "running" };
  return (
    <div className="v-fade-in absolute inset-0">
      {event.coverImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={event.coverImage} alt="" className="v-kenburns absolute inset-0 h-full w-full object-cover" style={zoom} />
      ) : (
        <div className="v-kenburns absolute inset-0" style={{ ...zoom, background: art.bg }}>
          <span className="absolute -top-[20%] left-[58%] h-[190px] w-[190px] rounded-full blur-[2px]" style={{ background: art.a }} />
          <span className="absolute -left-[12%] top-[38%] h-[150px] w-[150px] rounded-full blur-[2px]" style={{ background: art.b }} />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/5 via-slate-900/35 to-slate-900/90" />
    </div>
  );
}

function Details({
  event,
  status,
  href,
  many,
}: {
  event: SpaceEvent;
  status?: string;
  href: string;
  many: boolean;
}) {
  const art = ART[event.kind] || ART.OTHER;
  const start = new Date(event.startAt);
  const spots = eventSpots(event, status);
  const registered = spots?.label.startsWith("Inscrit");
  const full = spots?.label === "Complet";
  const day = format(start, "EEEE d MMM", { locale: fr });
  const line = [day.charAt(0).toUpperCase() + day.slice(1), event.location].filter(Boolean).join(" · ");

  return (
    <>
      <span
        className={cn(
          "v-rise absolute right-3 z-[2] flex w-[50px] flex-col items-center rounded-xl bg-white/95 pb-1.5 pt-1 leading-none text-slate-900",
          many ? "top-[30px]" : "top-3"
        )}
      >
        <span className="text-[9px] font-extrabold" style={{ color: art.tone }}>
          {weekdayShort(start)}
        </span>
        <span className="mt-0.5 text-xl font-black tabular-nums">{format(start, "d")}</span>
        <span className="mt-0.5 text-[10px] font-bold text-slate-600">{format(start, "HH:mm")}</span>
      </span>

      <div className="v-rise absolute inset-x-3.5 bottom-3 z-[2] flex items-end gap-2.5 [animation-delay:.1s]">
        <div className="min-w-0 flex-1">
          <span
            className={cn(
              "inline-flex h-5 items-center rounded-md px-1.5 text-[10px] font-extrabold",
              full ? "bg-rose-100 text-rose-800" : "bg-white/20 text-white ring-1 ring-inset ring-white/35"
            )}
          >
            {full ? "Complet" : EVENT_KIND_LABEL[event.kind] || "Événement"}
          </span>
          <p className="mt-1 line-clamp-2 text-lg font-black leading-tight">{event.title}</p>
          <p className="mt-0.5 truncate text-xs text-slate-200">{line}</p>
        </div>
        <Link
          href={href}
          className={cn(
            "relative z-[3] flex h-9 shrink-0 items-center gap-0.5 rounded-full px-3.5 text-[13px] font-black transition-transform duration-150 active:scale-95 motion-reduce:transition-none",
            registered
              ? "bg-emerald-500 text-white"
              : full
                ? "bg-white/15 text-white ring-[1.5px] ring-inset ring-white/60"
                : "bg-white text-indigo-900"
          )}
        >
          {registered ? "Inscrit ✓" : full ? "Voir" : "Je participe"}
          {!registered ? <ChevronRight className="h-4 w-4" /> : null}
        </Link>
      </div>
    </>
  );
}
