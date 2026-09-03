"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SpaceGallery } from "@/components/visitor/SpaceGallery";
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
  /** When space selection changes (null = all spaces). */
  onSpaceChange?: (spaceId: string | null) => void;
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
  onSpaceChange,
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
  const browsingAll = showSpaceSwitcher && !spaceId;

  useEffect(() => {
    if (!spaces.length) {
      setSpaceId(null);
      return;
    }
    if (lockedSpaceId) {
      setSpaceId(lockedSpaceId);
      return;
    }
    if (spaceId && !spaces.some((s) => s.id === spaceId)) {
      setSpaceId(null);
    }
    if (!showSpaceSwitcher && !spaceId && spaces[0]) {
      setSpaceId(spaces[0].id);
    }
  }, [spaces, spaceId, lockedSpaceId, showSpaceSwitcher]);

  useEffect(() => {
    onSpaceChange?.(lockedSpaceId || spaceId);
  }, [lockedSpaceId, spaceId, onSpaceChange]);

  const activeSpace =
    spaces.find((s) => s.id === (lockedSpaceId || spaceId)) ||
    (!showSpaceSwitcher ? spaces[0] : null) ||
    null;

  const selectedSeatId = useMemo(() => {
    const label = selectable
      ? pickedLabel || assignedSeatLabel
      : assignedSeatLabel;
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

  const pickSpace = (id: string) => {
    if (lockedSpaceId) return;
    if (spaceId === id) {
      setSpaceId(null);
      setPickedLabel(null);
      return;
    }
    setSpaceId(id);
    setPickedLabel(null);
  };

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
    <div className={cn("space-y-2.5 rounded-2xl border bg-white p-2.5", className)}>
      {selectable && !browsingAll ? (
        <p className="px-0.5 text-[11px] font-medium text-slate-500">
          {showSpaceSwitcher
            ? "Retouchez l’espace pour revenir · table pour dézoomer"
            : "Table, puis place libre"}
        </p>
      ) : null}

      {showSpaceSwitcher ? (
        <div className="flex flex-wrap gap-1.5">
          {spaces.map((s) => (
            <Button
              key={s.id}
              size="sm"
              className="h-9"
              variant={spaceId === s.id ? "default" : "outline"}
              onClick={() => pickSpace(s.id)}
            >
              {s.name}
            </Button>
          ))}
        </div>
      ) : null}

      {browsingAll ? (
        <div className="grid gap-2">
          <p className="text-[11px] font-medium text-slate-500">
            Choisissez un espace
          </p>
          {spaces.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => pickSpace(s.id)}
              className="overflow-hidden rounded-xl border text-left transition active:scale-[0.99]"
            >
              <SpaceGallery space={s} className="rounded-none" />
            </button>
          ))}
        </div>
      ) : activeSpace ? (
        <div className="space-y-2">
          {selectable ? (
            <SpaceGallery space={activeSpace} className="rounded-xl" />
          ) : null}
          <TableSeatPicker
            space={activeSpace}
            bookings={bookings}
            selectedSeatId={selectedSeatId}
            onSelectSeat={selectable ? onSelectSeat : () => {}}
            onTableChange={() => setPickedLabel(null)}
            lockSeatLabel={!selectable ? assignedSeatLabel : null}
          />
        </div>
      ) : null}

      {canPick && !pickOnly ? (
        <Button
          className="h-11 w-full"
          disabled={!pickedLabel || claim.isPending}
          onClick={() => pickedLabel && claim.mutate(pickedLabel)}
        >
          {claim.isPending
            ? "Confirmation…"
            : pickedLabel
              ? `Confirmer ${pickedLabel}`
              : "Choisir une place"}
        </Button>
      ) : null}
    </div>
  );
}
