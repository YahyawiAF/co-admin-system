"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format, setHours as setHoursOfDay, setMinutes, startOfDay } from "date-fns";
import { CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import Fuse from "fuse.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  facilityApi,
  journalApi,
  membersApi,
  mobileApi,
  pricesApi,
  bookingApi,
} from "@/lib/api/resources";
import { BOOKING_EVENT_KEY } from "@/lib/facility-spaces";
import { queryKeys } from "@/lib/query-client";
import { useAuth } from "@/lib/auth/AuthContext";
import { type Member, type SeatOccupant } from "@/lib/types";
import { isJournalPack } from "@/lib/journal-utils";
import { isHourlyVisitTarif } from "@/lib/tarif-labels";
import {
  VisitTarifSpacePickers,
  visitOccupyPayload,
  type OccupyMode,
  type ReserveKind,
} from "@/components/admin/VisitTarifSpacePickers";
import { CheckInOccupancyStep } from "@/components/admin/CheckInOccupancyStep";
import { Badge } from "@/components/ui/badge";

type Props = {
  journalDate: Date;
  onDone?: () => void;
};

export function ReservationPanel({ journalDate, onDone }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState("visitor");

  const defaultDate = useMemo(() => {
    const today = startOfDay(new Date());
    const viewed = startOfDay(journalDate);
    if (viewed.getTime() > today.getTime()) return format(viewed, "yyyy-MM-dd");
    return format(addDays(today, 1), "yyyy-MM-dd");
  }, [journalDate]);

  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [search, setSearch] = useState("");
  const [member, setMember] = useState<Member | null>(null);
  const [priceId, setPriceId] = useState("");
  const [reservationDate, setReservationDate] = useState(defaultDate);
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [reserveKind, setReserveKind] = useState<ReserveKind>("none");
  const [spaceId, setSpaceId] = useState("");
  const [hours, setHours] = useState("");
  const [tableId, setTableId] = useState("");
  const [occupyMode, setOccupyMode] = useState<OccupyMode>("bureau");
  const [seatLabel, setSeatLabel] = useState("");
  const [seatLabels, setSeatLabels] = useState<string[]>([]);
  const [blockers, setBlockers] = useState<SeatOccupant[]>([]);

  const { data: membersRaw } = useQuery({
    queryKey: queryKeys.members,
    queryFn: () => membersApi.list(),
  });
  const { data: prices = [] } = useQuery({
    queryKey: queryKeys.prices,
    queryFn: () => pricesApi.list(),
  });
  const { data: layout } = useQuery({
    queryKey: ["facility-layout"],
    queryFn: () => facilityApi.layout(),
  });

  const members = useMemo(
    () => (Array.isArray(membersRaw) ? membersRaw : []),
    [membersRaw]
  );

  const filteredMembers = useMemo(() => {
    if (!search || search.length < 2) return members.slice(0, 12);
    const fuse = new Fuse(members, {
      keys: ["firstName", "lastName", "phone", "visitorNumber"],
      threshold: 0.3,
    });
    return fuse.search(search).map((r) => r.item).slice(0, 12);
  }, [members, search]);

  const journeePacks = useMemo(() => {
    const spaces = layout?.spaces || [];
    const hasSeats = spaces.some(
      (s) =>
        (s.seats || []).length > 0 ||
        (s.tables || []).some((t) => (t.seats || []).length > 0)
    );
    const ids = new Set(spaces.map((s) => s.id));
    return prices.filter((p) => {
      if (!isJournalPack(p)) return false;
      const cat = p.category || "JOURNEE";
      if (cat === "ABONNEMENT") return false;
      if (p.spaceId && !ids.has(p.spaceId)) return false;
      if (cat === "JOURNEE") return hasSeats;
      return true;
    });
  }, [prices, layout?.spaces]);

  const selectedPack =
    journeePacks.find((p) => p.id === (priceId || journeePacks[0]?.id)) ??
    journeePacks[0];

  const minDate = format(startOfDay(new Date()), "yyyy-MM-dd");
  const isToday = reservationDate === format(new Date(), "yyyy-MM-dd");

  const reset = () => {
    setMember(null);
    setSearch("");
    setNewPhone("");
    setNewName("");
    setPriceId("");
    setMode("existing");
    setReservationDate(defaultDate);
    setStep("visitor");
    setReserveKind("none");
    setSpaceId("");
    setHours("");
    setTableId("");
    setOccupyMode("bureau");
    setSeatLabel("");
    setSeatLabels([]);
    setBlockers([]);
  };

  const onReserve = (kind: ReserveKind, id?: string, table?: string) => {
    setReserveKind(kind);
    setSpaceId(id || "");
    setTableId(table || "");
  };

  const reserve = useMutation({
    mutationFn: async () => {
      let memberId = member?.id;
      let host = member;
      if (mode === "new") {
        const created = await membersApi.create({
          phone: newPhone,
          firstName: newName || undefined,
        });
        memberId = created.id;
        host = created;
      }
      if (!memberId) throw new Error("Membre requis");

      const pack = selectedPack;
      if (!pack) throw new Error("Forfait requis");

      const occupy = visitOccupyPayload(
        occupyMode,
        reserveKind,
        spaceId,
        tableId,
        seatLabel,
        seatLabels
      );
      const billedHours =
        pack && isHourlyVisitTarif(pack) && Number(hours) > 0
          ? Number(hours)
          : pack && isHourlyVisitTarif(pack) && pack.durationHours
            ? pack.durationHours
            : null;
      const cat = pack.category || "JOURNEE";
      const discountPct =
        (cat === "SALLE"
          ? host?.discountSalle ?? host?.group?.discountSalle
          : cat === "OPEN_SPACE"
            ? host?.discountOpenSpace ?? host?.group?.discountOpenSpace
            : host?.discountForfait ?? host?.group?.discountForfait) || 0;
      const raw = isHourlyVisitTarif(pack)
        ? billedHours
          ? pack.price * billedHours
          : 0
        : pack.price;
      const payedAmount = Math.round(raw * (1 - discountPct / 100) * 100) / 100;

      const day = startOfDay(new Date(`${reservationDate}T12:00:00`));
      const registredTime = setMinutes(setHoursOfDay(day, 9), 0);
      const groupVisitId =
        occupyMode === "group" && seatLabels.length > 1
          ? crypto.randomUUID()
          : undefined;
      const extraCount =
        occupyMode === "group" ? Math.max(0, seatLabels.length - 1) : 0;

      const journal = await journalApi.create({
        memberID: memberId,
        priceId: pack.id,
        registredTime: registredTime.toISOString(),
        leaveTime: null,
        isPayed: false,
        isReservation: true,
        payedAmount,
        createdbyUserID: user?.id,
        groupVisitId,
      });

      for (let i = 0; i < extraCount; i++) {
        await journalApi.create({
          isAnonymous: true,
          guestName: `${host?.firstName || "Groupe"} · ${seatLabels[i + 1]}`,
          priceId: pack.id,
          registredTime: registredTime.toISOString(),
          leaveTime: null,
          isPayed: false,
          isReservation: true,
          payedAmount,
          createdbyUserID: user?.id,
          groupVisitId,
        });
      }

      if (isToday) {
        const labels = occupy.seatLabels?.length
          ? occupy.seatLabels
          : occupy.seatLabel
            ? [occupy.seatLabel]
            : [];
        if (labels.length) {
          await bookingApi.create({
            eventKey: BOOKING_EVENT_KEY,
            seats: labels,
            memberId,
          });
        } else if (occupy.spaceId || occupy.reserveKind || occupy.tableId) {
          await mobileApi.bookSpace({
            memberId,
            spaceId: occupy.spaceId,
            kind: occupy.reserveKind as "open" | "salle" | "all" | undefined,
            tableId: occupy.tableId,
          });
        }
      }

      return journal;
    },
    onSuccess: () => {
      toast.success(
        isToday
          ? "Réservation enregistrée (places bloquées)"
          : "Réservation enregistrée — les places seront à bloquer le jour J"
      );
      queryClient.invalidateQueries({ queryKey: ["journal"] });
      reset();
      setOpen(false);
      onDone?.();
    },
    onError: (e: Error & { occupants?: SeatOccupant[] }) => {
      if (e.occupants?.length) {
        setBlockers(e.occupants);
        setStep("space");
      }
      toast.error(e.message);
    },
  });

  const canSubmit =
    (mode === "existing" ? !!member : !!newPhone) && !!selectedPack;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setReservationDate(defaultDate);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="lg">
          <CalendarPlus className="mr-2 h-4 w-4" />
          Réservation
        </Button>
      </DialogTrigger>
      <DialogContent className="flex h-[90vh] max-h-[90vh] w-[96vw] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <div className="border-b bg-muted/40 px-6 py-4 pr-12">
          <DialogHeader>
            <DialogTitle className="text-xl">Réservation</DialogTitle>
            <DialogDescription>
              Date, visiteur, tarif par catégorie, puis un clic pour réserver
              open space, salle ou tout le space.
            </DialogDescription>
          </DialogHeader>
        </div>

        <Tabs
          value={step}
          onValueChange={setStep}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="border-b px-4 pt-2">
            <TabsList className="h-11 w-full justify-start gap-1 rounded-none bg-transparent p-0">
              <TabsTrigger
                value="visitor"
                className="rounded-t-md rounded-b-none border border-b-0 px-4 data-[state=inactive]:bg-muted/50"
              >
                1. Date & visiteur
              </TabsTrigger>
              <TabsTrigger
                value="tarif"
                className="rounded-t-md rounded-b-none border border-b-0 px-4 data-[state=inactive]:bg-muted/50"
              >
                2. Tarif
              </TabsTrigger>
              <TabsTrigger
                value="space"
                className="rounded-t-md rounded-b-none border border-b-0 px-4 data-[state=inactive]:bg-muted/50"
              >
                3. Espace
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <TabsContent value="visitor" className="mt-0 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reservationDate">Date de la réservation</Label>
                <Input
                  id="reservationDate"
                  type="date"
                  min={minDate}
                  value={reservationDate}
                  onChange={(e) => setReservationDate(e.target.value)}
                  className="max-w-xs"
                />
              </div>

              <Tabs
                value={mode}
                onValueChange={(v) => setMode(v as "existing" | "new")}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="existing">Membre existant</TabsTrigger>
                  <TabsTrigger value="new">Nouveau membre</TabsTrigger>
                </TabsList>
              </Tabs>

              {mode === "existing" ? (
                <div className="space-y-2">
                  <Label>Rechercher</Label>
                  <Input
                    placeholder="Nom, téléphone ou #visiteur"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                  />
                  <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border bg-muted/30 p-1">
                    {filteredMembers.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMember(m)}
                        className={cn(
                          "flex w-full flex-col rounded-md px-3 py-2.5 text-left text-sm hover:bg-background",
                          member?.id === m.id &&
                            "bg-primary text-primary-foreground hover:bg-primary"
                        )}
                      >
                        <span className="font-medium">
                          {m.firstName || "Visiteur"}
                          {m.visitorNumber ? ` #${m.visitorNumber}` : ""}
                        </span>
                        <span
                          className={cn(
                            "text-xs",
                            member?.id === m.id
                              ? "text-primary-foreground/80"
                              : "text-muted-foreground"
                          )}
                        >
                          {m.phone}
                        </span>
                      </button>
                    ))}
                    {!filteredMembers.length ? (
                      <p className="p-3 text-sm text-muted-foreground">
                        Aucun membre — passez en « Nouveau »
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Prénom</Label>
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Optionnel"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Téléphone *</Label>
                    <Input
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      inputMode="tel"
                      placeholder="ex: 20123456"
                    />
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="tarif" className="mt-0">
              <VisitTarifSpacePickers
                prices={prices}
                spaces={layout?.spaces || []}
                priceId={priceId}
                onPriceId={setPriceId}
                reserveKind={reserveKind}
                spaceId={spaceId}
                tableId={tableId}
                onReserve={onReserve}
                hours={hours}
                onHours={setHours}
                showTarif
                showSpace={false}
              />
            </TabsContent>

            <TabsContent value="space" className="mt-0">
              <CheckInOccupancyStep
                prices={prices}
                spaces={layout?.spaces || []}
                priceId={priceId}
                occupyMode={occupyMode}
                onOccupyMode={setOccupyMode}
                seatLabel={seatLabel}
                seatLabels={seatLabels}
                onSeatLabel={setSeatLabel}
                onSeatLabels={setSeatLabels}
                reserveKind={reserveKind}
                spaceId={spaceId}
                tableId={tableId}
                onReserve={onReserve}
                hours={hours}
                onHours={setHours}
                blockers={blockers}
                onBlockersCleared={() => {
                  setBlockers([]);
                  toast.success("Places libérées — réessayez la réservation");
                }}
              />
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="gap-2 border-t px-6 py-4 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button
            disabled={!canSubmit || reserve.isPending}
            onClick={() => reserve.mutate()}
          >
            {reserve.isPending ? "Enregistrement…" : "Réserver"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
