"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { eventsApi } from "@/lib/api/resources";
import { useOrg } from "@/lib/org";
import { cn } from "@/lib/utils";
import type { EventKind, SpaceEvent } from "@/lib/types";

const KIND_LABEL: Record<EventKind, string> = {
  WORKSHOP: "Atelier",
  NETWORKING: "Networking",
  OTHER: "Événement",
};

function EventCard({ event, href }: { event: SpaceEvent; href: string }) {
  const full =
    event.capacity != null &&
    (event.registeredCount || 0) >= event.capacity;
  return (
    <Link
      href={href}
      className="block overflow-hidden rounded-2xl bg-white shadow-sm"
    >
      {event.coverImage ? (
        <img
          src={event.coverImage}
          alt=""
          className="h-36 w-full object-cover"
        />
      ) : null}
      <div className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Badge variant="outline">{KIND_LABEL[event.kind]}</Badge>
          <h2 className="mt-2 text-base font-semibold">{event.title}</h2>
        </div>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
        <CalendarDays className="h-4 w-4" />
        {format(new Date(event.startAt), "EEE d MMM · HH:mm", { locale: fr })}
      </p>
      {event.location ? (
        <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
          <MapPin className="h-4 w-4" />
          {event.location}
        </p>
      ) : null}
      <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
        <Users className="h-4 w-4" />
        {event.capacity == null
          ? `${event.registeredCount || 0} inscrits · Illimité`
          : `${event.registeredCount || 0}/${event.capacity} places`}
        {full ? " · Complet" : ""}
      </p>
      </div>
    </Link>
  );
}

export default function EventsListPage() {
  const { slug, href } = useOrg();
  const [when, setWhen] = useState<"upcoming" | "past">("upcoming");
  const { data = [], isLoading } = useQuery({
    queryKey: ["mobile-events", slug, when],
    queryFn: () => eventsApi.list(slug, when),
  });

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-full bg-slate-200/70 p-1 text-sm">
        <button
          type="button"
          className={cn(
            "flex-1 rounded-full py-1.5 font-medium",
            when === "upcoming" ? "bg-white shadow-sm" : "text-slate-500"
          )}
          onClick={() => setWhen("upcoming")}
        >
          À venir
        </button>
        <button
          type="button"
          className={cn(
            "flex-1 rounded-full py-1.5 font-medium",
            when === "past" ? "bg-white shadow-sm" : "text-slate-500"
          )}
          onClick={() => setWhen("past")}
        >
          Passés
        </button>
      </div>
      {isLoading ? (
        <p className="text-sm text-slate-500">Chargement…</p>
      ) : data.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500">
          Aucun événement {when === "upcoming" ? "à venir" : "passé"}.
        </p>
      ) : (
        data.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            href={href(`/events/${event.id}`)}
          />
        ))
      )}
    </div>
  );
}
