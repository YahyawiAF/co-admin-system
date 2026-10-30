"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Fuse from "fuse.js";
import {
  Check,
  ClipboardList,
  Clock,
  History,
  LogIn,
  Minus,
  Plus,
  Sparkles,
  UserPlus,
  UserRound,
  Users,
  X,
  Zap,
} from "lucide-react";
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
  journalApi,
  membersApi,
  mobileApi,
  pricesApi,
  abonnementsApi,
  promotionsApi,
} from "@/lib/api/resources";
import { acceptedBundleIds, bestDeal, indexTarifPromos } from "@/lib/tarif-promos";
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
import { ladderFor } from "@/lib/session-pricing";
import {
  VisitTarifSpacePickers,
  visitOccupyPayload,
  type OccupyMode,
  type ReserveKind,
} from "@/components/admin/VisitTarifSpacePickers";
import { CheckInOccupancyStep } from "@/components/admin/CheckInOccupancyStep";
import {
  AUTO_TARIF,
  CheckInFicheCard,
  SUB_TARIF,
  type FicheLine,
} from "@/components/admin/CheckInFiche";
import { Badge } from "@/components/ui/badge";
import { UnpaidDebtBadge } from "@/components/admin/UnpaidDebtBadge";

type Props = {
  presentMemberIds: string[];
  onDone?: () => void;
  /** Ctrl+I opens this dialog (only one instance per page). */
  hotkey?: boolean;
};

type Mode = "existing" | "new" | "anonymous";
/** "auto" = the counter starts now, "start" = the visitor came earlier */
type TimeMode = "auto" | "start";

type RecentCheckIn = {
  id: string;
  label: string;
  at: string;
};

/** Per-person overrides in the fiche (undefined = follow the shared tarif / hours). */
type LineOpts = { priceId?: string; hours?: number; paid?: boolean };

const SINGLE_KEY = "__single__";
const ANON_PREFIX = "__anon__";
const ARRIVAL_SHIFTS = [15, 30, 45, 60] as const;
const GUEST_COUNTS = [1, 2, 3, 4, 5, 6] as const;
const MAX_GUESTS = 30;

const MODES: Array<{ value: Mode; title: string; hint: string; icon: typeof Users }> = [
  { value: "existing", title: "Membre", hint: "Recherche, plusieurs à la fois", icon: Users },
  { value: "new", title: "Nouveau", hint: "Prénom + téléphone", icon: UserPlus },
  { value: "anonymous", title: "Anonyme", hint: "Sans compte, 1 ou plusieurs", icon: UserRound },
];

function hhmm(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "HH:mm" today; empty = now. */
function arrivalDate(value: string, now: Date) {
  const [h, m] = value.split(":").map(Number);
  if (!value || Number.isNaN(h) || Number.isNaN(m)) return now;
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  return d;
}

type CheckInResult = { id?: string; journals?: { id: string }[] };

export function QuickCheckInPanel({ presentMemberIds, onDone, hotkey }: Props) {
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
  /** AUTO_TARIF by default: the price follows the time spent */
  const [priceId, setPriceId] = useState(AUTO_TARIF);
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestCount, setGuestCount] = useState(1);
  const [reserveKind, setReserveKind] = useState<ReserveKind>("none");
  const [spaceId, setSpaceId] = useState("");
  const [hours, setHours] = useState("");
  const [tableId, setTableId] = useState("");
  const [occupyMode, setOccupyMode] = useState<OccupyMode>("bureau");
  const [seatLabel, setSeatLabel] = useState("");
  const [seatLabels, setSeatLabels] = useState<string[]>([]);
  const [blockers, setBlockers] = useState<SeatOccupant[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [timeMode, setTimeMode] = useState<TimeMode>("auto");
  /** "HH:mm" start time when timeMode is "start"; "" = now. */
  const [arrival, setArrival] = useState("");
  const [cursor, setCursor] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

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
  /** Live tarif promos (discount on the pass, gift offered with it) */
  const { data: promotions = [] } = useQuery({
    queryKey: ["promotions"],
    queryFn: () => promotionsApi.list(),
    staleTime: 60_000,
  });
  const promosOf = useMemo(() => indexTarifPromos(promotions), [promotions]);
  /** Gift answers given by the client at the desk (promo id → yes / no) */
  const [giftAnswers, setGiftAnswers] = useState<Record<string, boolean>>({});
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

  useEffect(() => setCursor(0), [search]);

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

  /** Auto tarif: pass ladder (2h → 4h → …); the visit starts on the first one */
  const autoLadder = useMemo(() => {
    const tiers = journeePacks
      .filter((p) => !isHourlyVisitTarif(p) && (p.durationHours || 0) > 0)
      .map((p) => ({
        priceId: p.id,
        name: p.name,
        durationHours: p.durationHours || 0,
        price: p.price,
        category: p.category || "JOURNEE",
      }));
    return ladderFor(tiers, "JOURNEE");
  }, [journeePacks]);
  const autoPack = useMemo(
    () => journeePacks.find((p) => p.id === autoLadder[0]?.priceId) || null,
    [journeePacks, autoLadder]
  );

  const pickedIds = useMemo(() => new Set(picked.map((m) => m.id)), [picked]);
  const primary = mode === "existing" ? picked[0] ?? null : null;
  const primaryPack =
    priceId === AUTO_TARIF ? autoPack : journeePacks.find((p) => p.id === priceId);
  const primaryDiscount =
    primary && primaryPack ? memberDiscountPercent(primary, primaryPack) : 0;

  const singleLabel =
    [newName.trim(), newLastName.trim()].filter(Boolean).join(" ") || newPhone.trim();

  /** Name sent for the i-th anonymous guest (undefined = numbered by the server) */
  const guestNameAt = (i: number) => {
    const base = guestName.trim();
    if (!base) return undefined;
    return guestCount > 1 ? `${base} ${i + 1}` : base;
  };

  const arrivedAt = useMemo(
    () => (timeMode === "start" ? arrivalDate(arrival, now) : now),
    [timeMode, arrival, now]
  );
  const arrivalInFuture = arrivedAt.getTime() > Date.now() + 60_000;

  /** One fiche line per person to check in. */
  const lines = useMemo((): Array<FicheLine & { member: Member | null }> => {
    const people: Array<{ key: string; member: Member | null }> =
      mode === "existing"
        ? picked.map((m) => ({ key: m.id, member: m }))
        : mode === "anonymous"
          ? Array.from({ length: guestCount }, (_, i) => ({
              key: `${ANON_PREFIX}${i}`,
              member: null,
            }))
          : newPhone.trim()
            ? [{ key: SINGLE_KEY, member: null }]
            : [];
    return people.map(({ key, member }, index) => {
      const opts = lineOpts[key] || {};
      const sub = subOf(member);
      const subKind: FicheLine["subKind"] = sub
        ? sub.price?.billingUnit === "HOURLY"
          ? "hours"
          : "period"
        : null;
      // A period subscriber keeps their abonnement unless a pass is picked for them
      const tarifValue =
        opts.priceId !== undefined
          ? opts.priceId
          : subKind === "period" && (priceId === "" || priceId === AUTO_TARIF)
            ? SUB_TARIF
            : priceId;
      const auto = tarifValue === AUTO_TARIF;
      const pack =
        subKind === "hours" || tarifValue === SUB_TARIF
          ? null
          : auto
            ? autoPack
            : journeePacks.find((p) => p.id === tarifValue) || null;
      const usesSub = subKind === "hours" || (subKind === "period" && !pack);
      const hourly = !auto && !!pack && isHourlyVisitTarif(pack);
      const lineHours = auto
        ? 0
        : hourly
          ? opts.hours ?? (Number(hours) || pack?.durationHours || 0)
          : pack?.durationHours || (pack ? 2 : 0);
      const discountPercent =
        member && pack ? memberDiscountPercent(member, pack) : 0;
      const listAmount = pack
        ? hourly
          ? pack.price * lineHours
          : pack.price
        : 0;
      const afterMember =
        Math.round(listAmount * (1 - discountPercent / 100) * 100) / 100;
      // Same rule as the server: the best live tarif promo on top of the member discount
      const deal = pack ? bestDeal(promosOf(pack.id).deals, afterMember) : null;
      const amount = deal ? Math.round(deal.final * 100) / 100 : afterMember;
      // Gifts come with a chosen pass, not with the auto counter
      const gift =
        pack && !auto ? promosOf(pack.id).bundles.find((b) => giftAnswers[b.id]) ?? null : null;
      return {
        promoLabel: deal ? `${deal.promo.title} ${deal.promo.label}` : null,
        promoOff: deal ? Math.round((afterMember - deal.final) * 100) / 100 : 0,
        giftLabel: gift ? `Bon ${gift.itemName ?? "cadeau"} ${gift.label} (à la commande)` : null,
        key,
        member,
        name: member
          ? memberDisplayName(member)
          : mode === "anonymous"
            ? guestNameAt(index) ||
              (guestCount > 1 ? `Anonyme ${index + 1}/${guestCount}` : "Anonyme")
            : singleLabel || "Visiteur",
        subtitle: member
          ? [member.phone, member.group?.name].filter(Boolean).join(" · ")
          : mode === "anonymous"
            ? guestNameAt(index)
              ? "Anonyme"
              : "Numéro attribué à l'ajout"
            : `Nouveau · ${newPhone}`,
        auto,
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
        arrival: arrivedAt,
        leaveAt:
          !usesSub && lineHours > 0
            ? new Date(arrivedAt.getTime() + lineHours * 3_600_000)
            : null,
        // Auto: the amount is only known at departure
        paid: usesSub || auto ? false : opts.paid ?? paidAll,
        usesSub,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mode,
    picked,
    guestCount,
    guestName,
    autoPack,
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
    arrivedAt,
    promosOf,
    giftAnswers,
  ]);

  const total = lines.reduce((s, l) => s + (l.usesSub ? 0 : l.amount), 0);
  const anyAuto = lines.some((l) => l.auto && !l.usesSub);
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
    searchRef.current?.focus();
  };

  const chooseTarif = (id: string) => {
    setPriceId(id);
    setLineOpts((prev) => {
      const next: Record<string, LineOpts> = {};
      for (const [k, v] of Object.entries(prev)) {
        next[k] = { ...v, priceId: undefined, hours: undefined };
      }
      return next;
    });
  };

  const removeLine = (key: string) => {
    if (key === SINGLE_KEY) return;
    if (key.startsWith(ANON_PREFIX)) {
      setGuestCount((c) => Math.max(1, c - 1));
      return;
    }
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
    setGiftAnswers({});
    setPaidAll(false);
    setSearch("");
    setNewPhone("");
    setNewName("");
    setNewLastName("");
    setGuestName("");
    setGuestCount(1);
    setTimeMode("auto");
    setArrival("");
    setPriceId(AUTO_TARIF);
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
      if (arrivalInFuture) throw new Error("L'heure d'arrivée est dans le futur");
      const missing = lines.find((l) => !l.usesSub && !l.pack);
      if (missing) throw new Error(`Choisissez un tarif pour ${missing.name}`);
      if (!isMulti && occupyMode === "group" && seatLabels.length < 2) {
        throw new Error("Sélectionnez au moins 2 places pour un groupe");
      }
      const done: string[] = [];
      const backdate =
        timeMode === "start" && Date.now() - arrivedAt.getTime() > 60_000
          ? arrivedAt.toISOString()
          : undefined;
      // Several anonymous guests = one group visit in the journal
      const anonGroupId =
        mode === "anonymous" && lines.length > 1 ? crypto.randomUUID() : undefined;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        try {
          let res: CheckInResult;
          if (line.member && line.usesSub) {
            res = await mobileApi.scanIn(line.member.id);
            // Subscription pointage: backdate afterwards
            if (backdate) {
              const subIds = res.journals?.length
                ? res.journals.map((j) => j.id)
                : res.id
                  ? [res.id]
                  : [];
              for (const id of subIds) {
                await journalApi.update(id, { registredTime: backdate });
              }
            }
          } else {
            const payload = {
              ...(line.auto ? { auto: true } : { priceId: line.pack!.id }),
              ...occupyFor(i),
              hours: line.hourly && line.hours > 0 ? line.hours : undefined,
              bundleIds: line.auto
                ? undefined
                : acceptedBundleIds(promosOf(line.pack!.id).bundles, giftAnswers),
              startedAt: backdate,
            };
            res = (await (mode === "anonymous"
              ? mobileApi.quickCheckIn({
                  ...payload,
                  anonymous: true,
                  guestName: guestNameAt(i),
                  groupVisitId: anonGroupId,
                })
              : mobileApi.quickCheckIn({
                  ...payload,
                  memberId: line.member?.id,
                  phone: mode === "new" ? newPhone : undefined,
                  firstName: mode === "new" ? newName : undefined,
                  lastName: mode === "new" ? newLastName || undefined : undefined,
                }))) as CheckInResult;
          }
          const ids = res.journals?.length
            ? res.journals.map((j) => j.id)
            : res.id
              ? [res.id]
              : [];
          if (line.paid && !line.usesSub) {
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
    lines.length > 0 &&
    !arrivalInFuture &&
    lines.every((l) => l.usesSub || !!l.pack);

  const submit = (close: boolean) => {
    if (!canSubmit || checkIn.isPending) return;
    setCloseAfterCheckIn(close);
    checkIn.mutate();
  };

  /** Quick tarifs shown on the visitor step: Alt+1…9 picks them. */
  const quickTarifs = journeePacks.slice(0, 9);
  const showSubChip = lines.some((l) => l.subKind === "period");

  // Ctrl+I opens the dialog
  useEffect(() => {
    if (!hotkey) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkey]);

  // In the dialog: Ctrl+S search · Alt+1…9 tarif · Ctrl+Enter add (& next)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        setMode("existing");
        setStep("visitor");
        setTimeout(() => {
          searchRef.current?.focus();
          searchRef.current?.select();
        }, 0);
        return;
      }
      if (mod && e.key === "Enter") {
        e.preventDefault();
        submit(e.shiftKey);
        return;
      }
      if (e.altKey && e.code === "Digit0") {
        e.preventDefault();
        chooseTarif(AUTO_TARIF);
        return;
      }
      if (e.altKey && /^Digit[1-9]$/.test(e.code)) {
        const pack = quickTarifs[Number(e.code.slice(5)) - 1];
        if (!pack) return;
        e.preventDefault();
        chooseTarif(pack.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const addLabel = checkIn.isPending
    ? "Check-in…"
    : lines.length > 1
      ? `Ajouter ${lines.length} · ${anyAuto ? "dès " : ""}${total.toFixed(1)} DT`
      : lines[0]?.usesSub
        ? "Pointer"
        : lines[0]?.pack
          ? `Ajouter · ${lines[0].auto ? "tarif auto" : lines[0].hourly && lines[0].hours <= 0 ? "au compteur" : `${lines[0].amount.toFixed(1)} DT`}`
          : "Ajouter";

  const STEPS = [
    {
      value: "visitor",
      label: "Visiteur",
      done: lines.length > 0,
      count: lines.length > 1 ? lines.length : 0,
    },
    { value: "tarif", label: "Tarif", done: lines.length > 0 && canSubmit },
    { value: "space", label: "Espace", done: false },
  ];

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
        <Button size="lg" title={hotkey ? "Ctrl+I" : undefined}>
          + Check-in
        </Button>
      </DialogTrigger>
      <DialogContent className="flex h-[92vh] max-h-[92vh] w-[96vw] max-w-7xl flex-col gap-0 overflow-hidden rounded-2xl border-0 p-0 sm:max-w-7xl [&>button]:right-4 [&>button]:top-4 [&>button]:rounded-full [&>button]:bg-white/20 [&>button]:p-1.5 [&>button]:text-white [&>button]:opacity-100 [&>button]:transition-colors [&>button:hover]:bg-white/30">
        {/* Banner — same "mission" look as the visitor app modals */}
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 px-6 pb-5 pt-5 text-white">
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10" />
            <div className="absolute -bottom-14 left-1/3 h-32 w-32 rounded-full bg-white/10" />
          </div>
          <div className="relative flex flex-wrap items-end justify-between gap-4 pr-10">
            <DialogHeader className="space-y-1 text-left">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-100">
                Accueil · Check-in
              </p>
              <DialogTitle className="flex items-center gap-2 text-2xl font-extrabold leading-tight text-white">
                <LogIn className="h-6 w-6" />
                Nouvelle arrivée
              </DialogTitle>
              <DialogDescription className="text-[13px] text-indigo-100">
                Ctrl+S rechercher · Alt+0 auto · Alt+1…9 tarif · Ctrl+Entrée valider
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2">
              <BannerChip
                label={timeMode === "auto" ? "Arrivée · auto" : "Arrivée"}
                value={hhmm(arrivedAt)}
              />
              <BannerChip label="Personnes" value={String(lines.length)} />
              <BannerChip
                label={anyAuto ? "Total · dès" : "Total"}
                value={`${total.toFixed(1)} DT`}
              />
            </div>
          </div>
          {recentCheckIns.length > 0 ? (
            <div className="relative mt-4 flex flex-wrap items-center gap-1.5">
              <History className="h-3.5 w-3.5 text-indigo-100" />
              {recentCheckIns.map((r) => (
                <span
                  key={r.id}
                  className="animate-in fade-in-0 zoom-in-95 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-medium backdrop-blur-sm motion-reduce:animate-none"
                >
                  {r.label} · {r.at}
                </span>
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
            <div className="border-b bg-muted/30 px-6 py-3">
              <TabsList className="h-auto gap-2 bg-transparent p-0">
                {STEPS.map((s, i) => (
                  <TabsTrigger
                    key={s.value}
                    value={s.value}
                    disabled={s.value !== "visitor" && allHoursPool}
                    className="group gap-2 rounded-full border bg-background px-3 py-1.5 text-sm font-semibold text-muted-foreground shadow-none transition-all duration-200 data-[state=active]:border-indigo-600 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md motion-reduce:transition-none"
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full text-[11px] transition-colors duration-200",
                        s.done
                          ? "bg-emerald-500 text-white"
                          : "bg-muted text-foreground group-data-[state=active]:bg-white/25 group-data-[state=active]:text-white"
                      )}
                    >
                      {s.done ? <Check className="h-3 w-3" /> : i + 1}
                    </span>
                    {s.label}
                    {s.count ? (
                      <span className="rounded-full bg-indigo-100 px-1.5 text-[10px] text-indigo-700">
                        {s.count}
                      </span>
                    ) : null}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <TabsContent
                value="visitor"
                className="mt-0 space-y-5 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:duration-200 motion-reduce:animate-none"
              >
                {/* Who */}
                <div className="grid gap-2 sm:grid-cols-3">
                  {MODES.map((m) => {
                    const Icon = m.icon;
                    const active = mode === m.value;
                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setMode(m.value)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition-all duration-200 motion-reduce:transition-none",
                          active
                            ? "border-indigo-600 bg-indigo-50 shadow-sm dark:bg-indigo-950/40"
                            : "border-transparent bg-muted/50 hover:border-muted-foreground/20 hover:bg-muted"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-200",
                            active
                              ? "bg-indigo-600 text-white"
                              : "bg-background text-muted-foreground"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-bold">{m.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {m.hint}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div
                  key={mode}
                  className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200 motion-reduce:animate-none"
                >
                  {mode === "existing" ? (
                    <div className="space-y-2">
                      {picked.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {picked.map((m) => (
                            <Badge
                              key={m.id}
                              variant="secondary"
                              className="animate-in fade-in-0 zoom-in-95 gap-1 rounded-full bg-indigo-100 py-1 pl-2.5 pr-1 text-xs text-indigo-800 hover:bg-indigo-100 motion-reduce:animate-none"
                            >
                              {memberDisplayName(m)}
                              <button
                                type="button"
                                className="rounded-full p-0.5 transition-colors hover:bg-white"
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
                        ref={searchRef}
                        className="h-11 rounded-xl"
                        placeholder="Nom, téléphone ou #visiteur — Entrée pour ajouter, ↑↓ pour choisir"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            setCursor((c) => Math.min(c + 1, filteredMembers.length - 1));
                          } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            setCursor((c) => Math.max(c - 1, 0));
                          } else if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
                            e.preventDefault();
                            const m = filteredMembers[cursor];
                            if (m) togglePick(m);
                          } else if (e.key === "Backspace" && !search && picked.length) {
                            removeLine(picked[picked.length - 1].id);
                          }
                        }}
                        autoFocus
                      />
                      <div className="grid max-h-72 gap-1 overflow-y-auto rounded-xl border bg-muted/30 p-1 sm:grid-cols-2">
                        {filteredMembers.map((m, i) => {
                          const activeAbo = subOf(m);
                          const selected = pickedIds.has(m.id);
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => togglePick(m)}
                              className={cn(
                                "flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors duration-150",
                                selected
                                  ? "bg-indigo-50 ring-1 ring-indigo-400 dark:bg-indigo-950/40"
                                  : "hover:bg-background",
                                i === cursor && search.length >= 2 && "outline outline-2 outline-indigo-500/60"
                              )}
                            >
                              <span
                                className={cn(
                                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors duration-150",
                                  selected
                                    ? "border-indigo-600 bg-indigo-600 text-white"
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
                          <p className="p-3 text-sm text-muted-foreground sm:col-span-2">
                            Aucun membre disponible — passez en « Nouveau » ou « Anonyme »
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {mode === "new" ? (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label>Prénom</Label>
                        <Input
                          className="h-11 rounded-xl"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="Prénom"
                          autoFocus
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Nom</Label>
                        <Input
                          className="h-11 rounded-xl"
                          value={newLastName}
                          onChange={(e) => setNewLastName(e.target.value)}
                          placeholder="Nom"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Téléphone *</Label>
                        <Input
                          className="h-11 rounded-xl"
                          value={newPhone}
                          onChange={(e) => setNewPhone(e.target.value)}
                          inputMode="tel"
                          placeholder="ex: 20123456"
                        />
                      </div>
                    </div>
                  ) : null}

                  {mode === "anonymous" ? (
                    <div className="grid gap-4 md:grid-cols-[auto_1fr]">
                      <div className="space-y-1.5">
                        <Label>Nombre de visiteurs</Label>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center rounded-xl border bg-background">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-11 w-11 rounded-l-xl rounded-r-none"
                              disabled={guestCount <= 1}
                              onClick={() => setGuestCount((c) => Math.max(1, c - 1))}
                              aria-label="Un de moins"
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span
                              key={guestCount}
                              className="w-12 animate-in zoom-in-90 text-center text-xl font-black tabular-nums duration-150 motion-reduce:animate-none"
                            >
                              {guestCount}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-11 w-11 rounded-l-none rounded-r-xl"
                              disabled={guestCount >= MAX_GUESTS}
                              onClick={() => setGuestCount((c) => Math.min(MAX_GUESTS, c + 1))}
                              aria-label="Un de plus"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex gap-1">
                            {GUEST_COUNTS.map((n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setGuestCount(n)}
                                className={cn(
                                  "h-9 w-9 rounded-lg border text-sm font-bold tabular-nums transition-colors duration-150",
                                  guestCount === n
                                    ? "border-indigo-600 bg-indigo-600 text-white"
                                    : "bg-background hover:bg-muted"
                                )}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Nom affiché (optionnel)</Label>
                        <Input
                          className="h-11 rounded-xl"
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          placeholder={
                            guestCount > 1
                              ? "ex. Équipe Atlas → Équipe Atlas 1, 2, 3…"
                              : "Vide = Anonyme 1, 2, 3… automatique"
                          }
                          autoFocus
                        />
                        <p className="text-xs text-muted-foreground">
                          {guestCount > 1
                            ? `${guestCount} lignes dans le journal, liées en un groupe.`
                            : "Compte dans le journal et la caisse."}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>

                {!allHoursPool ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {/* When */}
                    <section className="space-y-2 rounded-2xl border bg-card p-4">
                      <h3 className="flex items-center gap-2 text-sm font-bold">
                        <Clock className="h-4 w-4 text-indigo-600" /> Heure d&apos;arrivée
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        <ChoiceCard
                          active={timeMode === "auto"}
                          onClick={() => setTimeMode("auto")}
                          icon={<Zap className="h-4 w-4" />}
                          title="Auto"
                          hint={`Maintenant · ${hhmm(now)}`}
                        />
                        <ChoiceCard
                          active={timeMode === "start"}
                          onClick={() => {
                            setTimeMode("start");
                            if (!arrival) setArrival(hhmm(new Date(Date.now() - 15 * 60_000)));
                          }}
                          icon={<History className="h-4 w-4" />}
                          title="Heure de début"
                          hint="Arrivé plus tôt"
                        />
                      </div>
                      <div
                        className={cn(
                          "grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none",
                          timeMode === "start"
                            ? "grid-rows-[1fr] opacity-100"
                            : "grid-rows-[0fr] opacity-0"
                        )}
                        aria-hidden={timeMode !== "start"}
                      >
                        <div className="overflow-hidden">
                          <div className="flex flex-wrap items-center gap-1.5 pt-2">
                            <Input
                              type="time"
                              className="h-9 w-28 rounded-lg font-semibold tabular-nums"
                              value={arrival || hhmm(now)}
                              onChange={(e) => setArrival(e.target.value)}
                              tabIndex={timeMode === "start" ? 0 : -1}
                            />
                            {ARRIVAL_SHIFTS.map((min) => {
                              const value = hhmm(new Date(Date.now() - min * 60_000));
                              return (
                                <button
                                  key={min}
                                  type="button"
                                  tabIndex={timeMode === "start" ? 0 : -1}
                                  onClick={() => setArrival(value)}
                                  className={cn(
                                    "h-9 rounded-lg border px-2.5 text-xs font-semibold transition-colors duration-150",
                                    arrival === value
                                      ? "border-indigo-600 bg-indigo-600 text-white"
                                      : "bg-background hover:bg-muted"
                                  )}
                                >
                                  −{min >= 60 ? "1h" : `${min} min`}
                                </button>
                              );
                            })}
                            {arrivalInFuture ? (
                              <span className="text-xs font-medium text-rose-600">
                                Dans le futur
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* Tarif */}
                    <section className="space-y-2 rounded-2xl border bg-card p-4">
                      <div className="flex items-center justify-between">
                        <h3 className="flex items-center gap-2 text-sm font-bold">
                          <Sparkles className="h-4 w-4 text-indigo-600" /> Tarif
                        </h3>
                        <button
                          type="button"
                          className="text-xs font-semibold text-indigo-600 hover:underline"
                          onClick={() => setStep("tarif")}
                        >
                          Tous les tarifs →
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <ChoiceCard
                          active={priceId === AUTO_TARIF}
                          onClick={() => chooseTarif(AUTO_TARIF)}
                          icon={<Zap className="h-4 w-4" />}
                          title="Auto"
                          kbd="0"
                          hint={
                            autoLadder.length
                              ? autoLadder
                                  .slice(0, 3)
                                  .map((t) => `${t.durationHours}h ${t.price}`)
                                  .join(" → ") + " DT"
                              : "Aucun pass configuré"
                          }
                        />
                        {showSubChip ? (
                          <ChoiceCard
                            active={priceId === ""}
                            onClick={() => chooseTarif("")}
                            icon={<Users className="h-4 w-4" />}
                            title="Abonnement"
                            hint="Pointage"
                          />
                        ) : null}
                        {quickTarifs.map((p, i) => (
                          <ChoiceCard
                            key={p.id}
                            active={priceId === p.id}
                            onClick={() => chooseTarif(p.id)}
                            title={p.name}
                            kbd={String(i + 1)}
                            hint={`${p.price} DT`}
                            badge={
                              promosOf(p.id).deals.length
                                ? "Promo"
                                : promosOf(p.id).bundles.length
                                  ? "Cadeau"
                                  : undefined
                            }
                          />
                        ))}
                      </div>
                    </section>
                  </div>
                ) : null}
              </TabsContent>

              <TabsContent
                value="tarif"
                className="mt-0 space-y-3 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:duration-200 motion-reduce:animate-none"
              >
                <button
                  type="button"
                  onClick={() => chooseTarif(AUTO_TARIF)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-all duration-200",
                    priceId === AUTO_TARIF
                      ? "border-indigo-600 bg-indigo-50 shadow-sm dark:bg-indigo-950/40"
                      : "border-dashed hover:bg-muted/50"
                  )}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
                    <Zap className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">Tarif auto</span>
                    <span className="block text-xs text-muted-foreground">
                      Suit le temps passé, réglé au départ
                      {autoLadder.length
                        ? ` · ${autoLadder.map((t) => `${t.name} ${t.price} DT`).join(" → ")}`
                        : ""}
                    </span>
                  </span>
                  {priceId === AUTO_TARIF ? <Check className="h-5 w-5 text-indigo-600" /> : null}
                </button>
                {isMulti ? (
                  <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
                    Tarif commun aux {lines.length} personnes. Vous pouvez le
                    changer pour une personne dans la fiche.
                  </p>
                ) : null}
                <VisitTarifSpacePickers
                  prices={prices}
                  spaces={layout?.spaces || []}
                  priceId={priceId === AUTO_TARIF ? "" : priceId}
                  onPriceId={chooseTarif}
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
                  tarifPromos={promosOf}
                  giftAnswers={giftAnswers}
                  onGiftAnswer={(id, yes) => setGiftAnswers((a) => ({ ...a, [id]: yes }))}
                />
              </TabsContent>

              <TabsContent
                value="space"
                className="mt-0 space-y-3 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:duration-200 motion-reduce:animate-none"
              >
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
                  priceId={priceId === AUTO_TARIF ? autoPack?.id ?? "" : priceId}
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
              <div className="flex items-center gap-2 font-bold">
                <ClipboardList className="h-4 w-4 text-indigo-600" />
                Fiche
                {lines.length ? (
                  <span className="rounded-full bg-indigo-600 px-2 text-xs text-white">
                    {lines.length}
                  </span>
                ) : null}
              </div>
              {lines.length && lines.some((l) => !l.auto && !l.usesSub) ? (
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
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                  <UserRound className="h-8 w-8 opacity-40" />
                  Choisissez un membre, un nouveau visiteur ou des anonymes.
                </div>
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
                      onRemove={
                        line.key === SINGLE_KEY ||
                        (line.key.startsWith(ANON_PREFIX) && guestCount <= 1)
                          ? undefined
                          : () => removeLine(line.key)
                      }
                    />
                  </div>
                ))
              )}
            </div>
            {lines.length ? (
              <div className="space-y-1 border-t bg-background px-4 py-3 text-sm">
                {lines.some((l) => l.promoLabel) ? (
                  <div className="animate-in fade-in-0 flex justify-between text-xs text-rose-700 duration-200 motion-reduce:animate-none">
                    <span>{lines.find((l) => l.promoLabel)!.promoLabel}</span>
                    <span className="tabular-nums">
                      −{lines.reduce((s, l) => s + (l.promoOff ?? 0), 0).toFixed(1)} DT
                    </span>
                  </div>
                ) : null}
                {lines.some((l) => l.giftLabel) ? (
                  <div className="animate-in fade-in-0 flex justify-between text-xs text-amber-700 duration-200 motion-reduce:animate-none">
                    <span>{lines.find((l) => l.giftLabel)!.giftLabel}</span>
                    <span>inclus</span>
                  </div>
                ) : null}
                <div className="flex items-baseline justify-between">
                  <span className="text-muted-foreground">
                    {anyAuto ? "Total · dès" : "Total"}
                  </span>
                  <span className="text-xl font-black tabular-nums">
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

        <DialogFooter className="gap-2 border-t px-6 py-3 sm:justify-between">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Fermer
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={!canSubmit || checkIn.isPending}
              onClick={() => submit(true)}
            >
              Ajouter & fermer
            </Button>
            <Button
              className="rounded-xl bg-indigo-600 px-5 font-bold text-white transition-colors hover:bg-indigo-700"
              disabled={!canSubmit || checkIn.isPending}
              onClick={() => submit(false)}
            >
              {checkIn.isPending ? addLabel : `${addLabel} & suivant`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Glass chip in the banner (arrival, people, total). */
function BannerChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[84px] rounded-2xl bg-white/15 px-3 py-2 text-center backdrop-blur-sm">
      <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-100">{label}</p>
      <p
        key={value}
        className="animate-in fade-in-0 text-base font-black tabular-nums duration-200 motion-reduce:animate-none"
      >
        {value}
      </p>
    </div>
  );
}

/** Selectable card used for the time and tarif choices. */
function ChoiceCard({
  active,
  onClick,
  icon,
  title,
  hint,
  kbd,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon?: ReactNode;
  title: string;
  hint?: string;
  kbd?: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "relative flex min-w-0 items-center gap-2.5 rounded-xl border-2 px-3 py-2 text-left transition-all duration-200 motion-reduce:transition-none",
        active
          ? "border-indigo-600 bg-indigo-50 shadow-sm dark:bg-indigo-950/40"
          : "border-transparent bg-muted/50 hover:border-muted-foreground/20 hover:bg-muted"
      )}
    >
      {icon ? (
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-200",
            active ? "bg-indigo-600 text-white" : "bg-background text-muted-foreground"
          )}
        >
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-bold">
          <span className="truncate">{title}</span>
          {kbd ? (
            <kbd className="rounded border bg-background px-1 text-[10px] font-medium text-muted-foreground">
              Alt+{kbd}
            </kbd>
          ) : null}
        </span>
        {hint ? (
          <span className="block truncate text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </span>
      {badge ? (
        <span className="absolute -right-1.5 -top-2 rounded-full bg-gradient-to-r from-amber-400 to-rose-500 px-1.5 py-0.5 text-[9px] font-black uppercase text-white shadow">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
