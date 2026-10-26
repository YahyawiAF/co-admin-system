"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { DoorOpen } from "lucide-react";
import { ChairMap, type SeatInfo } from "@/components/visitor/reserve/ChairMap";
import { bookingRequestsApi } from "@/lib/api/resources";
import type { BookingRequest, Space } from "@/lib/types";
import { cn } from "@/lib/utils";
import { StatusPill } from "./DemandesView";
import { BOOKING_COLORS, PART_LABEL, dt, initialsOf, labelsOf, partOf, spaceOfBooking, type DayPart } from "./shared";

type SlotFilter = "all" | DayPart;

function matches(part: DayPart, f: SlotFilter) {
  if (f === "all") return true;
  if (f === "day") return part === "day";
  return part === f || part === "day";
}

export function DayPlanView({
  spaces,
  daysAhead,
  markedDays,
}: {
  spaces: Space[];
  daysAhead: number;
  /** yyyy-MM-dd with at least one booking (dot under the day) */
  markedDays: Set<string>;
}) {
  const days = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: Math.max(7, Math.min(daysAhead, 30)) }, (_, i) => addDays(today, i));
  }, [daysAhead]);
  const [dayIso, setDayIso] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [slot, setSlot] = useState<SlotFilter>("all");
  const [focusId, setFocusId] = useState<string | null>(null);

  const { data: dayRows = [], isLoading } = useQuery({
    queryKey: ["booking-requests", "day", dayIso],
    queryFn: () => bookingRequestsApi.list(undefined, dayIso),
    refetchInterval: 20_000,
  });

  const list = useMemo(
    () => dayRows.filter((r) => r.status !== "REJECTED" && matches(partOf(r), slot)),
    [dayRows, slot]
  );
  const colorOf = useMemo(() => {
    const m = new Map<string, string>();
    list.forEach((r, i) => m.set(r.id, BOOKING_COLORS[i % BOOKING_COLORS.length]));
    return m;
  }, [list]);

  const maps = useMemo(
    () =>
      spaces.map((space) => {
        const seatInfo: Record<string, SeatInfo> = {};
        const owner: Record<string, BookingRequest> = {};
        for (const r of list) {
          if (r.kind !== "SEAT" || spaceOfBooking(r, spaces)?.id !== space.id) continue;
          for (const l of labelsOf(r)) {
            seatInfo[l] = {
              initials: initialsOf(r.memberName),
              color: colorOf.get(r.id)!,
              pending: r.status === "PENDING",
              title: r.memberName || "Visiteur",
            };
            owner[l] = r;
          }
        }
        const total = (space.tables || []).reduce((n, t) => n + (t.seats || []).filter((s) => s.isActive !== false).length, 0);
        return { space, seatInfo, owner, used: Object.keys(seatInfo).length, total };
      }),
    [spaces, list, colorOf]
  );

  const focus = list.find((r) => r.id === focusId) ?? null;
  const tipOf = (r: BookingRequest, label: string) =>
    `${r.memberName || "Visiteur"} · ${label} · ${format(new Date(r.startAt), "HH:mm")}–${format(new Date(r.endAt), "HH:mm")}${
      r.status === "PENDING" ? " · en attente" : ""
    }`;

  const places = list.reduce((n, r) => n + (r.kind === "SEAT" ? labelsOf(r).length || 1 : r.places || 1), 0);
  const fees = list.reduce((n, r) => n + (r.fee ?? 0), 0);
  const groups = (["am", "pm", "day"] as DayPart[])
    .map((p) => ({ part: p, items: list.filter((r) => partOf(r) === p) }))
    .filter((g) => g.items.length);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex max-w-full gap-1.5 overflow-x-auto pb-1">
          {days.map((d) => {
            const iso = format(d, "yyyy-MM-dd");
            const on = iso === dayIso;
            return (
              <button
                key={iso}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setDayIso(iso);
                  setFocusId(null);
                }}
                className={cn(
                  "flex h-[60px] w-14 shrink-0 flex-col items-center justify-center rounded-2xl transition-[background-color,color,box-shadow] duration-200 motion-reduce:transition-none",
                  on ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30" : "bg-card text-foreground ring-1 ring-border hover:bg-muted"
                )}
              >
                <span className="text-[11px] font-bold capitalize">{format(d, "EEE", { locale: fr })}</span>
                <span className="text-[17px] font-black leading-tight">{format(d, "d")}</span>
                <span
                  className={cn(
                    "mt-0.5 h-[5px] w-[5px] rounded-full",
                    markedDays.has(iso) ? (on ? "bg-amber-200" : "bg-amber-500") : "bg-transparent"
                  )}
                />
              </button>
            );
          })}
        </div>
        <div className="flex gap-1 rounded-xl bg-card p-1 ring-1 ring-border">
          {(
            [
              ["all", "Toute la journée"],
              ["am", "Matin"],
              ["pm", "Après-midi"],
              ["day", "Journée entière"],
            ] as [SlotFilter, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={slot === id}
              onClick={() => {
                setSlot(id);
                setFocusId(null);
              }}
              className={cn(
                "h-8 rounded-lg px-3 text-xs font-extrabold transition-colors duration-200 motion-reduce:transition-none",
                slot === id ? "bg-indigo-50 text-indigo-900" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="ml-auto text-sm text-muted-foreground">
          <strong className="text-foreground">{places}</strong> place{places > 1 ? "s" : ""} ·{" "}
          <strong className="text-foreground">{list.length}</strong> réservation{list.length > 1 ? "s" : ""} ·{" "}
          <strong className="text-amber-800">{dt(fees)}</strong> de frais à encaisser
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className={cn("grid gap-4", maps.length > 1 && "lg:grid-cols-2")}>
          {maps.length === 0 ? (
            <p className="rounded-2xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
              Aucun plan avec des places. Dessinez les tables dans Établissement → Espaces &amp; tables.
            </p>
          ) : null}
          {maps.map(({ space, seatInfo, owner, used, total }) => {
            const focusLabel = focus && labelsOf(focus).find((l) => owner[l]?.id === focus.id);
            return (
              <section key={space.id} className="v-rise rounded-2xl border bg-card p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-extrabold">{space.name}</p>
                  <span className="text-xs font-bold text-muted-foreground">
                    {used}/{total} places réservées
                  </span>
                </div>
                <ChairMap
                  space={space}
                  seatInfo={seatInfo}
                  onSeat={(label) => setFocusId(owner[label] && owner[label].id !== focusId ? owner[label].id : null)}
                  focus={focusLabel || null}
                  tip={focus && focusLabel ? tipOf(focus, focusLabel) : undefined}
                  height={520}
                />
              </section>
            );
          })}
        </div>

        <section className="space-y-3 rounded-2xl border bg-card p-3 xl:max-h-[640px] xl:overflow-y-auto">
          {isLoading ? <p className="py-6 text-center text-sm text-muted-foreground">Chargement…</p> : null}
          {!isLoading && !list.length ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Aucune réservation sur ce créneau</p>
          ) : null}
          {groups.map((g) => (
            <div key={g.part}>
              <p className="mb-1.5 px-0.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                {PART_LABEL[g.part]}
              </p>
              <div className="space-y-1.5">
                {g.items.map((r) => {
                  const on = r.id === focusId;
                  const col = colorOf.get(r.id)!;
                  const where = r.kind === "ROOM" ? r.spaceName || "Salle" : spaceOfBooking(r, spaces)?.name || "—";
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setFocusId(on ? null : r.id)}
                      className={cn(
                        "flex w-full gap-2.5 rounded-xl p-2 text-left transition-[background-color,box-shadow] duration-200 motion-reduce:transition-none",
                        on ? "bg-muted ring-2 ring-foreground" : "ring-1 ring-border hover:bg-muted/50"
                      )}
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black"
                        style={
                          r.status === "PENDING"
                            ? { background: "#fff", color: col, boxShadow: `inset 0 0 0 2px ${col}` }
                            : { background: col, color: "#fff" }
                        }
                      >
                        {r.kind === "ROOM" ? <DoorOpen className="h-4 w-4" /> : initialsOf(r.memberName)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-[13px] font-extrabold">{r.memberName || "Visiteur"}</span>
                          <StatusPill status={r.status} />
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {format(new Date(r.startAt), "HH:mm")}–{format(new Date(r.endAt), "HH:mm")} · {where}
                        </span>
                        <span className="block text-xs font-bold text-slate-700">
                          {r.kind === "ROOM" ? `${r.places || 1} pers.` : labelsOf(r).join(", ")}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-3 border-t pt-2 text-[11px] font-semibold text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-indigo-600" />
              Acceptée
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-white shadow-[inset_0_0_0_2px_#4f46e5]" />
              En attente
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-white shadow-[inset_0_0_0_2px_#059669]" />
              Libre
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
