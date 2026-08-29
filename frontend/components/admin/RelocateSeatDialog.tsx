"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FloorPlanCanvas } from "@/components/admin/FloorPlanCanvas";
import { bookingApi, facilityApi, mobileApi } from "@/lib/api/resources";
import type { SeatOccupant, Space, SpaceSeat } from "@/lib/types";

type Props = {
  occupants: SeatOccupant[];
  /** Prefer a different space than this one. */
  blockedSpaceName?: string | null;
  onMoved?: () => void;
};

export function RelocateSeatDialog({
  occupants,
  blockedSpaceName,
  onMoved,
}: Props) {
  const queryClient = useQueryClient();
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [activeFrom, setActiveFrom] = useState<string | null>(
    occupants[0]?.seatLabel || null
  );

  const { data: layout } = useQuery({
    queryKey: ["facility-layout"],
    queryFn: () => facilityApi.layout(),
  });
  const { data: bookings = [] } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => bookingApi.list(),
  });

  const spaces = layout?.spaces || [];
  const allTargetsPicked = occupants.every((o) => !!targets[o.seatLabel]);

  useEffect(() => {
    if (!spaces.length) return;
    const other =
      spaces.find((s) => s.name !== blockedSpaceName) || spaces[0];
    if (!spaceId || !spaces.some((s) => s.id === spaceId)) {
      setSpaceId(other.id);
    }
  }, [spaces, spaceId, blockedSpaceName]);

  useEffect(() => {
    if (!occupants.length) return;
    if (!activeFrom || !occupants.some((o) => o.seatLabel === activeFrom)) {
      setActiveFrom(occupants[0].seatLabel);
    }
  }, [occupants, activeFrom]);

  const activeSpace = useMemo(
    () => spaces.find((s) => s.id === spaceId) || spaces[0] || null,
    [spaces, spaceId]
  );

  const selectedSeatId = useMemo(() => {
    const label = activeFrom ? targets[activeFrom] : null;
    if (!label || !activeSpace) return null;
    const all = seatsOf(activeSpace);
    return all.find((s) => s.label === label)?.id || null;
  }, [targets, activeFrom, activeSpace]);

  const move = useMutation({
    mutationFn: async () => {
      for (const occ of occupants) {
        const to = targets[occ.seatLabel];
        if (!to) throw new Error(`Choisissez une place pour ${occ.name}`);
        await mobileApi.moveSeat({
          memberId: occ.memberId || undefined,
          fromSeatLabel: occ.seatLabel,
          fromSpaceId: spaceId || undefined,
          toSeatLabel: to,
          toSpaceId: spaceId || undefined,
        });
      }
    },
    onSuccess: () => {
      toast.success("Visiteur déplacé");
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["facility-occupancy"] });
      queryClient.invalidateQueries({ queryKey: ["journal"] });
      setTargets({});
      onMoved?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pickSeat = (seat: SpaceSeat) => {
    if (!activeFrom) return;
    const booked = bookings.find(
      (b) =>
        b.isBooked &&
        b.seatId === seat.label &&
        (!b.spaceId || !activeSpace || b.spaceId === activeSpace.id)
    );
    if (booked) {
      toast.error("Cette place est déjà prise");
      return;
    }
    setTargets((prev) => ({ ...prev, [activeFrom]: seat.label }));
    toast.message(`Cible : ${seat.label} — confirmez en bas`);
  };

  if (!occupants.length) return null;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-2 overflow-hidden rounded-xl border border-amber-300 bg-amber-50/60 p-3">
      <Alert className="shrink-0">
        <AlertDescription>
          Cliquez une place <strong>libre</strong> sur le plan, puis{" "}
          <strong>Confirmer le déplacement</strong> en bas.
        </AlertDescription>
      </Alert>
      <div className="max-h-28 shrink-0 space-y-1 overflow-y-auto">
        {occupants.map((o) => (
          <button
            key={o.seatLabel}
            type="button"
            onClick={() => setActiveFrom(o.seatLabel)}
            className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${
              activeFrom === o.seatLabel
                ? "border-primary bg-primary/5"
                : "bg-background"
            }`}
          >
            <span>
              <strong>{o.name}</strong>
              <span className="text-muted-foreground">
                {" "}
                · {o.seatLabel}
                {o.spaceName ? ` · ${o.spaceName}` : ""}
              </span>
            </span>
            {targets[o.seatLabel] ? (
              <Badge>→ {targets[o.seatLabel]}</Badge>
            ) : (
              <span className="text-xs text-muted-foreground">cible ?</span>
            )}
          </button>
        ))}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {spaces.map((s) => (
          <Button
            key={s.id}
            size="sm"
            variant={spaceId === s.id ? "default" : "outline"}
            onClick={() => setSpaceId(s.id)}
          >
            {s.name}
          </Button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-muted/20">
        {activeSpace ? (
          <FloorPlanCanvas
            space={activeSpace}
            bookings={bookings}
            editMode={false}
            variant="fit"
            className="h-full min-h-0 rounded-none border-0"
            selectedSeatId={selectedSeatId}
            onSelectSeat={pickSeat}
          />
        ) : (
          <p className="p-4 text-sm text-muted-foreground">Aucun espace</p>
        )}
      </div>
      <div className="shrink-0 space-y-2 border-t border-amber-200 bg-amber-50/90 pt-2">
        {!allTargetsPicked ? (
          <p className="text-xs text-muted-foreground">
            Choisissez d&apos;abord une place cible (cercle vert) sur le plan.
          </p>
        ) : (
          <p className="text-xs text-emerald-700">
            Place cible sélectionnée. Confirmez pour déplacer.
          </p>
        )}
        <Button
          className="w-full"
          size="lg"
          disabled={move.isPending || !allTargetsPicked}
          onClick={() => move.mutate()}
        >
          {move.isPending ? "Déplacement…" : "Confirmer le déplacement"}
        </Button>
      </div>
    </div>
  );
}

function seatsOf(space: Space): SpaceSeat[] {
  return [
    ...(space.seats || []),
    ...(space.tables || []).flatMap((t) => t.seats || []),
  ];
}
