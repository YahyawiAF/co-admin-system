"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FloorPlanCanvas } from "@/components/admin/FloorPlanCanvas";
import { RelocateSeatDialog } from "@/components/admin/RelocateSeatDialog";
import {
  VisitTarifSpacePickers,
  type OccupyMode,
  type ReserveKind,
} from "@/components/admin/VisitTarifSpacePickers";
import { bookingApi, facilityApi, journalApi } from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import type { Journal, Price, SeatOccupant, Space, SpaceSeat } from "@/lib/types";
import { PriceCategory } from "@/lib/types";
import { spaceHasCategory } from "@/lib/tarif-labels";
import { isActiveVisit, visitorLabel } from "@/lib/journal-utils";

type Props = {
  prices: Price[];
  spaces: Space[];
  priceId: string;
  occupyMode: OccupyMode;
  onOccupyMode: (mode: OccupyMode) => void;
  seatLabel: string;
  seatLabels: string[];
  onSeatLabel: (label: string) => void;
  onSeatLabels: (labels: string[]) => void;
  reserveKind: ReserveKind;
  spaceId: string;
  tableId?: string;
  onReserve: (kind: ReserveKind, spaceId?: string, tableId?: string) => void;
  hours: string;
  onHours: (v: string) => void;
  blockers: SeatOccupant[];
  onBlockersCleared?: () => void;
};

export function CheckInOccupancyStep({
  prices,
  spaces,
  priceId,
  occupyMode,
  onOccupyMode,
  seatLabel,
  seatLabels,
  onSeatLabel,
  onSeatLabels,
  reserveKind,
  spaceId,
  tableId,
  onReserve,
  hours,
  onHours,
  blockers,
  onBlockersCleared,
}: Props) {
  const [mapSpaceId, setMapSpaceId] = useState<string | null>(null);

  const { data: layout } = useQuery({
    queryKey: ["facility-layout"],
    queryFn: () => facilityApi.layout(),
  });
  const { data: bookings = [] } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => bookingApi.list(),
  });
  const day = useMemo(() => new Date(), []);
  const { data: journalPage } = useQuery({
    queryKey: queryKeys.journal(day),
    queryFn: () => journalApi.list({ journalDate: day, perPage: 200 }),
  });
  const [localBlockers, setLocalBlockers] = useState<SeatOccupant[]>([]);

  const allSpaces = layout?.spaces || spaces;

  useEffect(() => {
    if (!allSpaces.length) return;
    if (!mapSpaceId || !allSpaces.some((s) => s.id === mapSpaceId)) {
      setMapSpaceId(allSpaces[0].id);
    }
  }, [allSpaces, mapSpaceId]);

  const activeSpace = useMemo(
    () => allSpaces.find((s) => s.id === mapSpaceId) || allSpaces[0] || null,
    [allSpaces, mapSpaceId]
  );

  const selectedIds = useMemo(() => {
    if (!activeSpace) return [];
    const wanted =
      occupyMode === "group"
        ? seatLabels
        : occupyMode === "bureau" && seatLabel
          ? [seatLabel]
          : [];
    const all = [
      ...(activeSpace.seats || []),
      ...(activeSpace.tables || []).flatMap((t) => t.seats || []),
    ];
    return all.filter((s) => wanted.includes(s.label)).map((s) => s.id);
  }, [activeSpace, occupyMode, seatLabel, seatLabels]);

  const pickSeat = (seat: SpaceSeat) => {
    const taken = bookings.find(
      (b) =>
        b.isBooked &&
        b.seatId === seat.label &&
        (!b.spaceId || !activeSpace || b.spaceId === activeSpace.id)
    );
    if (taken) {
      toast.error("Cette place est déjà prise");
      return;
    }
    if (occupyMode === "bureau") {
      onSeatLabel(seat.label);
      onSeatLabels([]);
      return;
    }
    if (occupyMode === "group") {
      const next = seatLabels.includes(seat.label)
        ? seatLabels.filter((l) => l !== seat.label)
        : [...seatLabels, seat.label];
      onSeatLabels(next);
      onSeatLabel("");
    }
  };

  const handleWholeReserve = (
    kind: ReserveKind,
    id?: string,
    table?: string
  ) => {
    onReserve(kind, id, table);
    if (kind === "none" || table) {
      setLocalBlockers([]);
      return;
    }
    const labels = seatLabelsForSelection(allSpaces, kind, id);
    const occ = occupantsOnSeats(
      labels,
      bookings,
      journalPage?.data || []
    );
    if (occ.length) {
      const preview = occ
        .slice(0, 4)
        .map((o) => o.seatLabel)
        .join(", ");
      toast.warning(
        `${occ.length} place(s) déjà réservées (${preview}${
          occ.length > 4 ? "…" : ""
        }). Déplacez-les avant de réserver tout l’espace.`
      );
      setLocalBlockers(occ);
    } else {
      setLocalBlockers([]);
    }
  };

  const shownBlockers = blockers.length ? blockers : localBlockers;

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base">Occupation</Label>
        <p className="text-xs text-muted-foreground">
          Indépendant du tarif : une place bureau, un groupe, ou tout un
          espace.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {(
          [
            { id: "bureau", label: "Bureau", hint: "1 place sur le plan" },
            { id: "group", label: "Groupe", hint: "N places (N lignes)" },
            { id: "whole", label: "Espace entier", hint: "Toutes les places" },
          ] as const
        ).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              onOccupyMode(m.id);
              onSeatLabel("");
              onSeatLabels([]);
              if (m.id !== "whole") onReserve("none");
            }}
            className={cn(
              "rounded-xl border px-3 py-3 text-left transition-colors",
              occupyMode === m.id
                ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                : "hover:border-primary/50"
            )}
          >
            <div className="font-semibold">{m.label}</div>
            <div className="text-xs text-muted-foreground">{m.hint}</div>
          </button>
        ))}
      </div>

      {occupyMode === "bureau" || occupyMode === "group" ? (
        <>
          <div className="flex flex-wrap gap-2">
            {allSpaces.map((s) => (
              <Button
                key={s.id}
                size="sm"
                variant={mapSpaceId === s.id ? "default" : "outline"}
                onClick={() => setMapSpaceId(s.id)}
              >
                {s.name}
              </Button>
            ))}
          </div>
          {occupyMode === "group" ? (
            <div className="text-xs text-muted-foreground">
              Cliquez les places libres.{" "}
              {seatLabels.length ? (
                <Badge variant="secondary">{seatLabels.length} sélectionnée(s)</Badge>
              ) : (
                "Aucune sélection."
              )}
            </div>
          ) : seatLabel ? (
            <p className="text-xs text-primary">Place : {seatLabel}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Cliquez une place libre (open space ou salle).
            </p>
          )}
          <div className="min-h-[min(52vh,520px)] overflow-hidden rounded-lg border bg-muted/20 p-1">
            {activeSpace ? (
              <FloorPlanCanvas
                space={activeSpace}
                bookings={bookings}
                editMode={false}
                variant="picker"
                className="h-full min-h-[min(52vh,520px)]"
                selectedSeatIds={selectedIds}
                onSelectSeat={pickSeat}
              />
            ) : (
              <p className="p-4 text-sm text-muted-foreground">
                Aucun espace — configurez Facility / Plan des places.
              </p>
            )}
          </div>
        </>
      ) : (
        <VisitTarifSpacePickers
          prices={prices}
          spaces={allSpaces}
          priceId={priceId}
          onPriceId={() => undefined}
          reserveKind={reserveKind}
          spaceId={spaceId}
          tableId={tableId}
          onReserve={handleWholeReserve}
          hours={hours}
          onHours={onHours}
          showTarif={false}
          showSpace
        />
      )}

      {shownBlockers.length ? (
        <RelocateSeatDialog
          occupants={shownBlockers}
          blockedSpaceName={
            allSpaces.find((s) => s.id === spaceId)?.name || null
          }
          onMoved={() => {
            setLocalBlockers([]);
            onBlockersCleared?.();
          }}
        />
      ) : null}
    </div>
  );
}

function seatLabelsForSelection(
  spaces: Space[],
  kind: ReserveKind,
  spaceId?: string
) {
  let target = spaces;
  if (kind === "space" && spaceId) {
    target = spaces.filter((s) => s.id === spaceId);
  } else if (kind === "open") {
    target = spaces.filter((s) =>
      spaceHasCategory(s, PriceCategory.OPEN_SPACE)
    );
  } else if (kind === "salle") {
    target = spaces.filter((s) => spaceHasCategory(s, PriceCategory.SALLE));
  } else if (kind !== "all") {
    return [];
  }
  return target.flatMap((s) => [
    ...(s.seats || [])
      .filter((seat) => seat.isActive && !seat.isOverflow)
      .map((seat) => seat.label),
    ...(s.tables || []).flatMap((t) =>
      (t.seats || [])
        .filter((seat) => seat.isActive && !seat.isOverflow)
        .map((seat) => seat.label)
    ),
  ]);
}

function occupantsOnSeats(
  labels: string[],
  bookings: { isBooked: boolean; seatId: string; memberId?: string | null }[],
  journals: Journal[]
): SeatOccupant[] {
  const set = new Set(labels);
  const presentByMember = new Map<string, Journal>();
  for (const j of journals) {
    if (!isActiveVisit(j) || !j.memberID) continue;
    presentByMember.set(j.memberID, j);
  }
  const list: SeatOccupant[] = [];
  for (const b of bookings) {
    if (!b.isBooked || !set.has(b.seatId)) continue;
    const j = b.memberId ? presentByMember.get(b.memberId) : undefined;
    list.push({
      memberId: b.memberId,
      name: j ? visitorLabel(j) : "Visiteur",
      seatLabel: b.seatId,
      spaceName: null,
    });
  }
  return list;
}
