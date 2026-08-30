"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MobileBackHome } from "@/components/visitor/MobileBackHome";
import { FloorPlanCanvas } from "@/components/admin/FloorPlanCanvas";
import { mobileApi } from "@/lib/api/resources";
import { useOrg } from "@/lib/org";
import { useVisitorSession } from "@/lib/visitor-session";
import type { Space, SpaceSeat } from "@/lib/types";

export default function ReservePage() {
  const { slug } = useOrg();
  const { memberId } = useVisitorSession();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<"ROOM" | "SEAT">("ROOM");
  const [spaceId, setSpaceId] = useState("");
  const [seatLabel, setSeatLabel] = useState("");
  const [seatSpaceId, setSeatSpaceId] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:00");
  const [note, setNote] = useState("");

  const { data: layout } = useQuery({
    queryKey: ["mobile-floor-plan", slug],
    queryFn: () => mobileApi.floorPlan(slug),
  });
  const { data: mine = [] } = useQuery({
    queryKey: ["my-bookings", memberId],
    queryFn: () => mobileApi.myBookingRequests(memberId!),
    enabled: !!memberId,
  });

  const spaces = (layout?.spaces || []) as Space[];
  const salles = useMemo(
    () => spaces.filter((s) => s.category === "SALLE"),
    [spaces]
  );
  const rooms = salles.length ? salles : spaces;
  const activeSpace =
    spaces.find((s) => s.id === (kind === "ROOM" ? spaceId : seatSpaceId)) ||
    spaces[0];

  useEffect(() => {
    if (kind === "ROOM" && !spaceId && rooms[0]) setSpaceId(rooms[0].id);
    if (kind === "SEAT" && !seatSpaceId && spaces[0]) {
      setSeatSpaceId(spaces[0].id);
    }
  }, [kind, spaceId, seatSpaceId, rooms, spaces]);

  const create = useMutation({
    mutationFn: () =>
      mobileApi.createBookingRequest({
        memberId: memberId!,
        kind,
        spaceId: kind === "ROOM" ? spaceId || rooms[0]?.id : seatSpaceId || undefined,
        seatLabel: kind === "SEAT" ? seatLabel : undefined,
        seatSpaceId: kind === "SEAT" ? seatSpaceId || activeSpace?.id : undefined,
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

  const cancel = useMutation({
    mutationFn: (id: string) =>
      mobileApi.cancelBookingRequest(id, memberId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-bookings", memberId] });
    },
  });

  const onSelectSeat = (seat: SpaceSeat) => {
    setSeatLabel(seat.label);
    setSeatSpaceId(seat.spaceId || activeSpace?.id || "");
  };

  if (!memberId) {
    return <p className="text-sm text-slate-500">Connectez-vous pour réserver.</p>;
  }

  return (
    <div className="space-y-4">
      <MobileBackHome />
      <h1 className="text-xl font-bold">Réserver</h1>
      <p className="text-sm text-slate-500">
        Salle de réunion ou une place, pour un créneau. L’accueil confirme.
      </p>
      <div className="flex gap-1 rounded-full bg-slate-200/70 p-1 text-sm">
        <button
          type="button"
          className={
            kind === "ROOM"
              ? "flex-1 rounded-full bg-white py-1.5 font-medium shadow-sm"
              : "flex-1 rounded-full py-1.5 text-slate-500"
          }
          onClick={() => setKind("ROOM")}
        >
          Salle
        </button>
        <button
          type="button"
          className={
            kind === "SEAT"
              ? "flex-1 rounded-full bg-white py-1.5 font-medium shadow-sm"
              : "flex-1 rounded-full py-1.5 text-slate-500"
          }
          onClick={() => setKind("SEAT")}
        >
          Place
        </button>
      </div>

      <div className="space-y-3 rounded-2xl bg-white p-4">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Jour</Label>
            <Input
              className="mt-1"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div />
          <div>
            <Label>De</Label>
            <Input
              className="mt-1"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div>
            <Label>À</Label>
            <Input
              className="mt-1"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>

        {kind === "ROOM" ? (
          <div>
            <Label>Salle</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {rooms.map((s) => (
                <Button
                  key={s.id}
                  type="button"
                  size="sm"
                  variant={
                    (spaceId || rooms[0]?.id) === s.id ? "default" : "outline"
                  }
                  onClick={() => setSpaceId(s.id)}
                >
                  {s.name}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <Label>Place</Label>
            {spaces.length > 1 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {spaces.map((s) => (
                  <Button
                    key={s.id}
                    type="button"
                    size="sm"
                    variant={
                      (seatSpaceId || spaces[0]?.id) === s.id
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
                    activeSpace.seats?.find((s) => s.label === seatLabel)?.id ||
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
            ) : null}
          </div>
        )}

        <div>
          <Label>Note</Label>
          <Textarea
            className="mt-1"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Atelier, réunion…"
          />
        </div>
        <Button
          className="h-11 w-full rounded-full"
          disabled={create.isPending || (kind === "SEAT" && !seatLabel)}
          onClick={() => create.mutate()}
        >
          Envoyer la demande
        </Button>
      </div>

      {mine.length ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase text-slate-400">
            Vos demandes
          </p>
          {mine.map((b) => (
            <div
              key={b.id}
              className="rounded-2xl bg-white px-4 py-3 text-sm shadow-sm"
            >
              <p className="font-medium">
                {b.kind === "ROOM" ? b.spaceName || "Salle" : `Place ${b.seatLabel}`}
              </p>
              <p className="text-slate-500">
                {format(new Date(b.startAt), "d MMM HH:mm", { locale: fr })} →{" "}
                {format(new Date(b.endAt), "HH:mm", { locale: fr })} ·{" "}
                {b.status === "PENDING"
                  ? "en attente"
                  : b.status === "APPROVED"
                    ? "acceptée"
                    : "refusée"}
              </p>
              {b.status === "PENDING" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1 h-8 px-0 text-rose-600"
                  onClick={() => cancel.mutate(b.id)}
                >
                  Annuler
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
