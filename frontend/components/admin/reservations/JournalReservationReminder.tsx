"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isBefore, startOfDay } from "date-fns";
import { Armchair, Check, ChevronRight, DoorOpen, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { bookingRequestsApi } from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import type { BookingRequest } from "@/lib/types";
import { cn } from "@/lib/utils";
import { dt, initialsOf, labelsOf } from "./shared";

/**
 * Journal, on a reservation day: "these places are reserved — mark them on the plan".
 * Accepted ahead of time, a reservation does not hold its places yet.
 */
export function JournalReservationReminder({
  date,
  onShowSeat,
}: {
  date: Date;
  onShowSeat?: (label: string, spaceId: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const dayIso = format(date, "yyyy-MM-dd");
  const past = isBefore(startOfDay(date), startOfDay(new Date()));

  const { data: rows = [] } = useQuery({
    queryKey: ["booking-requests", "day", dayIso],
    queryFn: () => bookingRequestsApi.list(undefined, dayIso),
    enabled: !past,
    refetchInterval: 30_000,
  });
  const accepted = rows.filter((r) => r.status === "APPROVED");
  const waiting = rows.filter((r) => r.status === "PENDING").length;

  const hold = useMutation({
    mutationFn: (id: string) => bookingRequestsApi.holdSeats(id),
    onSuccess: (r) => {
      toast.success(`Place réservée pour ${r.memberName || "le visiteur"}`);
      queryClient.invalidateQueries({ queryKey: ["booking-requests", "day", dayIso] });
      queryClient.invalidateQueries({ queryKey: queryKeys.journal(date) });
      queryClient.invalidateQueries({ queryKey: ["facility-occupancy"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (past || (!accepted.length && !waiting)) return null;
  const todo = accepted.filter((r) => !r.seatsHeld).length;

  return (
    <section
      className={cn(
        "v-rise rounded-2xl border p-3 transition-colors duration-300 motion-reduce:transition-none",
        todo ? "border-amber-200 bg-amber-50/70" : "border-emerald-200 bg-emerald-50/60"
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg",
            todo ? "bg-amber-200 text-amber-900" : "bg-emerald-200 text-emerald-900"
          )}
        >
          <MapPin className="h-4 w-4" />
        </span>
        <p className="text-sm font-extrabold">
          {todo
            ? `Réservations du jour : ${todo} place${todo > 1 ? "s" : ""} à marquer sur le plan`
            : accepted.length
              ? "Réservations du jour : toutes les places sont marquées"
              : "Réservations du jour"}
        </p>
        <span className="flex-1" />
        {waiting ? (
          <Link
            href="/reservations"
            className="inline-flex items-center rounded-full bg-rose-600 px-2.5 py-1 text-xs font-extrabold text-white transition-colors hover:bg-rose-700"
          >
            {waiting} en attente
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
        <Link href="/reservations?tab=jour" className="text-xs font-semibold text-indigo-700 hover:underline">
          Plan du jour →
        </Link>
      </div>

      {accepted.length ? (
        <div className="mt-2.5 grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
          {accepted.map((r, i) => (
            <ReminderRow
              key={r.id}
              r={r}
              index={i}
              busy={hold.isPending && hold.variables === r.id}
              onHold={() => hold.mutate(r.id)}
              onShowSeat={onShowSeat}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ReminderRow({
  r,
  index,
  busy,
  onHold,
  onShowSeat,
}: {
  r: BookingRequest;
  index: number;
  busy: boolean;
  onHold: () => void;
  onShowSeat?: (label: string, spaceId: string | null) => void;
}) {
  const labels = labelsOf(r);
  const held = !!r.seatsHeld;
  return (
    <div
      className={cn(
        "v-rise flex items-center gap-2.5 rounded-xl bg-card p-2 ring-1 transition-[box-shadow] duration-300 motion-reduce:transition-none",
        held ? "ring-emerald-200" : "ring-amber-200"
      )}
      style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-xs font-black text-indigo-800">
        {initialsOf(r.memberName)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">
          {r.memberName || "Visiteur"}
          <span className="ml-1.5 text-xs font-semibold text-muted-foreground">
            {format(new Date(r.startAt), "HH:mm")}–{format(new Date(r.endAt), "HH:mm")}
          </span>
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          {r.kind === "ROOM" ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-px text-[11px] font-bold text-slate-700">
              <DoorOpen className="h-3 w-3" />
              {r.spaceName || "Salle"}
            </span>
          ) : (
            labels.map((l) => (
              <button
                key={l}
                type="button"
                title="Voir sur le plan"
                onClick={() => onShowSeat?.(l, r.seatSpaceId || r.spaceId || null)}
                className="rounded-md bg-indigo-100 px-1.5 py-px text-[11px] font-extrabold text-indigo-800 transition-colors hover:bg-indigo-200"
              >
                {l}
              </button>
            ))
          )}
          {(r.fee ?? 0) > 0 ? <span className="text-[11px] font-bold text-amber-800">· frais {dt(r.fee!)}</span> : null}
        </div>
      </div>
      {held ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-extrabold text-emerald-800">
          <Check className="h-3.5 w-3.5" />
          Réservée
        </span>
      ) : (
        <Button size="sm" className="shrink-0" disabled={busy} onClick={onHold}>
          <Armchair className="mr-1 h-3.5 w-3.5" />
          {r.kind === "ROOM" ? "Réserver la salle" : labels.length > 1 ? "Réserver les places" : "Réserver la place"}
        </Button>
      )}
    </div>
  );
}
