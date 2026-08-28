"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { FloorPlanCanvas } from "@/components/admin/FloorPlanCanvas";
import { bookingApi, facilityApi, mobileApi } from "@/lib/api/resources";
import { BOOKING_EVENT_KEY } from "@/lib/facility-spaces";
import type { Journal, SpaceSeat } from "@/lib/types";
import { memberOf } from "@/lib/journal-utils";

type Props = {
  journal: Journal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AssignSeatDialog({ journal, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [seatLabel, setSeatLabel] = useState<string | null>(null);
  const [allowOverflow, setAllowOverflow] = useState(false);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const member = journal ? memberOf(journal) : null;

  const { data: layout } = useQuery({
    queryKey: ["facility-layout"],
    queryFn: () => facilityApi.layout(),
    enabled: open,
  });
  const { data: occupancy } = useQuery({
    queryKey: ["facility-occupancy"],
    queryFn: () => facilityApi.occupancy(),
    enabled: open,
  });
  const { data: bookings = [] } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => bookingApi.list(),
    enabled: open,
  });

  const spaces = layout?.spaces || [];

  useEffect(() => {
    if (!open) return;
    if (!spaces.length) {
      setSpaceId(null);
      return;
    }
    if (!spaceId || !spaces.some((s) => s.id === spaceId)) {
      setSpaceId(spaces[0].id);
    }
  }, [open, spaces, spaceId]);

  const bookedBySeat = useMemo(() => {
    const map = new Map<string, (typeof bookings)[0]>();
    for (const b of bookings) {
      if (!b.isBooked) continue;
      if (b.spaceId && spaceId && b.spaceId !== spaceId) continue;
      map.set(b.seatId, b);
    }
    return map;
  }, [bookings, spaceId]);

  const currentBooking = useMemo(() => {
    if (!member?.id) return null;
    return bookings.find((b) => b.isBooked && b.memberId === member.id) || null;
  }, [bookings, member?.id]);

  useEffect(() => {
    if (!open || !currentBooking) return;
    setSeatLabel(currentBooking.seatId);
    if (currentBooking.spaceId) {
      setSpaceId(currentBooking.spaceId);
      return;
    }
    for (const space of spaces) {
      const all = [
        ...(space.seats || []),
        ...(space.tables || []).flatMap((t) => t.seats || []),
      ];
      if (all.some((s) => s.label === currentBooking.seatId)) {
        setSpaceId(space.id);
        break;
      }
    }
  }, [open, currentBooking, spaces]);

  const isFull = occupancy?.isFull ?? false;
  const showOverflow = isFull || allowOverflow;

  const activeSpace = useMemo(() => {
    const raw = spaces.find((s) => s.id === spaceId) || spaces[0] || null;
    if (!raw) return null;
    if (showOverflow) return raw;
    return {
      ...raw,
      seats: (raw.seats || []).filter((s) => !s.isOverflow),
      tables: (raw.tables || []).map((t) => ({
        ...t,
        seats: (t.seats || []).filter((s) => !s.isOverflow),
      })),
    };
  }, [spaces, spaceId, showOverflow]);

  const selectedSeatId = useMemo(() => {
    if (!seatLabel || !activeSpace) return null;
    const all = [
      ...(activeSpace.seats || []),
      ...(activeSpace.tables || []).flatMap((t) => t.seats || []),
    ];
    return all.find((s) => s.label === seatLabel)?.id || null;
  }, [seatLabel, activeSpace]);

  const assign = useMutation({
    mutationFn: async (nextLabel: string) => {
      if (currentBooking) {
        return mobileApi.moveSeat({
          memberId: member?.id,
          fromSeatLabel: currentBooking.seatId,
          fromSpaceId: currentBooking.spaceId,
          toSeatLabel: nextLabel,
          toSpaceId: activeSpace?.id,
        });
      }
      if (!member?.id) throw new Error("Membre manquant");
      const occupant = bookedBySeat.get(nextLabel);
      if (occupant && occupant.memberId !== member.id) {
        throw new Error("Cette place est déjà prise");
      }
      return bookingApi.create({
        eventKey: BOOKING_EVENT_KEY,
        seats: [nextLabel],
        memberId: member.id,
        spaceId: activeSpace?.id,
      });
    },
    onSuccess: () => {
      toast.success("Place assignée");
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["facility-occupancy"] });
      setSeatLabel(null);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const release = useMutation({
    mutationFn: () => {
      if (!currentBooking) throw new Error("Aucune place");
      return bookingApi.remove(currentBooking.id);
    },
    onSuccess: () => {
      toast.success("Place libérée");
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["facility-occupancy"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pickSeat = (seat: SpaceSeat) => {
    if (seat.isOverflow && !showOverflow) return;
    const booking = bookedBySeat.get(seat.label);
    if (booking && booking.memberId !== member?.id) {
      toast.error("Cette place est déjà prise");
      return;
    }
    setSeatLabel(seat.label);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setSeatLabel(null);
          setAllowOverflow(false);
        }
      }}
    >
      <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col gap-3 overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Assigner une place</DialogTitle>
          <DialogDescription>
            {member?.firstName || "Visiteur"}
            {member?.visitorNumber ? ` #${member.visitorNumber}` : ""}
            {currentBooking
              ? ` — actuellement : ${currentBooking.seatId}`
              : " — aucune place"}
            {seatLabel ? ` · sélection : ${seatLabel}` : ""}
          </DialogDescription>
        </DialogHeader>

        {isFull ? (
          <Badge className="w-fit bg-rose-600">
            Capacité pleine — overflow disponible
          </Badge>
        ) : (
          <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            <span>Afficher places overflow</span>
            <Switch
              checked={allowOverflow}
              onCheckedChange={setAllowOverflow}
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {spaces.map((s) => (
            <Button
              key={s.id}
              size="sm"
              variant={activeSpace?.id === s.id ? "default" : "outline"}
              onClick={() => {
                setSpaceId(s.id);
                setSeatLabel(null);
              }}
            >
              {s.name}
            </Button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-muted/20 p-2">
          {activeSpace ? (
            <FloorPlanCanvas
              space={activeSpace}
              bookings={bookings}
              editMode={false}
              selectedSeatId={selectedSeatId}
              onSelectSeat={pickSeat}
            />
          ) : (
            <p className="p-6 text-sm text-muted-foreground">
              Aucun espace — configurez Facility / Plan des places.
            </p>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Cliquez une place libre sur le plan, puis Assignez.
        </p>

        <DialogFooter className="gap-2 sm:justify-between">
          {currentBooking ? (
            <Button
              variant="outline"
              disabled={release.isPending}
              onClick={() => release.mutate()}
            >
              Libérer
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              disabled={
                !seatLabel ||
                seatLabel === currentBooking?.seatId ||
                assign.isPending
              }
              onClick={() => seatLabel && assign.mutate(seatLabel)}
            >
              {assign.isPending ? "…" : currentBooking ? "Déplacer" : "Assigner"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
