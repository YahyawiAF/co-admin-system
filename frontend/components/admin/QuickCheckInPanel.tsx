"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Fuse from "fuse.js";
import { Check, ClipboardList, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  membersApi,
  mobileApi,
  pricesApi,
  abonnementsApi,
} from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import {
  type Member,
  type Abonnement,
  type Price,
  type SeatOccupant,
} from "@/lib/types";
import { memberDiscountPercent } from "@/lib/member-discount";
import { isJournalPack, memberDisplayName } from "@/lib/journal-utils";
import { isActiveSub } from "@/lib/subscription-utils";
import { isHourlyVisitTarif } from "@/lib/tarif-labels";
import {
  VisitTarifSpacePickers,
  visitOccupyPayload,
  type OccupyMode,
  type ReserveKind,
} from "@/components/admin/VisitTarifSpacePickers";
import { CheckInOccupancyStep } from "@/components/admin/CheckInOccupancyStep";
import {
  CheckInFicheCard,
  SUB_TARIF,
  type FicheLine,
} from "@/components/admin/CheckInFiche";
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

/** Per-person overrides in the fiche (undefined = follow the shared tarif / hours). */
type LineOpts = { priceId?: string; hours?: number; paid?: boolean };

const SINGLE_KEY = "__single__";

type CheckInResult = { id?: string; journals?: { id: string }[] };

export function QuickCheckInPanel({ presentMemberIds, onDone }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState("visitor");
  const [mode, setMode] = useState<Mode>("existing");
  const [closeAfterCheckIn, setCloseAfterCheckIn] = useState(false);
  const [recentCheckIns, setRecentCheckIns] = useState<RecentCheckIn[]>([]);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Member[]>([]);
  const [lineOpts, setLineOpts] = useState<Record<string, LineOpts>>({});
  const [paidAll, setPaidAll] = useState(false);
  const [priceId, setPriceId] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [guestName, setGuestName] = useState("");
  const [reserveKind, setReserveKind] = useState<ReserveKind>("none");
  const [spaceId, setSpaceId] = useState("");
  const [hours, setHours] = useState("");
  const [tableId, setTableId] = useState("");
  const [occupyMode, setOccupyMode] = useState<OccupyMode>("bureau");
  const [seatLabel, setSeatLabel] = useState("");
  const [seatLabels, setSeatLabels] = useState<string[]>([]);
  const [blockers, setBlockers] = useState<SeatOccupant[]>([]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!open) return;
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, [open]);

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

  const subOf = (m: Member | null) =>
    m ? abos.find((a) => a.memberID === m.id && isActiveSub(a)) || null : null;

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

  const pickedIds = useMemo(() => new Set(picked.map((m) => m.id)), [picked]);
  const primary = mode === "existing" ? picked[0] ?? null : null;
  const primaryPack = journeePacks.find((p) => p.id === priceId);
  const primaryDiscount =
    primary && primaryPack ? memberDiscountPercent(primary, primaryPack) : 0;

  const singleLabel =
    mode === "anonymous"
      ? guestName.trim() || "Visiteur anonyme"
      : [newName.trim(), newLastName.trim()].filter(Boolean).join(" ") ||
        newPhone.trim();

  /** One fiche line per person to check in. */
  const lines = useMemo((): Array<FicheLine & { member: Member | null }> => {
    const people: Array<{ key: string; member: Member | null }> =
      mode === "existing"
        ? picked.map((m) => ({ key: m.id, member: m }))
        : mode === "anonymous" || newPhone.trim()
          ? [{ key: SINGLE_KEY, member: null }]
          : [];
    return people.map(({ key, member }) => {
      const opts = lineOpts[key] || {};
      const sub = subOf(member);
      const subKind: FicheLine["subKind"] = sub
        ? sub.price?.billingUnit === "HOURLY"
          ? "hours"
          : "period"
        : null;
      const tarifValue =
        opts.priceId !== undefined
          ? opts.priceId
          : priceId || (subKind === "period" ? SUB_TARIF : "");
      const pack =
        subKind === "hours" || tarifValue === SUB_TARIF
          ? null
          : journeePacks.find((p) => p.id === tarifValue) || null;
      const usesSub = subKind === "hours" || (subKind === "period" && !pack);
      const hourly = !!pack && isHourlyVisitTarif(pack);
      const lineHours = hourly
        ? opts.hours ?? (Number(hours) || pack?.durationHours || 0)
        : pack?.durationHours || (pack ? 2 : 0);
      const discountPercent =
        member && pack ? memberDiscountPercent(member, pack) : 0;
      const listAmount = pack
        ? hourly
          ? pack.price * lineHours
          : pack.price
        : 0;
      const amount =
        Math.round(listAmount * (1 - discountPercent / 100) * 100) / 100;
      return {
        key,
        member,
        name: member ? memberDisplayName(member) : singleLabel || "Visiteur",
        subtitle: member
          ? [member.phone, member.group?.name].filter(Boolean).join(" · ")
          : mode === "anonymous"
            ? "Anonyme"
            : `Nouveau · ${newPhone}`,
        debt: member ? debtByMember.get(member.id) : undefined,
        subKind,
        subName: sub?.price?.name ?? null,
        tarifValue,
        pack,
        hourly,
        hours: lineHours,
        discountPercent,
        listAmount: Math.round(listAmount * 100) / 100,
        amount,
        arrival: now,
        leaveAt:
          !usesSub && lineHours > 0
            ? new Date(now.getTime() + lineHours * 3_600_000)
            : null,
        paid: usesSub ? false : opts.paid ?? paidAll,
        usesSub,
      };
    });
  }, [
    mode,
    picked,
    lineOpts,
    priceId,
    hours,
    journeePacks,
    abos,
    debtByMember,
    now,
    paidAll,
    singleLabel,
    newPhone,
  ]);

  const total = lines.reduce((s, l) => s + (l.usesSub ? 0 : l.amount), 0);
  const allHoursPool = lines.length > 0 && lines.every((l) => l.subKind === "hours");
  const isMulti = lines.length > 1;

  const setLine = (key: string, patch: LineOpts) =>
    setLineOpts((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  const togglePick = (m: Member) => {
    setPicked((prev) =>
      prev.some((x) => x.id === m.id)
        ? prev.filter((x) => x.id !== m.id)
        : [...prev, m]
    );
    setSearch("");
  };

  const removeLine = (key: string) => {
    if (key === SINGLE_KEY) return;
    setPicked((prev) => prev.filter((m) => m.id !== key));
    setLineOpts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const reset = () => {
    setPicked([]);
    setLineOpts({});
    setPaidAll(false);
    setSearch("");
    setNewPhone("");
    setNewName("");
    setNewLastName("");
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

  /** Seat / space payload for the i-th person (several people share the chosen seats in order). */
  const occupyFor = (index: number) => {
    if (!isMulti) {
      return visitOccupyPayload(
        occupyMode,
        reserveKind,
        spaceId,
        tableId,
        seatLabel,
        seatLabels
      );
    }
    const none = {
      spaceId: undefined as string | undefined,
      tableId: undefined as string | undefined,
      reserveKind: "none" as const,
      seatLabel: undefined as string | undefined,
      seatLabels: undefined as string[] | undefined,
    };
    if (occupyMode === "group") {
      return { ...none, seatLabel: seatLabels[index] || undefined };
    }
    if (occupyMode === "bureau") {
      return { ...none, seatLabel: index === 0 ? seatLabel || undefined : undefined };
    }
    return index === 0
      ? visitOccupyPayload(occupyMode, reserveKind, spaceId, tableId)
      : none;
  };

  const checkIn = useMutation({
    mutationFn: async () => {
      if (!lines.length) throw new Error("Ajoutez au moins une personne");
      const missing = lines.find((l) => !l.usesSub && !l.pack);
      if (missing) throw new Error(`Choisissez un tarif pour ${missing.name}`);
      if (!isMulti && occupyMode === "group" && seatLabels.length < 2) {
        throw new Error("Sélectionnez au moins 2 places pour un groupe");
      }
      const done: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        try {
          let res: CheckInResult;
          if (line.member && line.usesSub) {
            res = await mobileApi.scanIn(line.member.id);
          } else {
            const payload = {
              priceId: line.pack!.id,
              ...occupyFor(i),
              hours: line.hourly && line.hours > 0 ? line.hours : undefined,
            };
            res = (await (mode === "anonymous"
              ? mobileApi.quickCheckIn({
                  ...payload,
                  anonymous: true,
                  guestName: guestName.trim() || undefined,
                })
              : mobileApi.quickCheckIn({
                  ...payload,
                  memberId: line.member?.id,
                  phone: mode === "new" ? newPhone : undefined,
                  firstName: mode === "new" ? newName : undefined,
                  lastName: mode === "new" ? newLastName || undefined : undefined,
                }))) as CheckInResult;
          }
          if (line.paid && !line.usesSub) {
            const ids = res.journals?.length
              ? res.journals.map((j) => j.id)
              : res.id
                ? [res.id]
                : [];
            for (const id of ids) await mobileApi.setPayment(id, true);
          }
          done.push(line.key);
        } catch (e) {
          throw Object.assign(e as Error, { done, failedName: line.name });
        }
      }
      return done;
    },
    onSuccess: () => {
      const at = new Date().toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      setRecentCheckIns((prev) =>
        [
          ...lines.map((l) => ({ id: `${Date.now()}-${l.key}`, label: l.name, at })),
          ...prev,
        ].slice(0, 8)
      );
      toast.success(
        lines.length > 1
          ? `${lines.length} check-ins OK`
          : `${lines[0]?.name ?? "Visiteur"} — check-in OK`
      );
      invalidate();
      reset();
      if (closeAfterCheckIn) setOpen(false);
      onDone?.();
    },
    onError: (
      e: Error & { occupants?: SeatOccupant[]; done?: string[]; failedName?: string }
    ) => {
      if (e.done?.length) {
        setPicked((prev) => prev.filter((m) => !e.done!.includes(m.id)));
        invalidate();
        toast.success(`${e.done.length} check-in(s) faits avant l'erreur`);
      }
      if (e.occupants?.length) {
        setBlockers(e.occupants);
        setStep("space");
      }
      toast.error(e.failedName ? `${e.failedName} : ${e.message}` : e.message);
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["journal"] });
    queryClient.invalidateQueries({ queryKey: queryKeys.members });
    queryClient.invalidateQueries({ queryKey: ["bookings"] });
    queryClient.invalidateQueries({ queryKey: ["facility-occupancy"] });
    queryClient.invalidateQueries({ queryKey: ["seat-history"] });
  };

  const canSubmit =
    lines.length > 0 && lines.every((l) => l.usesSub || !!l.pack);

  const addLabel = checkIn.isPending
    ? "Check-in…"
    : lines.length > 1
      ? `Ajouter ${lines.length} · ${total.toFixed(1)} DT`
      : lines[0]?.usesSub
        ? "Pointer"
        : lines[0]?.pack
          ? `Ajouter · ${lines[0].hourly && lines[0].hours <= 0 ? "au compteur" : `${lines[0].amount.toFixed(1)} DT`}`
          : "Ajouter";

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
      <DialogContent className="flex h-[90vh] max-h-[90vh] w-[96vw] max-w-7xl flex-col gap-0 overflow-hidden p-0 sm:max-w-7xl">
        <div className="border-b bg-muted/40 px-6 py-4 pr-12">
          <DialogHeader>
            <DialogTitle className="text-xl">Check-in</DialogTitle>
            <DialogDescription>
              Sélectionnez une ou plusieurs personnes, le tarif et la place.
              La fiche à droite récapitule tout avant d&apos;ajouter.
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

        <div className="flex min-h-0 flex-1">
          <Tabs
            value={step}
            onValueChange={setStep}
            className="flex min-h-0 min-w-0 flex-1 flex-col"
          >
            <div className="border-b px-4 pt-2">
              <TabsList className="h-11 w-full justify-start gap-1 rounded-none bg-transparent p-0">
                <TabsTrigger
                  value="visitor"
                  className="rounded-t-md rounded-b-none border border-b-0 px-4 data-[state=inactive]:bg-muted/50"
                >
                  1. Visiteur{picked.length > 1 && mode === "existing" ? ` (${picked.length})` : ""}
                </TabsTrigger>
                <TabsTrigger
                  value="tarif"
                  disabled={allHoursPool}
                  className="rounded-t-md rounded-b-none border border-b-0 px-4 data-[state=inactive]:bg-muted/50"
                >
                  2. Tarif
                </TabsTrigger>
                <TabsTrigger
                  value="space"
                  disabled={allHoursPool}
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
                    <div className="flex items-center justify-between">
                      <Label>Rechercher</Label>
                      <span className="text-xs text-muted-foreground">
                        Cliquez pour ajouter / retirer · sélection multiple
                      </span>
                    </div>
                    {picked.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {picked.map((m) => (
                          <Badge
                            key={m.id}
                            variant="secondary"
                            className="gap-1 py-1 pl-2.5 pr-1 text-xs"
                          >
                            {memberDisplayName(m)}
                            <button
                              type="button"
                              className="rounded-full p-0.5 hover:bg-background"
                              onClick={() => removeLine(m.id)}
                              aria-label="Retirer"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    <Input
                      placeholder="Nom, téléphone ou #visiteur"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      autoFocus
                    />
                    <div className="max-h-80 space-y-1 overflow-y-auto rounded-lg border bg-muted/30 p-1">
                      {filteredMembers.map((m) => {
                        const activeAbo = subOf(m);
                        const selected = pickedIds.has(m.id);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => togglePick(m)}
                            className={cn(
                              "flex w-full items-start gap-2.5 rounded-md px-3 py-2.5 text-left text-sm transition-colors",
                              selected
                                ? "bg-primary/10 ring-1 ring-primary/40"
                                : "hover:bg-background"
                            )}
                          >
                            <span
                              className={cn(
                                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                                selected
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-muted-foreground/40 bg-background"
                              )}
                            >
                              {selected ? <Check className="h-3 w-3" /> : null}
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col">
                              <span className="flex flex-wrap items-center gap-1.5 font-medium">
                                {memberDisplayName(m)}
                                {activeAbo ? (
                                  <Badge className="h-5 bg-violet-600 text-[10px] hover:bg-violet-600">
                                    Abonné
                                  </Badge>
                                ) : null}
                              </span>
                              <UnpaidDebtBadge amount={debtByMember.get(m.id)} />
                              <span className="text-xs text-muted-foreground">
                                {m.phone}
                                {m.group?.name ? ` · ${m.group.name}` : ""}
                              </span>
                            </span>
                          </button>
                        );
                      })}
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
                        placeholder="Prénom"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nom</Label>
                      <Input
                        value={newLastName}
                        onChange={(e) => setNewLastName(e.target.value)}
                        placeholder="Nom"
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

                {lines.length > 0 && !allHoursPool ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setStep("tarif")}
                  >
                    Continuer → Tarif
                  </Button>
                ) : null}
              </TabsContent>

              <TabsContent value="tarif" className="mt-0 space-y-3">
                {isMulti ? (
                  <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
                    Tarif commun aux {lines.length} personnes. Vous pouvez le
                    changer pour une personne dans la fiche.
                  </p>
                ) : null}
                <VisitTarifSpacePickers
                  prices={prices}
                  spaces={layout?.spaces || []}
                  priceId={priceId}
                  onPriceId={(id) => {
                    setPriceId(id);
                    setLineOpts((prev) => {
                      const next: Record<string, LineOpts> = {};
                      for (const [k, v] of Object.entries(prev)) {
                        next[k] = { ...v, priceId: undefined, hours: undefined };
                      }
                      return next;
                    });
                  }}
                  reserveKind={reserveKind}
                  spaceId={spaceId}
                  tableId={tableId}
                  onReserve={onReserve}
                  hours={hours}
                  onHours={setHours}
                  optionalPrice={lines.some((l) => l.subKind === "period")}
                  showTarif
                  showSpace={false}
                  discountPercent={isMulti ? 0 : primaryDiscount}
                  discountLabel={
                    !isMulti && primaryDiscount
                      ? primary?.group?.name || "Remise"
                      : undefined
                  }
                />
              </TabsContent>

              <TabsContent value="space" className="mt-0 space-y-3">
                {isMulti ? (
                  <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
                    Plusieurs personnes : en mode « Groupe », les places
                    choisies sont attribuées dans l&apos;ordre de la fiche
                    (1re place → 1re personne…).
                  </p>
                ) : null}
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

          <aside className="flex w-[360px] shrink-0 flex-col border-l bg-muted/20">
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
              <p className="flex items-center gap-2 font-semibold">
                <ClipboardList className="h-4 w-4" />
                Fiche
                {lines.length ? (
                  <Badge variant="secondary">{lines.length}</Badge>
                ) : null}
              </p>
              {lines.length ? (
                <label className="flex items-center gap-2 text-xs">
                  <Switch
                    checked={paidAll}
                    onCheckedChange={(v) => {
                      setPaidAll(v);
                      setLineOpts((prev) => {
                        const next: Record<string, LineOpts> = {};
                        for (const [k, o] of Object.entries(prev)) {
                          next[k] = { ...o, paid: undefined };
                        }
                        return next;
                      });
                    }}
                  />
                  Tout payé
                </label>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              {!lines.length ? (
                <p className="rounded-lg border border-dashed px-3 py-10 text-center text-sm text-muted-foreground">
                  Sélectionnez un ou plusieurs membres pour remplir la fiche.
                </p>
              ) : (
                lines.map((line, i) => (
                  <div key={line.key} className="space-y-1">
                    {isMulti && occupyMode === "group" && seatLabels[i] ? (
                      <p className="px-1 text-[11px] text-muted-foreground">
                        Place {seatLabels[i]}
                      </p>
                    ) : null}
                    <CheckInFicheCard
                      line={line}
                      packs={journeePacks as Price[]}
                      onTarif={(v) => setLine(line.key, { priceId: v, hours: undefined })}
                      onHours={(h) => setLine(line.key, { hours: h })}
                      onPaid={(p) => setLine(line.key, { paid: p })}
                      onRemove={line.key === SINGLE_KEY ? undefined : () => removeLine(line.key)}
                    />
                  </div>
                ))
              )}
            </div>
            {lines.length ? (
              <div className="space-y-1 border-t px-4 py-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span className="text-lg font-bold tabular-nums">
                    {total.toFixed(1)} DT
                  </span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Encaissé à l&apos;ajout</span>
                  <span className="tabular-nums">
                    {lines
                      .filter((l) => l.paid)
                      .reduce((s, l) => s + l.amount, 0)
                      .toFixed(1)}{" "}
                    DT
                  </span>
                </div>
              </div>
            ) : null}
          </aside>
        </div>

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
              Ajouter & fermer
            </Button>
            <Button
              disabled={!canSubmit || checkIn.isPending}
              onClick={() => {
                setCloseAfterCheckIn(false);
                checkIn.mutate();
              }}
            >
              {checkIn.isPending ? addLabel : `${addLabel} & suivant`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
