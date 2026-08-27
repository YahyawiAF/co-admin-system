"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FloorPlanCanvas } from "@/components/admin/FloorPlanCanvas";
import { bookingApi, facilityApi } from "@/lib/api/resources";
import type { SpaceSeat } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  selectedLabel?: string | null;
  onSelect?: (label: string | null) => void;
  currentMemberId?: string | null;
  highlightLabels?: string[];
  className?: string;
  allowOccupied?: boolean;
};

export function AbonnementSeatMap({
  selectedLabel,
  onSelect,
  currentMemberId,
  highlightLabels = [],
  className,
  allowOccupied = false,
}: Props) {
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const { data: layout } = useQuery({
    queryKey: ["facility-layout"],
    queryFn: () => facilityApi.layout(),
  });
  const { data: bookings = [] } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => bookingApi.list(),
  });

  const spaces = layout?.spaces || [];

  useEffect(() => {
    if (!spaces.length) {
      setSpaceId(null);
      return;
    }
    const matchLabel = selectedLabel || highlightLabels[0];
    if (matchLabel) {
      for (const space of spaces) {
        const all = [
          ...(space.seats || []),
          ...(space.tables || []).flatMap((t) => t.seats || []),
        ];
        if (all.some((s) => s.label === matchLabel)) {
          setSpaceId(space.id);
          return;
        }
      }
    }
    if (!spaceId || !spaces.some((s) => s.id === spaceId)) {
      setSpaceId(spaces[0].id);
    }
  }, [spaces, selectedLabel, highlightLabels, spaceId]);

  const bookedBySeat = useMemo(() => {
    const map = new Map<string, (typeof bookings)[0]>();
    for (const b of bookings) {
      if (b.isBooked) map.set(b.seatId, b);
    }
    return map;
  }, [bookings]);

  const activeSpace = spaces.find((s) => s.id === spaceId) || spaces[0] || null;

  const selectedSeatId = useMemo(() => {
    if (!selectedLabel || !activeSpace) return null;
    const all = [
      ...(activeSpace.seats || []),
      ...(activeSpace.tables || []).flatMap((t) => t.seats || []),
    ];
    return all.find((s) => s.label === selectedLabel)?.id || null;
  }, [selectedLabel, activeSpace]);

  const selectedSeatIds = useMemo(() => {
    if (!activeSpace || !highlightLabels.length) return [];
    const all = [
      ...(activeSpace.seats || []),
      ...(activeSpace.tables || []).flatMap((t) => t.seats || []),
    ];
    return all
      .filter((s) => highlightLabels.includes(s.label) && s.label !== selectedLabel)
      .map((s) => s.id);
  }, [activeSpace, highlightLabels, selectedLabel]);

  const pickSeat = (seat: SpaceSeat) => {
    if (!onSelect) return;
    const booking = bookedBySeat.get(seat.label);
    if (
      !allowOccupied &&
      booking &&
      booking.memberId &&
      booking.memberId !== currentMemberId
    ) {
      toast.error("Cette place est déjà prise");
      return;
    }
    onSelect(seat.label === selectedLabel ? null : seat.label);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap gap-2">
        {spaces.map((s) => (
          <Button
            key={s.id}
            type="button"
            size="sm"
            variant={activeSpace?.id === s.id ? "default" : "outline"}
            onClick={() => setSpaceId(s.id)}
          >
            {s.name}
          </Button>
        ))}
      </div>
      <div className="max-h-80 overflow-auto rounded-lg border bg-muted/20 p-2">
        {activeSpace ? (
          <FloorPlanCanvas
            space={activeSpace}
            bookings={bookings}
            editMode={false}
            selectedSeatId={selectedSeatId}
            selectedSeatIds={selectedSeatIds}
            onSelectSeat={pickSeat}
          />
        ) : (
          <p className="p-6 text-sm text-muted-foreground">
            Aucun espace — configurez le plan des places.
          </p>
        )}
      </div>
      {onSelect && selectedLabel ? (
        <p className="text-xs text-muted-foreground">
          Place sélectionnée : <span className="font-medium">{selectedLabel}</span>
        </p>
      ) : null}
    </div>
  );
}
