"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  facilityApi,
  membersApi,
  mobileApi,
  pricesApi,
  abonnementsApi,
} from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import { type Member, type Abonnement, type SeatOccupant } from "@/lib/types";
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
import { UnpaidDebtBadge } from "@/components/admin/UnpaidDebtBadge";

type Props = {
  presentMemberIds: string[];
  onDone?: () => void;
};

type Mode = "existing" | "new" | "anonymous";

type RecentCheckIn = {
  id: string;
  label: string;
  at: string;
};

export function QuickCheckInPanel({ presentMemberIds, onDone }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState("visitor");
  const [mode, setMode] = useState<Mode>("existing");
  const [closeAfterCheckIn, setCloseAfterCheckIn] = useState(false);
  const [recentCheckIns, setRecentCheckIns] = useState<RecentCheckIn[]>([]);
  const [search, setSearch] = useState("");
  const [member, setMember] = useState<Member | null>(null);
  const [priceId, setPriceId] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [guestName, setGuestName] = useState("");
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
  const { data: abosRaw } = useQuery({
    queryKey: queryKeys.abonnements,
    queryFn: () => abonnementsApi.list(),
  });
  const { data: layout } = useQuery({
    queryKey: ["facility-layout"],
    queryFn: () => facilityApi.layout(),
  });
  const { data: debtorsData } = useQuery({
    queryKey: queryKeys.debtors,
    queryFn: () => membersApi.debtors(false),
  });
  const debtByMember = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of debtorsData?.members || []) {
      map.set(m.memberId, m.net);
    }
    return map;
  }, [debtorsData]);

  const abos = useMemo(() => {
    if (!abosRaw) return [] as Abonnement[];
    return Array.isArray(abosRaw) ? abosRaw : abosRaw.data || [];
  }, [abosRaw]);

  const selectedSub = useMemo(() => {
    if (!member) return null;
    const now = new Date();
    return (
      abos.find((a) => {
        if (a.memberID !== member.id) return false;
        if (a.leaveDate && new Date(a.leaveDate) < now) return false;
        if (a.price?.billingUnit === "HOURLY") {
          const quota = a.hoursQuota || a.price.durationHours || 0;
          if ((a.hoursUsed || 0) >= quota) return false;
        }
        return true;
      }) || null
    );
  }, [abos, member]);

  const hoursPoolMember = selectedSub?.price?.billingUnit === "HOURLY";
  const periodMember =
    !!selectedSub && selectedSub.price?.billingUnit !== "HOURLY";

  const presentSet = useMemo(
    () => new Set(presentMemberIds.filter(Boolean)),
    [presentMemberIds]
  );

  const members = useMemo(() => {
    const list = Array.isArray(membersRaw) ? membersRaw : [];
    return list.filter((m) => !presentSet.has(m.id));
  }, [membersRaw, presentSet]);

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
      if (p.isActive === false) return false;
      if (!isJournalPack(p)) return false;
      const cat = p.category || "JOURNEE";
      if (cat === "ABONNEMENT") return false;
      if (p.spaceId && !ids.has(p.spaceId)) return false;
      if (cat === "JOURNEE") return hasSeats;
      return true;
    });
  }, [prices, layout?.spaces]);

  const selectedPack =
    journeePacks.find((p) => p.id === priceId) ||
    (!periodMember && !hoursPoolMember ? journeePacks[0] : undefined);

  const memberDiscount = useMemo(() => {
    if (!member || !selectedPack) return null;
    const cat = selectedPack.category || "JOURNEE";
    const override =
      cat === "SALLE"
        ? member.discountSalle
        : cat === "OPEN_SPACE"
          ? member.discountOpenSpace
          : member.discountForfait;
    const groupPct =
      cat === "SALLE"
        ? member.group?.discountSalle
        : cat === "OPEN_SPACE"
          ? member.group?.discountOpenSpace
          : member.group?.discountForfait;
    const percent = override ?? groupPct ?? 0;
    if (!percent) return member.group?.name
      ? { name: member.group.name, percent: 0 }
      : null;
    return { name: member.group?.name || "Remise", percent };
  }, [member, selectedPack]);

  const reset = () => {
    setMember(null);
    setSearch("");
    setNewPhone("");
    setNewName("");
    setGuestName("");
    setPriceId("");
    setMode("existing");
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

  const checkIn = useMutation({
    mutationFn: () => {
      if (mode === "existing" && member && hoursPoolMember) {
        return mobileApi.scanIn(member.id);
      }
      if (mode === "existing" && member && periodMember && !priceId) {
        return mobileApi.scanIn(member.id);
      }
      const packId = priceId || journeePacks[0]?.id;
      if (!packId) throw new Error("Choisissez un forfait");
      const pack = journeePacks.find((p) => p.id === packId);
      if (occupyMode === "group" && seatLabels.length < 2) {
        throw new Error("Sélectionnez au moins 2 places pour un groupe");
      }
      const occupy = visitOccupyPayload(
        occupyMode,
        reserveKind,
        spaceId,
        tableId,
        seatLabel,
        seatLabels
      );
      const payload = {
        priceId: packId,
        ...occupy,
        hours:
          pack && isHourlyVisitTarif(pack) && (Number(hours) > 0 || pack.durationHours)
            ? Number(hours) || pack.durationHours || undefined
            : undefined,
      };
      if (mode === "anonymous") {
        return mobileApi.quickCheckIn({
          ...payload,
          anonymous: true,
          guestName: guestName.trim() || undefined,
        });
      }
      return mobileApi.quickCheckIn({
        ...payload,
        memberId: mode === "existing" ? member?.id : undefined,
        phone: mode === "new" ? newPhone : undefined,
        firstName: mode === "new" ? newName : undefined,
      });
    },
    onSuccess: () => {
      const label =
        mode === "anonymous"
          ? guestName.trim() || "Anonyme"
          : mode === "new"
            ? newName.trim() || newPhone
            : member?.firstName || "Membre";
      setRecentCheckIns((prev) =>
        [
          {
            id: `${Date.now()}`,
            label,
            at: new Date().toLocaleTimeString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
          ...prev,
        ].slice(0, 8),
      );
      toast.success(
        mode === "anonymous"
          ? "Visiteur anonyme enregistré"
          : `${label} — check-in OK`,
      );
      queryClient.invalidateQueries({ queryKey: ["journal"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.members });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["facility-occupancy"] });
      queryClient.invalidateQueries({ queryKey: ["seat-history"] });
      reset();
      if (closeAfterCheckIn) setOpen(false);
      onDone?.();
    },
    onError: (e: Error & { occupants?: SeatOccupant[] }) => {
      if (e.occupants?.length) {
        setBlockers(e.occupants);
        setStep("space");
        toast.error(e.message);
        return;
      }
      toast.error(e.message);
    },
  });

  const canSubmit =
    (mode === "existing" && !!member && (hoursPoolMember || periodMember)) ||
    (!!(priceId || journeePacks[0]?.id) &&
      (mode === "anonymous" ||
        (mode === "existing" ? !!member : !!newPhone)));

  const visitorReady =
    mode === "anonymous" ||
    (mode === "existing" ? !!member : !!newPhone);

  const aboFastPath =
    mode === "existing" &&
    !!member &&
    (hoursPoolMember || (periodMember && !priceId));

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          reset();
          setRecentCheckIns([]);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="lg">+ Check-in</Button>
      </DialogTrigger>
      <DialogContent className="flex h-[90vh] max-h-[90vh] w-[96vw] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <div className="border-b bg-muted/40 px-6 py-4 pr-12">
          <DialogHeader>
            <DialogTitle className="text-xl">Check-in</DialogTitle>
            <DialogDescription>
              Visiteur, tarif, puis occupation. Utilisez « Valider & suivant »
              pour enchaîner plusieurs arrivées.
            </DialogDescription>
          </DialogHeader>
          {recentCheckIns.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                File récente :
              </span>
              {recentCheckIns.map((r) => (
                <Badge key={r.id} variant="secondary" className="text-[10px]">
                  {r.label} · {r.at}
                </Badge>
              ))}
            </div>
          ) : null}
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
                1. Visiteur
              </TabsTrigger>
              <TabsTrigger
                value="tarif"
                disabled={hoursPoolMember}
                className="rounded-t-md rounded-b-none border border-b-0 px-4 data-[state=inactive]:bg-muted/50"
              >
                2. Tarif
              </TabsTrigger>
              <TabsTrigger
                value="space"
                disabled={hoursPoolMember}
                className="rounded-t-md rounded-b-none border border-b-0 px-4 data-[state=inactive]:bg-muted/50"
              >
                3. Espace
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <TabsContent value="visitor" className="mt-0 space-y-4">
              <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="existing">Membre</TabsTrigger>
                  <TabsTrigger value="new">Nouveau</TabsTrigger>
                  <TabsTrigger value="anonymous">Anonyme</TabsTrigger>
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
                  {aboFastPath && member ? (
                    <div className="rounded-lg border border-violet-200 bg-violet-50/60 p-3">
                      <p className="text-sm font-medium">
                        {member.firstName}
                        {member.visitorNumber ? ` #${member.visitorNumber}` : ""}
                        {" — "}
                        {hoursPoolMember ? "abonnement heures" : "abonnement période"}
                      </p>
                      <Button
                        type="button"
                        className="mt-2 w-full"
                        disabled={checkIn.isPending}
                        onClick={() => {
                          setCloseAfterCheckIn(false);
                          checkIn.mutate();
                        }}
                      >
                        {checkIn.isPending ? "Pointage…" : "Pointer maintenant"}
                      </Button>
                    </div>
                  ) : null}
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
                        <UnpaidDebtBadge amount={debtByMember.get(m.id)} />
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
                        {m.group?.name ? (
                          <span className="text-[10px] opacity-80">
                            {m.group.name}
                            {(m.discountForfait ?? m.group.discountForfait)
                              ? ` −${m.discountForfait ?? m.group.discountForfait}%`
                              : ""}
                          </span>
                        ) : null}
                      </button>
                    ))}
                    {!filteredMembers.length ? (
                      <p className="p-3 text-sm text-muted-foreground">
                        Aucun membre disponible — passez en « Nouveau » ou
                        « Anonyme »
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {mode === "new" ? (
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
                      autoFocus
                    />
                  </div>
                </div>
              ) : null}

              {mode === "anonymous" ? (
                <div className="space-y-2">
                  <Label>Nom affiché (optionnel)</Label>
                  <Input
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Visiteur anonyme"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    Compte dans le journal et la caisse. Vous pouvez quand
                    même choisir une place (pas de groupe membre).
                  </p>
                </div>
              ) : null}

              {hoursPoolMember ? (
                <Alert>
                  <AlertDescription>
                    Abonnement heures : le check-in pointe la session. Attribuez
                    ensuite une place depuis le journal (comme un visiteur).
                  </AlertDescription>
                </Alert>
              ) : periodMember ? (
                <Alert>
                  <AlertDescription>
                    Abonnement période : pointer = présence (place réservée).
                    Vous pouvez aussi choisir un forfait extra et un espace.
                  </AlertDescription>
                </Alert>
              ) : null}

              {memberDiscount?.percent ? (
                <Badge className="w-fit">
                  {memberDiscount.name} −{memberDiscount.percent}%
                </Badge>
              ) : memberDiscount?.name ? (
                <Badge variant="outline" className="w-fit">
                  {memberDiscount.name}
                </Badge>
              ) : null}

              {visitorReady && !hoursPoolMember ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setStep("tarif")}
                >
                  Continuer → Tarif
                </Button>
              ) : null}
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
                optionalPrice={periodMember}
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
                  toast.success("Places libérées — réessayez le check-in");
                }}
              />
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="gap-2 border-t px-6 py-4 sm:justify-between">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Fermer
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!canSubmit || checkIn.isPending}
              onClick={() => {
                setCloseAfterCheckIn(true);
                checkIn.mutate();
              }}
            >
              Valider & fermer
            </Button>
            <Button
              disabled={!canSubmit || checkIn.isPending}
              onClick={() => {
                setCloseAfterCheckIn(false);
                checkIn.mutate();
              }}
            >
              {checkIn.isPending
                ? "Check-in…"
                : hoursPoolMember || (periodMember && !priceId)
                  ? "Pointer & suivant"
                  : selectedPack && isHourlyVisitTarif(selectedPack)
                    ? selectedPack.durationHours || Number(hours) > 0
                      ? `Valider & suivant · ${(selectedPack.price * (Number(hours) || selectedPack.durationHours || 1)).toFixed(1)} DT`
                      : "Valider & suivant"
                    : "Valider & suivant"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
