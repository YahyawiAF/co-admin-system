"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { eventsApi } from "@/lib/api/resources";
import { useOrg } from "@/lib/org";
import { cn } from "@/lib/utils";
import { EventListCard } from "@/components/visitor/EventCard";

export default function EventsListPage() {
  const { slug, href } = useOrg();
  const [when, setWhen] = useState<"upcoming" | "past">("upcoming");
  const { data = [], isLoading } = useQuery({
    queryKey: ["mobile-events", slug, when],
    queryFn: () => eventsApi.list(slug, when),
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-full bg-white p-1 shadow-sm">
        {(
          [
            { id: "upcoming", label: "À venir" },
            { id: "past", label: "Passés" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={cn(
              "h-9 rounded-full text-sm font-semibold transition",
              when === tab.id
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
            onClick={() => setWhen(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {isLoading ? (
        <p className="text-sm text-slate-500">Chargement…</p>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl bg-white py-5 text-center shadow-sm">
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
      ) : (
        data.map((event) => (
          <EventListCard
            key={event.id}
            event={event}
            href={href(`/events/${event.id}`)}
          />
        ))
      )}
    </div>
  );
}
