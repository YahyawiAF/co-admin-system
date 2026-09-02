"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FloorPlanCanvas } from "@/components/admin/FloorPlanCanvas";
import {
  bookingApi,
  facilityApi,
  visitRequestsApi,
} from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import { useRealtime } from "@/lib/realtime/RealtimeProvider";
import type { MobileSeatMode, SpaceSeat, VisitRequest } from "@/lib/types";
import {
  priceAllowsWholeIn,
  spacesForPrice,
} from "@/lib/space-occupy";

function isHoursPoolRequest(req: VisitRequest | null) {
  return (
    req?.type === "SUBSCRIPTION" && req.price?.billingUnit === "HOURLY"
  );
}

function isPeriodSubRequest(req: VisitRequest | null) {
  if (!req || req.type !== "SUBSCRIPTION") return false;
  return req.price?.billingUnit !== "HOURLY";
}

function skipsSeat(req: VisitRequest | null) {
  if (!req) return false;
  if (isHoursPoolRequest(req)) return true;
  if (isPeriodSubRequest(req)) return false;
  if (req.occupyWhole) return true;
  if (req.price?.occupyWhole && req.price?.occupySeat === false) return true;
  return false;
}

function wantsWholeSpace(req: VisitRequest | null) {
  if (!req) return false;
  return (
    !!req.occupyWhole ||
    (!!req.price?.occupyWhole && req.price?.occupySeat === false)
  );
}

export function VisitRequestBell() {
  const queryClient = useQueryClient();
  const { socket } = useRealtime();
  const [current, setCurrent] = useState<VisitRequest | null>(null);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [seatLabel, setSeatLabel] = useState<string | null>(null);
  const [allowOverflow, setAllowOverflow] = useState(false);

  const { data: pending = [] } = useQuery({
    queryKey: queryKeys.visitRequestsPending,
    queryFn: () => visitRequestsApi.pending(),
    refetchInterval: 10_000,
  });

  const { data: layout } = useQuery({
    queryKey: ["facility-layout"],
    queryFn: () => facilityApi.layout(),
    enabled: !!current,
  });
  const { data: occupancy } = useQuery({
    queryKey: ["facility-occupancy"],
    queryFn: () => facilityApi.occupancy(),
    enabled: !!current,
  });
  const { data: bookings = [] } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => bookingApi.list(),
    enabled: !!current,
  });
  const { data: seatSettings } = useQuery({
    queryKey: ["mobile-seat-settings"],
    queryFn: () => facilityApi.list().then(async (list) => {
      const f = list[0];
      return {
        mobileSeatMode: (f?.mobileSeatMode || "ADMIN_ASSIGN") as MobileSeatMode,
        receptionAway: !!f?.receptionAway,
      };
    }),
  });
  const seatMode: MobileSeatMode = seatSettings?.mobileSeatMode || "ADMIN_ASSIGN";
  const needsAdminSeat =
    isPeriodSubRequest(current) ||
    (seatMode === "ADMIN_ASSIGN" && !skipsSeat(current));
  const autoSeat = seatMode === "AUTO_ASSIGN";

  const spaces = layout?.spaces || [];
  const visibleSpaces = current?.price
    ? spacesForPrice(spaces, current.price)
    : spaces;

  useEffect(() => {
    if (!visibleSpaces.length) {
      setSpaceId(null);
      return;
    }
    if (!spaceId || !visibleSpaces.some((s) => s.id === spaceId)) {
      setSpaceId(visibleSpaces[0].id);
    }
  }, [visibleSpaces, spaceId]);

  useEffect(() => {
    if (!socket) return;
    const onRequest = (payload: VisitRequest) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.visitRequestsPending });
      setCurrent(payload);
      setSeatLabel(null);
      toast.info("Nouvelle demande de visite");
    };
    socket.on("visit_request", onRequest);
    return () => {
      socket.off("visit_request", onRequest);
    };
  }, [socket, queryClient]);

  useEffect(() => {
    if (!pending.length) {
      setCurrent(null);
      return;
    }
    setCurrent((prev) => {
      if (prev && pending.some((p) => p.id === prev.id)) return prev;
      return pending[0];
    });
  }, [pending]);

  const bookedBySeat = useMemo(() => {
    const map = new Map<string, (typeof bookings)[0]>();
    for (const b of bookings) {
      if (!b.isBooked) continue;
      if (b.spaceId && spaceId && b.spaceId !== spaceId) continue;
      map.set(b.seatId, b);
    }
    return map;
  }, [bookings, spaceId]);

  const isFull = occupancy?.isFull ?? false;
  const showOverflow = isFull || allowOverflow;

  const spaceStats = useMemo(() => {
    return visibleSpaces.map((space) => {
      const seats = [
        ...(space.seats || []).filter((s) => s.isActive),
        ...(space.tables || []).flatMap((t) =>
          (t.seats || []).filter((s) => s.isActive)
        ),
      ];
      // unique by id
      const byId = new Map(seats.map((s) => [s.id, s]));
      const unique = [...byId.values()];
      const normal = unique.filter((s) => !s.isOverflow);
      const overflow = unique.filter((s) => s.isOverflow);
      const freeNormal = normal.filter((s) => !bookedBySeat.has(s.label)).length;
      const freeOverflow = overflow.filter(
        (s) => !bookedBySeat.has(s.label)
      ).length;
      return {
        space,
        freeNormal,
        freeOverflow,
        normalTotal: normal.length,
        overflowTotal: overflow.length,
      };
    });
  }, [visibleSpaces, bookedBySeat]);

  const activeSpace = useMemo(() => {
    const raw =
      visibleSpaces.find((s) => s.id === spaceId) || visibleSpaces[0] || null;
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
  }, [visibleSpaces, spaceId, showOverflow]);

  const canBookWhole =
    !!current?.price &&
    !!activeSpace &&
    (wantsWholeSpace(current) ||
      priceAllowsWholeIn(current.price, activeSpace));

  const selectedSeatId = useMemo(() => {
    if (!seatLabel || !activeSpace) return null;
    const all = [
      ...(activeSpace.seats || []),
      ...(activeSpace.tables || []).flatMap((t) => t.seats || []),
    ];
    return all.find((s) => s.label === seatLabel)?.id || null;
  }, [seatLabel, activeSpace]);

  const approve = useMutation({
    mutationFn: ({
      id,
      seatLabel: seat,
      occupyWhole,
    }: {
      id: string;
      seatLabel?: string;
      occupyWhole?: boolean;
    }) =>
      visitRequestsApi.approve(id, {
        seatLabel: occupyWhole ? undefined : seat,
        spaceId: spaceId || undefined,
        occupyWhole,
      }),
    onSuccess: (_d, vars) => {
      toast.success(
        vars.seatLabel
          ? `Confirmé · place ${vars.seatLabel}`
          : "Demande confirmée"
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.visitRequestsPending });
      queryClient.invalidateQueries({ queryKey: ["journal"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["facility-occupancy"] });
      setCurrent(null);
      setSeatLabel(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: (id: string) => visitRequestsApi.reject(id),
    onSuccess: () => {
      toast.message("Demande refusée");
      queryClient.invalidateQueries({ queryKey: queryKeys.visitRequestsPending });
      setCurrent(null);
      setSeatLabel(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = approve.isPending || reject.isPending;

  const pickSeat = (seat: SpaceSeat) => {
    if (seat.isOverflow && !showOverflow) return;
    const booking = bookedBySeat.get(seat.label);
    if (booking) {
      toast.error("Cette place est déjà prise");
      return;
    }
    setSeatLabel(seat.label);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {pending.length > 0 ? (
              <Badge className="absolute -right-1 -top-1 h-5 min-w-5 justify-center rounded-full px-1 text-[10px]">
                {pending.length}
              </Badge>
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel>
            {pending.length
              ? `${pending.length} demande(s) en attente`
              : "Aucune demande"}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {pending.map((req) => (
            <div
              key={req.id}
              className="flex items-start justify-between gap-2 px-2 py-2"
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left text-sm"
                onClick={() => {
                  setCurrent(req);
                  setSeatLabel(null);
                }}
              >
                <p className="truncate font-medium">
                  {req.member?.firstName || "Visiteur"}
                  {req.member?.visitorNumber
                    ? ` #${req.member.visitorNumber}`
                    : ""}
                </p>
                <p className="truncate text-muted-foreground">
                  {req.price?.name} · {req.type}
                </p>
              </button>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-green-600"
                  disabled={busy}
                  onClick={() => {
                    if (needsAdminSeat && !skipsSeat(req)) {
                      setCurrent(req);
                      setSeatLabel(null);
                      toast.message("Choisissez une place sur le plan");
                      return;
                    }
                    approve.mutate({ id: req.id });
                  }}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive"
                  disabled={busy}
                  onClick={() => reject.mutate(req.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={!!current && current.status === "PENDING"}
        onOpenChange={(o) => {
          if (!o) {
            setCurrent(null);
            setSeatLabel(null);
          }
        }}
      >
        <DialogContent className="flex h-[min(94vh,900px)] w-[96vw] max-w-6xl flex-col gap-3 overflow-hidden sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              Demande de visite
              <Badge variant="outline" className="font-normal">
                {needsAdminSeat
                  ? "Place : admin"
                  : autoSeat
                    ? "Place : auto"
                    : "Place : visiteur"}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          {current ? (
            <div className="grid min-h-0 flex-1 gap-4 overflow-hidden text-sm lg:grid-cols-[1.35fr_1fr]">
              <div className="flex min-h-0 flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  {spaceStats.map(
                    ({
                      space,
                      freeNormal,
                      freeOverflow,
                      normalTotal,
                      overflowTotal,
                    }) => (
                      <Button
                        key={space.id}
                        size="sm"
                        variant={
                          activeSpace?.id === space.id ? "default" : "outline"
                        }
                        onClick={() => {
                          setSpaceId(space.id);
                          setSeatLabel(null);
                        }}
                      >
                        {space.name}
                        <span className="ml-1 opacity-80">
                          {freeNormal}/{normalTotal}
                          {overflowTotal
                            ? ` · X${freeOverflow}/${overflowTotal}`
                            : ""}
                        </span>
                      </Button>
                    )
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {activeSpace?.name || "Espace"} — cliquez une place libre
                  {seatLabel ? (
                    <span className="font-medium text-foreground">
                      {" "}
                      · sélection : {seatLabel}
                    </span>
                  ) : null}
                </p>
                <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-muted/20 p-1">
                  {activeSpace ? (
                    <FloorPlanCanvas
                      space={activeSpace}
                      bookings={bookings}
                      editMode={false}
                      variant="picker"
                      className="h-full min-h-[min(50vh,480px)]"
                      selectedSeatId={selectedSeatId}
                      onSelectSeat={pickSeat}
                    />
                  ) : (
                    <p className="p-4 text-muted-foreground">
                      Aucun plan d&apos;espace configuré.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
                <div className="grid gap-1 sm:grid-cols-1">
                  <p>
                    <span className="text-muted-foreground">Visiteur : </span>
                    {current.member?.firstName || "Visiteur"}
                    {current.member?.visitorNumber
                      ? ` #${current.member.visitorNumber}`
                      : ""}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Téléphone : </span>
                    {current.member?.phone || "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Forfait : </span>
                    {current.price?.name} ({current.price?.price} DT)
                  </p>
                  <p>
                    <span className="text-muted-foreground">Type : </span>
                    {current.type}
                  </p>
                </div>

                {occupancy ? (
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      Places {occupancy.normalOccupied}/
                      {occupancy.normalCapacity}
                    </Badge>
                    {occupancy.overflowCapacity > 0 ? (
                      <Badge variant="outline">
                        Overflow {occupancy.overflowOccupied}/
                        {occupancy.overflowCapacity}
                      </Badge>
                    ) : null}
                    {isFull ? (
                      <Badge className="bg-rose-600">Complet</Badge>
                    ) : null}
                  </div>
                ) : null}

                <div className="space-y-2 rounded-lg border p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Places restantes par espace
                  </p>
                  {!isFull ? (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={allowOverflow}
                        onChange={(e) => setAllowOverflow(e.target.checked)}
                      />
                      Afficher places overflow
                    </label>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {isPeriodSubRequest(current)
                      ? "Abonnement période : choisissez la place réservée (toujours à eux)."
                      : isHoursPoolRequest(current)
                        ? "Abonnement heures : pas de place maintenant. Après le scan, attribuez-la comme un visiteur."
                        : needsAdminSeat
                          ? "Mode admin : sélectionnez une place puis confirmez."
                          : autoSeat
                            ? "Mode auto : une place libre sera attribuée à la confirmation."
                            : "Mode visiteur : le client choisira sa place après confirmation."}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="outline"
              disabled={busy || !current}
              onClick={() => current && reject.mutate(current.id)}
            >
              Refuser
            </Button>
            <div className="flex flex-wrap gap-2">
              {canBookWhole && current ? (
                <Button
                  variant={wantsWholeSpace(current) ? "default" : "secondary"}
                  disabled={busy || !(spaceId || current.spaceId)}
                  onClick={() =>
                    approve.mutate({
                      id: current.id,
                      occupyWhole: true,
                    })
                  }
                >
                  Réserver tout l’espace
                </Button>
              ) : null}
              {!needsAdminSeat && !wantsWholeSpace(current) ? (
                <Button
                  disabled={busy || !current}
                  onClick={() => current && approve.mutate({ id: current.id })}
                >
                  {autoSeat ? "Confirmer (place auto)" : "Confirmer"}
                </Button>
              ) : null}
              {!wantsWholeSpace(current) && (needsAdminSeat || seatLabel) ? (
                <Button
                  disabled={busy || !current || (needsAdminSeat && !seatLabel)}
                  onClick={() => {
                    if (!current) return;
                    if (needsAdminSeat && !seatLabel) {
                      toast.error("Sélectionnez une place");
                      return;
                    }
                    approve.mutate({
                      id: current.id,
                      seatLabel: seatLabel || undefined,
                    });
                  }}
                >
                  {needsAdminSeat ? "Confirmer + place" : "Confirmer avec cette place"}
                </Button>
              ) : null}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
