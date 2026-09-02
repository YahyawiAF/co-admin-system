"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TableSeatPicker } from "@/components/visitor/TableSeatPicker";
import { mobileApi, type SeatBooking } from "@/lib/api/resources";
import type { MobileSeatMode, Space, SpaceSeat } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useVisibleInterval } from "@/lib/hooks/use-page-visible";
import { useOrg } from "@/lib/org";

type Props = {
  memberId: string;
  assignedSeatLabel?: string | null;
  assignedSpaceId?: string | null;
  seatMode?: MobileSeatMode | null;
  canPick?: boolean;
  pickOnly?: boolean;
  allowedSpaceIds?: string[];
  onPicked?: (seat: SpaceSeat) => void;
  className?: string;
};

export function VisitorSeatMap({
  memberId,
  assignedSeatLabel,
  assignedSpaceId,
  seatMode,
  canPick = false,
  pickOnly = false,
  allowedSpaceIds,
  onPicked,
  className,
}: Props) {
  const { slug } = useOrg();
  const queryClient = useQueryClient();
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [pickedLabel, setPickedLabel] = useState<string | null>(null);
  const selectable = canPick || pickOnly;
  const poll = useVisibleInterval(selectable ? 20_000 : 60_000);

  const { data, isLoading } = useQuery({
    queryKey: ["mobile-floor-plan", slug],
    queryFn: () => mobileApi.floorPlan(slug),
    staleTime: 60_000,
    refetchInterval: poll,
  });

  const spaces = ((data?.spaces || []) as Space[]).filter(
    (s) => !allowedSpaceIds?.length || allowedSpaceIds.includes(s.id)
  );
  const bookings = (data?.bookings || []) as SeatBooking[];

  /** Space that contains the visitor's seat — only that one is shown when assigned. */
  const lockedSpaceId = useMemo(() => {
    if (assignedSpaceId && spaces.some((s) => s.id === assignedSpaceId)) {
      return assignedSpaceId;
    }
    if (!assignedSeatLabel) return null;
    for (const space of spaces) {
      const all = [
        ...(space.seats || []),
        ...(space.tables || []).flatMap((t) => t.seats || []),
      ];
      if (all.some((s) => s.label === assignedSeatLabel)) return space.id;
    }
    return null;
  }, [spaces, assignedSeatLabel, assignedSpaceId]);

  const showSpaceSwitcher = selectable && !lockedSpaceId && spaces.length > 1;

  useEffect(() => {
    if (!spaces.length) {
      setSpaceId(null);
      return;
    }
    if (lockedSpaceId) {
      setSpaceId(lockedSpaceId);
      return;
    }
    if (!spaceId || !spaces.some((s) => s.id === spaceId)) {
      setSpaceId(spaces[0].id);
    }
  }, [spaces, spaceId, lockedSpaceId]);

  const activeSpace =
    spaces.find((s) => s.id === (lockedSpaceId || spaceId)) ||
    spaces[0] ||
    null;

  const selectedSeatId = useMemo(() => {
    const label = selectable ? pickedLabel || assignedSeatLabel : assignedSeatLabel;
    if (!label || !activeSpace) return null;
    const all = [
      ...(activeSpace.seats || []),
      ...(activeSpace.tables || []).flatMap((t) => t.seats || []),
    ];
    return all.find((s) => s.label === label)?.id || null;
  }, [activeSpace, assignedSeatLabel, pickedLabel, selectable]);

  const claim = useMutation({
    mutationFn: (seatLabel: string) =>
      mobileApi.claimSeat(
        memberId,
        seatLabel,
        (lockedSpaceId || spaceId) || undefined,
        slug
      ),
    onSuccess: () => {
      toast.success("Place confirmée");
      queryClient.invalidateQueries({ queryKey: ["mobile-status"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-floor-plan"] });
      setPickedLabel(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSelectSeat = (seat: SpaceSeat) => {
    if (!selectable) return;
    const taken = bookings.some(
      (b) =>
        b.isBooked &&
        b.seatId === seat.label &&
        (!b.spaceId || b.spaceId === seat.spaceId) &&
        b.memberId !== memberId
    );
    if (taken) {
      toast.error("Cette place est déjà prise");
      return;
    }
    setPickedLabel(seat.label);
    onPicked?.(seat);
  };

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">Chargement du plan…</p>
    );
  }

  if (!spaces.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Plan des places non configuré.
      </p>
    );
  }

  return (
    <div className={cn("space-y-3 rounded-2xl border bg-white p-3", className)}>
      {selectable ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Choisissez votre place
            </p>
            <p className="text-sm text-slate-500">
              Touchez une table, puis une place libre.
            </p>
          </div>
        </div>
      ) : null}

      {showSpaceSwitcher ? (
        <div className="flex flex-wrap gap-2">
          {spaces.map((s) => (
            <Button
              key={s.id}
              size="sm"
              variant={activeSpace?.id === s.id ? "default" : "outline"}
              onClick={() => setSpaceId(s.id)}
            >
              {s.name}
            </Button>
          ))}
        </div>
      ) : null}

      <div className="overflow-hidden">
        {activeSpace ? (
          <TableSeatPicker
            space={activeSpace}
            bookings={bookings}
            selectedSeatId={selectedSeatId}
            onSelectSeat={selectable ? onSelectSeat : () => {}}
            onTableChange={() => setPickedLabel(null)}
            lockSeatLabel={!selectable ? assignedSeatLabel : null}
          />
        ) : null}
      </div>

      {canPick && !pickOnly ? (
        <Button
          className="h-11 w-full"
          disabled={!pickedLabel || claim.isPending}
          onClick={() => pickedLabel && claim.mutate(pickedLabel)}
        >
          {claim.isPending
            ? "Confirmation…"
            : pickedLabel
              ? `Confirmer la place ${pickedLabel}`
              : "Sélectionnez une place"}
        </Button>
      ) : null}
    </div>
  );
}
