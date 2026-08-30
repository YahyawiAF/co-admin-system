"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Armchair,
  Building2,
  CalendarClock,
  DoorOpen,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FloorPlanCanvas } from "@/components/admin/FloorPlanCanvas";
import { mobileApi } from "@/lib/api/resources";
import { useOrg } from "@/lib/org";
import { useVisitorSession } from "@/lib/visitor-session";
import { useMobileStatus } from "@/lib/hooks/use-mobile-status";
import type { Space, SpaceSeat } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function ReservePage() {
  const { slug, href } = useOrg();
  const { memberId } = useVisitorSession();
  const { data: status } = useMobileStatus();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<"ROOM" | "SEAT">("ROOM");
  const [spaceId, setSpaceId] = useState("");
  const [seatLabel, setSeatLabel] = useState("");
  const [seatSpaceId, setSeatSpaceId] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:00");
  const visitorNumber = status?.member?.visitorNumber;
  const [note, setNote] = useState(
    visitorNumber != null ? `#${visitorNumber}` : ""
  );

  useEffect(() => {
    if (visitorNumber != null && !note) {
      setNote(`#${visitorNumber}`);
    }
  }, [visitorNumber, note]);

  const { data: layout } = useQuery({
    queryKey: ["mobile-floor-plan", slug],
    queryFn: () => mobileApi.floorPlan(slug),
  });

  const bookable = useMemo(
    () =>
      ((layout?.spaces || []) as Space[]).filter(
        (s) => s.openForReservation === true
      ),
    [layout?.spaces]
  );
  const rooms = useMemo(
    () =>
      bookable.filter(
        (s) => s.category === "SALLE" || s.category === "OPEN_SPACE"
      ),
    [bookable]
  );
  const seatSpaces = useMemo(
    () => bookable.filter((s) => (s.seats?.length || 0) > 0 || (s.tables || []).some((t) => (t.seats || []).length > 0)),
    [bookable]
  );
  const roomOptions = rooms.length ? rooms : bookable;
  const seatOptions = seatSpaces.length ? seatSpaces : bookable;
  const activeSpace =
    bookable.find((s) => s.id === (kind === "ROOM" ? spaceId : seatSpaceId)) ||
    bookable[0];

  useEffect(() => {
    if (kind === "ROOM" && !spaceId && roomOptions[0]) {
      setSpaceId(roomOptions[0].id);
    }
    if (kind === "SEAT" && !seatSpaceId && seatOptions[0]) {
      setSeatSpaceId(seatOptions[0].id);
    }
  }, [kind, spaceId, seatSpaceId, roomOptions, seatOptions]);

  const create = useMutation({
    mutationFn: () =>
      mobileApi.createBookingRequest({
        memberId: memberId!,
        kind,
        spaceId:
          kind === "ROOM"
            ? spaceId || roomOptions[0]?.id
            : seatSpaceId || undefined,
        seatLabel: kind === "SEAT" ? seatLabel : undefined,
        seatSpaceId:
          kind === "SEAT" ? seatSpaceId || activeSpace?.id : undefined,
        date,
        startTime,
        endTime,
        note,
      }),
    onSuccess: () => {
      toast.success("Demande envoyée à l’accueil");
      queryClient.invalidateQueries({ queryKey: ["my-bookings", memberId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSelectSeat = (seat: SpaceSeat) => {
    setSeatLabel(seat.label);
    setSeatSpaceId(seat.spaceId || activeSpace?.id || "");
  };

  if (!memberId) {
    return <p className="text-sm text-slate-500">Connectez-vous pour réserver.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-bold">Réserver</h1>
        <Button variant="ghost" size="sm" className="h-8 text-primary" asChild>
          <Link href={href("/reservations")}>
            <CalendarClock className="mr-1 h-4 w-4" />
            Mes demandes
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className={cn(
            "flex flex-col items-center gap-1.5 rounded-2xl border bg-white px-3 py-3 text-sm font-medium shadow-sm",
            kind === "ROOM"
              ? "border-primary bg-sky-50 text-primary"
              : "border-transparent text-slate-500"
          )}
          onClick={() => setKind("ROOM")}
        >
          <DoorOpen className="h-6 w-6" />
          Salle / open space
        </button>
        <button
          type="button"
          className={cn(
            "flex flex-col items-center gap-1.5 rounded-2xl border bg-white px-3 py-3 text-sm font-medium shadow-sm",
            kind === "SEAT"
              ? "border-primary bg-sky-50 text-primary"
              : "border-transparent text-slate-500"
          )}
          onClick={() => setKind("SEAT")}
        >
          <Armchair className="h-6 w-6" />
          Place
        </button>
      </div>

      {!bookable.length ? (
        <div className="rounded-2xl bg-white p-4 text-sm text-slate-500 shadow-sm">
          Aucun espace ouvert à la réservation pour le moment.
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <div className="space-y-2">
            <Label htmlFor="reserve-date">Jour</Label>
            <Input
              id="reserve-date"
              type="date"
              className="h-11"
              value={date}
              min={format(new Date(), "yyyy-MM-dd")}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="reserve-start">De</Label>
              <Input
                id="reserve-start"
                type="time"
                className="h-11"
                step={300}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reserve-end">À</Label>
              <Input
                id="reserve-end"
                type="time"
                className="h-11"
                step={300}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {kind === "ROOM" ? (
            <div>
              <Label>Espace</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {roomOptions.map((s) => (
                  <Button
                    key={s.id}
                    type="button"
                    size="sm"
                    variant={
                      (spaceId || roomOptions[0]?.id) === s.id
                        ? "default"
                        : "outline"
                    }
                    onClick={() => setSpaceId(s.id)}
                  >
                    <Building2 className="mr-1 h-3.5 w-3.5" />
                    {s.name}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <Label>Place</Label>
              {seatOptions.length > 1 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {seatOptions.map((s) => (
                    <Button
                      key={s.id}
                      type="button"
                      size="sm"
                      variant={
                        (seatSpaceId || seatOptions[0]?.id) === s.id
                          ? "default"
                          : "outline"
                      }
                      onClick={() => {
                        setSeatSpaceId(s.id);
                        setSeatLabel("");
                      }}
                    >
                      {s.name}
                    </Button>
                  ))}
                </div>
              ) : null}
              <div className="mt-2 h-[220px] overflow-hidden rounded-xl border">
                {activeSpace ? (
                  <FloorPlanCanvas
                    space={activeSpace}
                    bookings={layout?.bookings || []}
                    editMode={false}
                    variant="fit"
                    className="h-full min-h-0 rounded-none border-0"
                    selectedSeatId={
                      activeSpace.seats?.find((s) => s.label === seatLabel)
                        ?.id ||
                      activeSpace.tables
                        ?.flatMap((t) => t.seats || [])
                        .find((s) => s.label === seatLabel)?.id
                    }
                    onSelectSeat={onSelectSeat}
                  />
                ) : null}
              </div>
              {seatLabel ? (
                <p className="mt-1 text-sm font-medium">Place {seatLabel}</p>
              ) : (
                <p className="mt-1 text-xs text-slate-500">
                  Touchez une place sur le plan
                </p>
              )}
            </div>
          )}

          <div>
            <Label>Note</Label>
            <Textarea
              className="mt-1"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                visitorNumber != null ? `#${visitorNumber}` : "Atelier…"
              }
            />
          </div>
          <Button
            className="h-11 w-full rounded-full"
            disabled={
              create.isPending ||
              (kind === "SEAT" && !seatLabel) ||
              !date ||
              !startTime ||
              !endTime
            }
            onClick={() => create.mutate()}
          >
            Envoyer la demande
          </Button>
        </div>
      )}
    </div>
  );
}
