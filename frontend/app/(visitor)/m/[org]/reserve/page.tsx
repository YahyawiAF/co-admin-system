"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, addDays } from "date-fns";
import { Armchair, CalendarClock, DoorOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DayScroller } from "@/components/visitor/DayScroller";
import { SpaceGallery } from "@/components/visitor/SpaceGallery";
import { TableSeatPicker } from "@/components/visitor/TableSeatPicker";
import { mobileApi } from "@/lib/api/resources";
import { bookedLabelsForSpace } from "@/lib/seat-booking";
import { useOrg } from "@/lib/org";
import { useVisitorSession } from "@/lib/visitor-session";
import { useMobileStatus } from "@/lib/hooks/use-mobile-status";
import type { Space, SpaceSeat } from "@/lib/types";
import { cn } from "@/lib/utils";
import { spaceAllowsSeat, spaceAllowsWhole } from "@/lib/space-occupy";

export default function ReservePage() {
  const { slug, href } = useOrg();
  const { memberId, confirm } = useVisitorSession();
  const [guest, setGuest] = useState({ firstName: "", lastName: "", phone: "" });
  const [sent, setSent] = useState(false);
  const { data: status } = useMobileStatus();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<"ROOM" | "SEAT">("ROOM");
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [seatLabel, setSeatLabel] = useState("");
  const [focusTableId, setFocusTableId] = useState<string | null>(null);
  const [date, setDate] = useState(
    format(addDays(new Date(), 1), "yyyy-MM-dd")
  );
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
    () => bookable.filter((s) => spaceAllowsWhole(s)),
    [bookable]
  );
  const seatSpaces = useMemo(
    () =>
      bookable.filter(
        (s) =>
          spaceAllowsSeat(s) &&
          ((s.seats?.length || 0) > 0 ||
            (s.tables || []).some((t) => (t.seats || []).length > 0))
      ),
    [bookable]
  );
  const roomOptions = rooms.length ? rooms : bookable;
  const seatOptions = seatSpaces.length ? seatSpaces : bookable;
  const options = kind === "ROOM" ? roomOptions : seatOptions;
  const activeSpace = options.find((s) => s.id === spaceId) || null;
  const browsingAll = !spaceId && options.length > 0;

  useEffect(() => {
    if (kind === "ROOM" && !rooms.length && seatSpaces.length) {
      setKind("SEAT");
    }
    if (kind === "SEAT" && !seatSpaces.length && rooms.length) {
      setKind("ROOM");
    }
  }, [kind, rooms.length, seatSpaces.length]);

  useEffect(() => {
    setSpaceId(null);
    setSeatLabel("");
    setFocusTableId(null);
  }, [kind]);

  useEffect(() => {
    setFocusTableId(null);
  }, [spaceId]);

  useEffect(() => {
    if (spaceId && !options.some((s) => s.id === spaceId)) {
      setSpaceId(null);
      setSeatLabel("");
    }
  }, [options, spaceId]);

  const booked = useMemo(
    () =>
      bookedLabelsForSpace(layout?.bookings || [], activeSpace?.id || ""),
    [layout?.bookings, activeSpace?.id]
  );

  const create = useMutation({
    mutationFn: async () => {
      const booking = {
        kind,
        spaceId: spaceId || undefined,
        seatLabel: kind === "SEAT" ? seatLabel : undefined,
        seatSpaceId: kind === "SEAT" ? spaceId || undefined : undefined,
        date,
        startTime,
        endTime,
        note,
      };
      if (memberId) {
        await mobileApi.createBookingRequest({ memberId, ...booking });
        return memberId;
      }
      const res = await mobileApi.publicBookingRequest({
        orgSlug: slug,
        firstName: guest.firstName.trim(),
        lastName: guest.lastName.trim() || undefined,
        phone: guest.phone.trim(),
        ...booking,
      });
      confirm(res.member, res.accessToken);
      return res.member.id;
    },
    onSuccess: (id) => {
      toast.success("Demande envoyée à l’accueil");
      setSent(true);
      queryClient.invalidateQueries({ queryKey: ["my-bookings", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pickSpace = (id: string) => {
    if (spaceId === id) {
      setSpaceId(null);
      setSeatLabel("");
      return;
    }
    setSpaceId(id);
    setSeatLabel("");
  };

  const onSelectSeat = (seat: SpaceSeat) => {
    if (booked.has(seat.label)) return;
    setSeatLabel(seat.label);
    if (seat.spaceId) setSpaceId(seat.spaceId);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-bold">Réserver pour un autre jour</h1>
        {memberId ? (
          <Button variant="ghost" size="sm" className="h-8 text-primary" asChild>
            <Link href={href("/reservations")}>
              <CalendarClock className="mr-1 h-4 w-4" />
              Mes demandes
            </Link>
          </Button>
        ) : null}
      </div>

      {sent ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Demande envoyée. L&apos;accueil vous confirme rapidement
          {memberId ? (
            <>
              {" "}
              — suivez-la dans{" "}
              <Link href={href("/reservations")} className="font-medium underline">
                Mes demandes
              </Link>
            </>
          ) : null}
          .
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        {rooms.length ? (
          <button
            type="button"
            className={cn(
              "flex flex-col items-center gap-1 rounded-2xl border bg-white px-3 py-2.5 text-sm font-medium shadow-sm",
              kind === "ROOM"
                ? "border-primary bg-sky-50 text-primary"
                : "border-transparent text-slate-500",
              !seatSpaces.length && "col-span-2"
            )}
            onClick={() => setKind("ROOM")}
          >
            <DoorOpen className="h-5 w-5" />
            Espace entier
          </button>
        ) : null}
        {seatSpaces.length ? (
          <button
            type="button"
            className={cn(
              "flex flex-col items-center gap-1 rounded-2xl border bg-white px-3 py-2.5 text-sm font-medium shadow-sm",
              kind === "SEAT"
                ? "border-primary bg-sky-50 text-primary"
                : "border-transparent text-slate-500",
              !rooms.length && "col-span-2"
            )}
            onClick={() => setKind("SEAT")}
          >
            <Armchair className="h-5 w-5" />
            Par place
          </button>
        ) : null}
      </div>

      {!bookable.length ? (
        <div className="rounded-2xl bg-white p-4 text-sm text-slate-500 shadow-sm">
          Aucun espace ouvert à la réservation.
        </div>
      ) : (
        <div className="space-y-2.5">
          {/* Space selection — top */}
          <div className="rounded-2xl bg-white p-3 shadow-sm">
            <p className="text-[11px] font-medium text-slate-500">
              {spaceId
                ? "Espace — retouchez pour voir tous"
                : "1. Choisissez un espace"}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {options.map((s) => (
                <Button
                  key={s.id}
                  type="button"
                  size="sm"
                  className="h-9"
                  variant={spaceId === s.id ? "default" : "outline"}
                  onClick={() => pickSpace(s.id)}
                >
                  {s.name}
                </Button>
              ))}
            </div>
          </div>

          {browsingAll ? (
            <div className="grid gap-2">
              {options.map((s) => (
                <div
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => pickSpace(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      pickSpace(s.id);
                    }
                  }}
                  className="cursor-pointer overflow-hidden rounded-xl border bg-white text-left shadow-sm transition active:scale-[0.99]"
                >
                  <SpaceGallery
                    space={s}
                    className="rounded-none"
                    interactive={false}
                  />
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-sm font-semibold">{s.name}</span>
                    <span className="text-xs text-primary">Choisir ›</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {activeSpace ? (
                <SpaceGallery
                  key={activeSpace.id}
                  space={activeSpace}
                  tableId={kind === "SEAT" ? focusTableId : null}
                />
              ) : null}

              <div className="space-y-2.5 rounded-2xl bg-white p-3 shadow-sm">
                <DayScroller
                  value={date}
                  onChange={setDate}
                  minDate={format(addDays(new Date(), 1), "yyyy-MM-dd")}
                />
                <p className="text-[11px] text-slate-500">
                  Aujourd&apos;hui : réservez par téléphone auprès de l&apos;accueil.
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="reserve-start" className="text-xs">
                      De
                    </Label>
                    <Input
                      id="reserve-start"
                      type="time"
                      className="h-11"
                      step={300}
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="reserve-end" className="text-xs">
                      À
                    </Label>
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

                {kind === "SEAT" && activeSpace ? (
                  <div>
                    <TableSeatPicker
                      key={activeSpace.id}
                      space={activeSpace}
                      bookings={layout?.bookings || []}
                      selectedSeatId={
                        activeSpace.seats?.find((s) => s.label === seatLabel)
                          ?.id ||
                        activeSpace.tables
                          ?.flatMap((t) => t.seats || [])
                          .find((s) => s.label === seatLabel)?.id
                      }
                      onSelectSeat={onSelectSeat}
                      onTableChange={() => setSeatLabel("")}
                      onFocusTableChange={setFocusTableId}
                    />
                    <p className="mt-1.5 text-[11px] text-slate-500">
                      {seatLabel
                        ? `Place ${seatLabel}`
                        : "Table, puis place libre"}
                    </p>
                  </div>
                ) : null}

                <div>
                  <Label className="text-xs">Note</Label>
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
                {!memberId ? (
                  <div className="space-y-2 rounded-xl bg-slate-50 p-2.5">
                    <p className="text-[11px] font-medium text-slate-500">
                      Vos coordonnées (pour la confirmation)
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        className="h-11"
                        placeholder="Prénom"
                        autoComplete="given-name"
                        value={guest.firstName}
                        onChange={(e) =>
                          setGuest((g) => ({ ...g, firstName: e.target.value }))
                        }
                      />
                      <Input
                        className="h-11"
                        placeholder="Nom"
                        autoComplete="family-name"
                        value={guest.lastName}
                        onChange={(e) =>
                          setGuest((g) => ({ ...g, lastName: e.target.value }))
                        }
                      />
                    </div>
                    <Input
                      className="h-11"
                      type="tel"
                      inputMode="tel"
                      placeholder="Téléphone (ex. 22 123 456)"
                      autoComplete="tel"
                      value={guest.phone}
                      onChange={(e) =>
                        setGuest((g) => ({ ...g, phone: e.target.value }))
                      }
                    />
                    <p className="text-[11px] text-slate-500">
                      Déjà client ?{" "}
                      <Link href={href("/entry")} className="text-primary underline">
                        Connectez-vous
                      </Link>
                    </p>
                  </div>
                ) : null}
                <Button
                  className="h-11 w-full rounded-full"
                  disabled={
                    create.isPending ||
                    (!memberId &&
                      (!guest.firstName.trim() ||
                        guest.phone.replace(/\D/g, "").length < 8)) ||
                    !spaceId ||
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
