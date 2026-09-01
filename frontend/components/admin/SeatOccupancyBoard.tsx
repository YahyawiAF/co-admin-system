"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Map as MapIcon, Timer } from "lucide-react";
import { RelocateSeatDialog } from "@/components/admin/RelocateSeatDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FloorPlanCanvas } from "@/components/admin/FloorPlanCanvas";
import { bookingApi, facilityApi, journalApi, abonnementsApi } from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import type { Abonnement, Journal, Space, SpaceSeat } from "@/lib/types";
import {
  expectedEndMs,
  isActiveVisit,
  isOverstay,
  priceOf,
  remainingMs,
  visitorLabel,
  groupOf,
} from "@/lib/journal-utils";
import { cn } from "@/lib/utils";
import {
  activeSubByMember,
  daysLeft,
  isActiveSub,
  subscriptionExpiryLabel,
  subscriptionForSeat,
} from "@/lib/subscription-utils";
import { subscriptionSummaryLine } from "@/components/admin/SubscriptionMemberPanel";

function formatRemain(ms: number | null) {
  if (ms == null) return "—";
  const abs = Math.abs(ms);
  const totalMin = Math.floor(abs / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  let core: string;
  if (h <= 0) core = `${m} min`;
  else if (m <= 0) core = `${h} h`;
  else core = `${h} h ${String(m).padStart(2, "0")} min`;
  return ms < 0 ? `+${core}` : core;
}

type OccupancyRow = {
  seatLabel: string;
  spaceId: string;
  spaceName: string;
  tableName: string | null;
  isOverflow: boolean;
  journal: Journal;
  remaining: number | null;
  overstay: boolean;
};

type Props = {
  date?: Date;
  triggerClassName?: string;
  variant?: "default" | "icon";
  /** Controlled open (e.g. from journal place click). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Seat label to select when opening. */
  focusSeatLabel?: string | null;
  /** Space that owns the focused seat (required when labels collide across spaces). */
  focusSpaceId?: string | null;
};

export function SeatOccupancyBoard({
  date,
  triggerClassName,
  variant = "default",
  open: openProp,
  onOpenChange,
  focusSeatLabel,
  focusSpaceId,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? !!openProp : internalOpen;
  const setOpen = (v: boolean) => {
    if (controlled) onOpenChange?.(v);
    else setInternalOpen(v);
  };
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [selectedSeatLabel, setSelectedSeatLabel] = useState<string | null>(
    null
  );
  const [relocateOpen, setRelocateOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const day = date || new Date();

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [open]);

  const { data: layout } = useQuery({
    queryKey: ["facility-layout"],
    queryFn: () => facilityApi.layout(),
    enabled: open,
  });
  const { data: occupancy } = useQuery({
    queryKey: ["facility-occupancy"],
    queryFn: () => facilityApi.occupancy(),
    enabled: open,
    refetchInterval: open ? 15_000 : false,
  });
  const { data: bookings = [] } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => bookingApi.list(),
    enabled: open,
    refetchInterval: open ? 15_000 : false,
  });
  const { data: journalPage } = useQuery({
    queryKey: queryKeys.journal(day),
    queryFn: () => journalApi.list({ journalDate: day, perPage: 200 }),
    enabled: open,
    refetchInterval: open ? 15_000 : false,
  });
  const { data: abonnementsRaw } = useQuery({
    queryKey: queryKeys.abonnements,
    queryFn: () => abonnementsApi.list(),
    enabled: open,
    refetchInterval: open ? 30_000 : false,
  });

  const abonnements: Abonnement[] = useMemo(() => {
    if (!abonnementsRaw) return [];
    return Array.isArray(abonnementsRaw)
      ? abonnementsRaw
      : abonnementsRaw.data || [];
  }, [abonnementsRaw]);

  const subByMember = useMemo(
    () => activeSubByMember(abonnements),
    [abonnements],
  );

  const spaces = layout?.spaces || [];
  const journals = journalPage?.data || [];

  const presentByMember = useMemo(() => {
    const map = new Map<string, Journal>();
    for (const j of journals) {
      if (!isActiveVisit(j) || !j.memberID) continue;
      map.set(j.memberID, j);
    }
    return map;
  }, [journals]);

  const anonymousPresent = useMemo(
    () =>
      journals.filter(
        (j) => isActiveVisit(j) && (j.isAnonymous || !j.memberID)
      ),
    [journals]
  );

  const seatMeta = useMemo(() => {
    const map = new Map<
      string,
      {
        spaceId: string;
        spaceName: string;
        tableName: string | null;
        isOverflow: boolean;
        seat: SpaceSeat;
      }
    >();
    for (const space of spaces) {
      for (const t of space.tables || []) {
        for (const seat of t.seats || []) {
          if (!seat.isActive) continue;
          map.set(`${space.id}:${seat.label}`, {
            spaceId: space.id,
            spaceName: space.name,
            tableName: t.name,
            isOverflow: seat.isOverflow,
            seat,
          });
        }
      }
      for (const seat of space.seats || []) {
        if (!seat.isActive || seat.tableId) continue;
        map.set(`${space.id}:${seat.label}`, {
          spaceId: space.id,
          spaceName: space.name,
          tableName: null,
          isOverflow: seat.isOverflow,
          seat,
        });
      }
    }
    return map;
  }, [spaces]);

  useEffect(() => {
    if (!spaces.length) {
      setSpaceId(null);
      return;
    }
    if (!spaceId || !spaces.some((s) => s.id === spaceId)) {
      setSpaceId(spaces[0].id);
    }
  }, [spaces, spaceId]);

  // When opening with a focused seat, select it and switch to its space
  useEffect(() => {
    if (!open || !focusSeatLabel) return;
    setSelectedSeatLabel(focusSeatLabel);
    if (focusSpaceId && spaces.some((s) => s.id === focusSpaceId)) {
      setSpaceId(focusSpaceId);
      return;
    }
    // Prefer booking that matches this label + known space; else first booking match
    const booking =
      bookings.find(
        (b) =>
          b.isBooked &&
          b.seatId === focusSeatLabel &&
          (!focusSpaceId || b.spaceId === focusSpaceId)
      ) ||
      bookings.find((b) => b.isBooked && b.seatId === focusSeatLabel);
    if (booking?.spaceId) {
      setSpaceId(booking.spaceId);
      return;
    }
    const meta =
      [...seatMeta.values()].find(
        (m) =>
          m.seat.label === focusSeatLabel &&
          (!focusSpaceId || m.spaceId === focusSpaceId)
      ) || null;
    if (meta?.spaceId) setSpaceId(meta.spaceId);
  }, [open, focusSeatLabel, focusSpaceId, seatMeta, bookings, spaces]);

  const rows: OccupancyRow[] = useMemo(() => {
    const list: OccupancyRow[] = [];
    const usedAnonymous = new Set<string>();
    for (const b of bookings) {
      if (!b.isBooked) continue;
      let journal = b.memberId ? presentByMember.get(b.memberId) : undefined;
      if (!journal) {
        journal = anonymousPresent.find(
          (j) =>
            !usedAnonymous.has(j.id) &&
            (j.guestName || "").includes(b.seatId)
        );
        if (journal) usedAnonymous.add(journal.id);
      }
      if (!journal) continue;
      const meta = seatMeta.get(
        b.spaceId ? `${b.spaceId}:${b.seatId}` : b.seatId
      );
      list.push({
        seatLabel: b.seatId,
        spaceId: meta?.spaceId || "",
        spaceName: meta?.spaceName || "—",
        tableName: meta?.tableName || null,
        isOverflow: meta?.isOverflow || false,
        journal,
        remaining: remainingMs(journal, now),
        overstay: isOverstay(journal, now),
      });
    }
    return list.sort((a, b) => {
      const ra = a.remaining;
      const rb = b.remaining;
      if (ra == null && rb == null) return a.seatLabel.localeCompare(b.seatLabel);
      if (ra == null) return 1;
      if (rb == null) return -1;
      return ra - rb;
    });
  }, [bookings, presentByMember, anonymousPresent, seatMeta, now]);

  const activeSpace: Space | null =
    spaces.find((s) => s.id === spaceId) || spaces[0] || null;

  const spaceRows = useMemo(
    () => rows.filter((r) => !spaceId || r.spaceId === spaceId || !r.spaceId),
    [rows, spaceId]
  );

  const selectedRow =
    rows.find(
      (r) =>
        r.seatLabel === selectedSeatLabel &&
        (!spaceId || !r.spaceId || r.spaceId === spaceId)
    ) ||
    rows.find((r) => r.seatLabel === selectedSeatLabel) ||
    null;

  const selectedSeatSubscription = useMemo(() => {
    if (!selectedSeatLabel) return null;
    return subscriptionForSeat(abonnements, selectedSeatLabel, spaceId);
  }, [abonnements, selectedSeatLabel, spaceId]);

  const reservedInSpace = useMemo(() => {
    if (!spaceId) return [];
    return abonnements.filter(
      (a) =>
        isActiveSub(a) &&
        a.reservedSeatLabel &&
        (!a.reservedSeatSpaceId || a.reservedSeatSpaceId === spaceId),
    );
  }, [abonnements, spaceId]);

  const selectedSeatId = useMemo(() => {
    if (!selectedSeatLabel || !activeSpace) return null;
    const all = [
      ...(activeSpace.seats || []),
      ...(activeSpace.tables || []).flatMap((t) => t.seats || []),
    ];
    return all.find((s) => s.label === selectedSeatLabel)?.id || null;
  }, [selectedSeatLabel, activeSpace]);

  // Keep map on the space that owns the selected seat
  useEffect(() => {
    if (!selectedSeatLabel) return;
    if (focusSpaceId && selectedSeatLabel === focusSeatLabel) {
      if (focusSpaceId !== spaceId) setSpaceId(focusSpaceId);
      return;
    }
    const keyed = spaceId
      ? seatMeta.get(`${spaceId}:${selectedSeatLabel}`)
      : null;
    if (keyed?.spaceId) return;
    const fromBooking = bookings.find(
      (b) => b.isBooked && b.seatId === selectedSeatLabel && b.spaceId
    );
    if (fromBooking?.spaceId && fromBooking.spaceId !== spaceId) {
      setSpaceId(fromBooking.spaceId);
    }
  }, [
    selectedSeatLabel,
    seatMeta,
    spaceId,
    bookings,
    focusSpaceId,
    focusSeatLabel,
  ]);

  const freeInSpace = useMemo(() => {
    if (!activeSpace) return { free: 0, total: 0 };
    const all = [
      ...(activeSpace.seats || []).filter((s) => s.isActive && !s.isOverflow),
      ...(activeSpace.tables || []).flatMap((t) =>
        (t.seats || []).filter((s) => s.isActive && !s.isOverflow)
      ),
    ];
    const byId = new Map(all.map((s) => [s.id, s]));
    const unique = [...byId.values()];
    const booked = new Set(
      bookings
        .filter((b) => b.isBooked && (!b.spaceId || b.spaceId === activeSpace.id))
        .map((b) => b.seatId)
    );
    const free = unique.filter((s) => !booked.has(s.label)).length;
    return { free, total: unique.length };
  }, [activeSpace, bookings]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "icon" ? (
          <Button
            variant="ghost"
            size="icon"
            className={triggerClassName}
            title="Plan & occupation"
          >
            <MapIcon className="h-5 w-5" />
          </Button>
        ) : (
          <Button variant="outline" className={cn("gap-2", triggerClassName)}>
            <MapIcon className="h-4 w-4" />
            Plan & places
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="flex h-[94vh] w-[98vw] max-w-none flex-col gap-3 overflow-hidden sm:max-w-none">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            Occupation des places
            {occupancy ? (
              <Badge variant="secondary">
                {occupancy.normalOccupied}/{occupancy.normalCapacity}
                {occupancy.overflowOccupied
                  ? ` · X${occupancy.overflowOccupied}`
                  : ""}
              </Badge>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {spaces.map((s) => {
            const taken = rows.filter((r) => r.spaceId === s.id).length;
            return (
              <Button
                key={s.id}
                size="sm"
                variant={spaceId === s.id ? "default" : "outline"}
                onClick={() => {
                  setSpaceId(s.id);
                  setSelectedSeatLabel(null);
                }}
              >
                {s.name}
                <span className="ml-1 opacity-80">({taken})</span>
              </Button>
            );
          })}
        </div>

        <div
          className={cn(
            "grid min-h-0 flex-1 gap-3 overflow-hidden",
            relocateOpen
              ? "lg:grid-cols-2"
              : "lg:grid-cols-[1.35fr_1fr]"
          )}
        >
          <div className="flex min-h-0 flex-col gap-2 overflow-hidden">
            <p className="text-xs text-muted-foreground">
              {activeSpace?.name || "Espace"} — {freeInSpace.free}/
              {freeInSpace.total} libres · cliquez une place pour le détail
            </p>
            <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-muted/20 p-1">
              {activeSpace ? (
                <FloorPlanCanvas
                  space={activeSpace}
                  bookings={bookings}
                  editMode={false}
                  variant="fit"
                  className="h-full min-h-[min(60vh,560px)]"
                  selectedSeatId={selectedSeatId}
                  onSelectSeat={(seat) => setSelectedSeatLabel(seat.label)}
                />
              ) : (
                <p className="p-6 text-sm text-muted-foreground">
                  Aucun espace configuré.
                </p>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-2 overflow-hidden">
            {relocateOpen && selectedRow ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    Déplacer {visitorLabel(selectedRow.journal)}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRelocateOpen(false)}
                  >
                    Annuler
                  </Button>
                </div>
                <RelocateSeatDialog
                  occupants={[
                    {
                      memberId: selectedRow.journal.memberID,
                      name: visitorLabel(selectedRow.journal),
                      seatLabel: selectedRow.seatLabel,
                      spaceName: selectedRow.spaceName,
                    },
                  ]}
                  blockedSpaceName={selectedRow.spaceName}
                  onMoved={() => {
                    setRelocateOpen(false);
                    setSelectedSeatLabel(null);
                  }}
                />
              </>
            ) : (
            <>
            <div className="flex items-center gap-2 text-sm font-medium">
              <Timer className="h-4 w-4" />
              Départs (premier → dernier)
            </div>
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto rounded-lg border p-2">
              {spaceRows.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">
                  Aucune place occupée
                  {activeSpace ? ` dans ${activeSpace.name}` : ""}.
                </p>
              ) : (
                spaceRows.map((row, i) => {
                  const price = priceOf(row.journal);
                  const end = expectedEndMs(row.journal);
                  const memberSub = row.journal.memberID
                    ? subByMember.get(row.journal.memberID)
                    : null;
                  const seatSub = subscriptionForSeat(
                    abonnements,
                    row.seatLabel,
                    row.spaceId,
                  );
                  const subLine =
                    subscriptionSummaryLine(memberSub || seatSub) ||
                    subscriptionSummaryLine(seatSub);
                  const selected =
                    selectedSeatLabel === row.seatLabel &&
                    (!spaceId || !row.spaceId || row.spaceId === spaceId);
                  return (
                    <button
                      key={`${row.seatLabel}-${row.journal.id}`}
                      type="button"
                      onClick={() => {
                        setSelectedSeatLabel(row.seatLabel);
                        if (row.spaceId) setSpaceId(row.spaceId);
                      }}
                      className={cn(
                        "w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                        selected
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "hover:bg-muted/50",
                        row.overstay && "border-amber-400/60 bg-amber-50/50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-bold text-muted-foreground">
                              #{i + 1}
                            </span>
                            <span className="font-semibold">
                              {visitorLabel(row.journal)}
                            </span>
                            {priceOf(row.journal)?.category === "ABONNEMENT" ||
                            priceOf(row.journal)?.type === "abonnement" ? (
                              <Badge className="h-5 bg-violet-600 text-[10px] hover:bg-violet-600">
                                Abonné
                              </Badge>
                            ) : null}
                            {groupOf(row.journal)?.name ? (
                              <Badge variant="outline" className="h-5 text-[10px]">
                                {groupOf(row.journal)!.name}
                              </Badge>
                            ) : null}
                            {row.isOverflow ? (
                              <Badge
                                variant="outline"
                                className="h-5 text-[10px] text-rose-700"
                              >
                                Overflow
                              </Badge>
                            ) : null}
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            Place <strong>{row.seatLabel}</strong>
                            {row.tableName ? ` · ${row.tableName}` : ""}
                            {row.spaceName ? ` · ${row.spaceName}` : ""}
                          </div>
                          <div className="mt-0.5 text-xs">
                            {price?.name || "Forfait"} ·{" "}
                            {row.journal.payedAmount ?? price?.price ?? 0} DT
                            {row.journal.isPayed ? " · payé" : " · impayé"}
                          </div>
                          {subLine ? (
                            <div className="mt-0.5 text-xs text-violet-700 dark:text-violet-300">
                              Abo : {subLine}
                            </div>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-right">
                          <div
                            className={cn(
                              "font-mono text-sm font-bold tabular-nums",
                              row.overstay
                                ? "text-amber-700"
                                : row.remaining != null &&
                                    row.remaining < 30 * 60_000
                                  ? "text-sky-700"
                                  : "text-foreground"
                            )}
                          >
                            {formatRemain(row.remaining)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {row.overstay
                              ? "dépassé"
                              : end
                                ? `fin ${format(end, "HH:mm")}`
                                : "durée ?"}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {selectedRow ? (
              <div className="rounded-lg border bg-card p-3 text-sm">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Détail sélection
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-base font-bold">
                  {visitorLabel(selectedRow.journal)}
                  {groupOf(selectedRow.journal)?.name ? (
                    <Badge variant="secondary">
                      {groupOf(selectedRow.journal)!.name}
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <p>
                    Place :{" "}
                    <span className="font-medium text-foreground">
                      {selectedRow.seatLabel}
                    </span>
                  </p>
                  <p>
                    Table :{" "}
                    <span className="font-medium text-foreground">
                      {selectedRow.tableName || "—"}
                    </span>
                  </p>
                  <p>
                    Espace :{" "}
                    <span className="font-medium text-foreground">
                      {selectedRow.spaceName}
                    </span>
                  </p>
                  <p>
                    Forfait :{" "}
                    <span className="font-medium text-foreground">
                      {priceOf(selectedRow.journal)?.name || "—"}
                    </span>
                  </p>
                  <p>
                    Arrivée :{" "}
                    <span className="font-medium text-foreground">
                      {format(
                        new Date(selectedRow.journal.registredTime),
                        "HH:mm"
                      )}
                    </span>
                  </p>
                  <p>
                    Reste :{" "}
                    <span
                      className={cn(
                        "font-medium",
                        selectedRow.overstay
                          ? "text-amber-700"
                          : "text-foreground"
                      )}
                    >
                      {formatRemain(selectedRow.remaining)}
                      {selectedRow.overstay ? " (dépassé)" : ""}
                    </span>
                  </p>
                </div>
                {(selectedRow.journal.memberID
                  ? subByMember.get(selectedRow.journal.memberID)
                  : null) || selectedSeatSubscription ? (
                  <div className="mt-3 rounded-md border border-violet-200 bg-violet-50/50 p-2 dark:border-violet-900 dark:bg-violet-950/20">
                    <p className="text-[10px] font-semibold uppercase text-violet-800 dark:text-violet-300">
                      Abonnement
                    </p>
                    {(() => {
                      const sub =
                        (selectedRow.journal.memberID
                          ? subByMember.get(selectedRow.journal.memberID)
                          : null) || selectedSeatSubscription;
                      if (!sub) return null;
                      const left = daysLeft(sub);
                      return (
                        <div className="mt-1 text-xs">
                          <p className="font-medium text-foreground">
                            {sub.members?.firstName || "Membre"} —{" "}
                            {sub.price?.name || "Abonnement"}
                          </p>
                          <p className="text-muted-foreground">
                            {sub.reservedSeatLabel
                              ? `Place réservée ${sub.reservedSeatLabel}`
                              : "Sans place dédiée"}
                            {left != null
                              ? ` · ${subscriptionExpiryLabel(left)}`
                              : ""}
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                ) : null}
                <Button
                  size="sm"
                  className="mt-3"
                  variant="outline"
                  onClick={() => setRelocateOpen(true)}
                >
                  Déplacer vers une autre place
                </Button>
              </div>
            ) : selectedSeatSubscription ? (
              <div className="rounded-lg border bg-card p-3 text-sm">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Place réservée (abonnement)
                </p>
                <p className="mt-1 font-bold">
                  {selectedSeatSubscription.members?.firstName || "Membre"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {subscriptionSummaryLine(selectedSeatSubscription)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Absent du journal aujourd&apos;hui
                </p>
              </div>
            ) : selectedSeatLabel ? (
              <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                Place {selectedSeatLabel} — libre
              </div>
            ) : null}

            {anonymousPresent.length > 0 ? (
              <p className="text-[11px] text-muted-foreground">
                {anonymousPresent.length} anonyme(s) présent(s) sans place —
                assignez depuis le journal après liaison membre.
              </p>
            ) : null}
            {reservedInSpace.length > 0 ? (
              <div className="rounded-lg border bg-muted/20 p-2">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                  Réservations abonnement ({reservedInSpace.length})
                </p>
                <div className="mt-1 max-h-24 space-y-1 overflow-y-auto">
                  {reservedInSpace.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className="flex w-full items-center justify-between rounded px-1 py-0.5 text-left text-xs hover:bg-muted/50"
                      onClick={() => {
                        setSelectedSeatLabel(a.reservedSeatLabel || null);
                      }}
                    >
                      <span>
                        {a.members?.firstName || "—"} · {a.reservedSeatLabel}
                      </span>
                      <span className="text-muted-foreground">
                        {subscriptionExpiryLabel(daysLeft(a))}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
