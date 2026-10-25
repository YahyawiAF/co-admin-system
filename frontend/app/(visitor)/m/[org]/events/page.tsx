"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { eventsApi } from "@/lib/api/resources";
import { useOrg } from "@/lib/org";
import { cn } from "@/lib/utils";
import type { SpaceEvent } from "@/lib/types";
import {
  EventRow,
  FeaturedEventCard,
  PastEventRow,
  useMyEventStatuses,
} from "@/components/visitor/EventCard";
import { markEventSeen } from "@/components/visitor/VisitorSpotlight";

const rowDelay = (i: number) => ({ animationDelay: `${Math.min(i, 8) * 40}ms` });

/** 7 days from today; days with an event jump to that day's first event. */
function WeekStrip({
  events,
  onPick,
}: {
  events: SpaceEvent[];
  onPick: (eventId: string) => void;
}) {
  const today = startOfDay(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  return (
    <div className="v-rise grid grid-cols-7 gap-1 rounded-3xl bg-white px-1.5 py-2 shadow-sm ring-1 ring-slate-900/5">
      {days.map((day) => {
        const first = events.find((e) => isSameDay(new Date(e.startAt), day));
        const content = (
          <>
            <span className="text-[11px] font-bold">
              {format(day, "EEE", { locale: fr }).replace(".", "").toUpperCase()}
            </span>
            <span className="text-[15px] font-black tabular-nums">
              {format(day, "d")}
            </span>
            <span
              aria-hidden
              className={cn(
                "h-[5px] w-[5px] rounded-full",
                first ? "bg-amber-300" : "bg-transparent"
              )}
            />
          </>
        );
        const base =
          "flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-2xl leading-none";
        return first ? (
          <button
            key={day.toISOString()}
            type="button"
            onClick={() => onPick(first.id)}
            aria-label={`Voir l’événement du ${format(day, "EEEE d MMMM", { locale: fr })}`}
            className={cn(
              base,
              "bg-indigo-600 text-white shadow-sm transition-transform active:scale-95 motion-reduce:transition-none"
            )}
          >
            {content}
          </button>
        ) : (
          <div key={day.toISOString()} className={cn(base, "text-slate-700")}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

export default function EventsListPage() {
  const { slug, href } = useOrg();
  const [when, setWhen] = useState<"upcoming" | "past">("upcoming");
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightTimer = useRef<number | undefined>(undefined);
  const statuses = useMyEventStatuses();
  const { data = [], isLoading } = useQuery({
    queryKey: ["mobile-events", slug, when],
    queryFn: () => eventsApi.list(slug, when),
  });
  // Opening the list clears the "new events" badge on the bottom nav
  useEffect(() => {
    if (when === "upcoming") for (const e of data) markEventSeen(e.id);
  }, [data, when]);
  useEffect(() => () => window.clearTimeout(highlightTimer.current), []);

  const pickDay = (eventId: string) => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document
      .getElementById(`event-${eventId}`)
      ?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    setHighlightId(eventId);
    window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(() => setHighlightId(null), 1600);
  };

  const [featured, ...rest] = data;

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-1 rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-900/5">
        {(
          [
            { id: "upcoming", label: "À venir" },
            { id: "past", label: "Passés" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-pressed={when === tab.id}
            className={cn(
              "h-10 rounded-full text-sm font-bold transition-[background-color,color,box-shadow] duration-200 motion-reduce:transition-none",
              when === tab.id
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
            onClick={() => setWhen(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p key="loading" className="v-rise text-sm text-slate-500">
          Chargement…
        </p>
      ) : data.length === 0 ? (
        <div
          key={`empty-${when}`}
          className="v-rise flex flex-col items-center rounded-3xl bg-white py-5 text-center shadow-sm ring-1 ring-slate-900/5"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <CalendarDays className="h-5 w-5" />
          </span>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            Aucun événement {when === "upcoming" ? "à venir" : "passé"}
          </p>
          <p className="text-[11px] text-slate-500">
            Les ateliers et rencontres apparaîtront ici.
          </p>
        </div>
      ) : when === "upcoming" ? (
        <div key="upcoming" className="space-y-2.5">
          <WeekStrip events={data} onPick={pickDay} />
          <div className="v-rise" style={{ animationDelay: "60ms" }}>
            <FeaturedEventCard
              key={featured.id}
              event={featured}
              href={href(`/events/${featured.id}`)}
              highlighted={highlightId === featured.id}
            />
          </div>
          {rest.length ? (
            <div className="space-y-2">
              {rest.map((event, i) => (
                <EventRow
                  key={event.id}
                  event={event}
                  href={href(`/events/${event.id}`)}
                  myStatus={statuses.get(event.id)}
                  highlighted={highlightId === event.id}
                  style={{ animationDelay: `${100 + Math.min(i, 8) * 40}ms` }}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div key="past" className="space-y-2">
          {data.map((event, i) => (
            <PastEventRow
              key={event.id}
              event={event}
              href={href(`/events/${event.id}`)}
              myStatus={statuses.get(event.id)}
              style={rowDelay(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
