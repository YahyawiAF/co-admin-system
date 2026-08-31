"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FloorPlanCanvas } from "@/components/admin/FloorPlanCanvas";
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

  const spaces = (data?.spaces || []) as Space[];
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {selectable ? "Choisissez votre place" : "Votre place sur le plan"}
          </p>
          {assignedSeatLabel ? (
            <p className="text-sm font-semibold">
              {[activeSpace?.name, assignedSeatLabel].filter(Boolean).join(" · ")}
            </p>
          ) : selectable ? (
            <p className="text-sm text-slate-500">
              Touchez une place libre{pickOnly ? "." : ", puis confirmez."}
            </p>
          ) : seatMode === "ADMIN_ASSIGN" ? (
            <p className="text-sm text-slate-500">
              L&apos;accueil assigne votre place…
            </p>
          ) : seatMode === "AUTO_ASSIGN" ? (
            <p className="text-sm text-slate-500">Attribution automatique…</p>
          ) : null}
        </div>
        {assignedSeatLabel ? (
          <Badge variant="secondary">{assignedSeatLabel}</Badge>
        ) : null}
      </div>

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
      ) : activeSpace ? (
        <p className="text-xs font-medium text-slate-500">{activeSpace.name}</p>
      ) : null}

      <div className="h-[min(52vw,280px)] w-full overflow-hidden rounded-xl border bg-slate-50">
        {activeSpace ? (
          <FloorPlanCanvas
            space={activeSpace}
            bookings={bookings}
            editMode={false}
            variant="fit"
            className="h-full min-h-0 rounded-none border-0"
            selectedSeatId={selectedSeatId}
            onSelectSeat={selectable ? onSelectSeat : undefined}
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
