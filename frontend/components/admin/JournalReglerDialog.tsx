"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { endOfDay, format, startOfDay } from "date-fns";
import { toast } from "sonner";
import { AlertTriangle, Banknote, Check, Coffee, Gift, ReceiptText, Wallet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { LateBillingChoice } from "@/components/admin/LateBillingChoice";
import { membersApi, mobileApi, orderUnitPrice, type DailyProduct } from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import {
  amountIfPaidNow,
  formatDurationHm,
  isActiveVisit,
  isAnonymousVisit,
  lateAmountForMode,
  priceOf,
  rowPricing,
  rowPricingAt,
  visitAmountDue,
  visitPaidAmount,
  visitorLabel,
} from "@/lib/journal-utils";
import {
  computeSessionPricing,
  formatDt,
  ladderFor,
  type PricingTier,
  type SessionPricingResult,
} from "@/lib/session-pricing";
import { POINTS_PER_DT, redeemablePoints } from "@/lib/points-catalog";
import type { Journal, LateBillingMode } from "@/lib/types";
import { cn } from "@/lib/utils";

type Depart = "stay" | "now" | "fixed_end" | "custom";

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Cash amounts a customer is likely to hand over for `due` (same as the Caisse). */
function quickGivenAmounts(due: number): number[] {
  if (due <= 0) return [];
  const out = new Set<number>([Math.round(due * 10) / 10]);
  for (const s of [5, 10, 20, 50]) {
    const v = Math.ceil(due / s) * s;
    if (v > due + 0.05) out.add(v);
  }
  return [...out].sort((a, b) => a - b).slice(0, 4);
}

const orderTotal = (o: DailyProduct) => round3(orderUnitPrice(o) * (o.quantite || 0));
const orderAt = (o: DailyProduct) => new Date(o.date ?? o.createdAt ?? 0).getTime();

/** Something left unpaid before this visit: ledger debt, old visit, old café order. */
type PrevItem = {
  key: string;
  kind: "debt" | "visit" | "order";
  id: string;
  label: string;
  sub: string;
  amount: number;
};

/**
 * One place to settle a visit: departure time (forgotten check-out),
 * pass change (stayed less / longer), late-payment billing, old debts
 * (e.g. fee of a cancelled reservation), café of the day, then collect.
 * The right column is a cash-register ticket of what is collected.
 */
export function JournalReglerDialog({
  row,
  tiers,
  products = [],
  visitIds,
  onOpenChange,
}: {
  row: Journal | null;
  tiers: PricingTier[];
  /** All café / shop orders (any day): the visit's ones and older unpaid ones are picked here. */
  products?: DailyProduct[];
  /** Ids of this person's passages on the day (anonymous orders are linked by visit). */
  visitIds?: string[];
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const open = !!row;
  const present = !!row && isActiveVisit(row);
  const paid = !!row?.isPayed;
  const pricing = row ? rowPricing(row) : null;
  const start = row ? new Date(row.registredTime).getTime() : 0;
  const fixedEnd = pricing?.fixedEndsAt ?? pricing?.tierEndsAt ?? null;
  const memberId = row && !isAnonymousVisit(row) ? row.memberID || row.members?.id || null : null;

  const [depart, setDepart] = useState<Depart>("now");
  const [custom, setCustom] = useState("");
  const [tierId, setTierId] = useState<string | null>(null);
  const [lateMode, setLateMode] = useState<LateBillingMode>("now");
  /** Previous unpaid items the staff chose to collect now (none by default) */
  const [includePrev, setIncludePrev] = useState<Set<string>>(new Set());
  /** "Offert": staff gives part of the visit away — collected less, no debt */
  const [offerOn, setOfferOn] = useState(false);
  const [received, setReceived] = useState("");
  /** Pay part of the visit with loyalty points (whole 1000-pt blocks) */
  const [usePoints, setUsePoints] = useState(false);
  /** Café of the day collected together with the visit */
  const [includeCafe, setIncludeCafe] = useState(true);
  /** Cash handed over, only to show the change to give back */
  const [given, setGiven] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!row) return;
    const now = Date.now();
    setNowMs(now);
    // Pass already over → most likely a forgotten check-out
    setDepart(fixedEnd && fixedEnd + 15 * 60_000 < now ? "fixed_end" : "now");
    setCustom(format(now, "HH:mm"));
    setTierId(null);
    setLateMode("now");
    setIncludePrev(new Set());
    setOfferOn(false);
    setReceived("");
    setUsePoints(false);
    setIncludeCafe(true);
    setGiven("");
  }, [row?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: ledger } = useQuery({
    queryKey: ["member-ledger", memberId],
    queryFn: () => membersApi.ledger(memberId!),
    enabled: open && !!memberId,
    staleTime: 15_000,
  });
  const debts = useMemo(
    () =>
      (ledger?.entries || []).filter(
        (e) => e.kind === "CREDIT" && !e.settled && e.journalId !== row?.id
      ),
    [ledger, row?.id]
  );

  // ----- Product orders: this visit's days, and older unpaid ones -----
  const visitIdSet = useMemo(
    () => new Set(visitIds?.length ? visitIds : row ? [row.id] : []),
    [visitIds, row]
  );
  const dayFrom = row ? startOfDay(start).getTime() : 0;
  const dayTo = row
    ? endOfDay(Math.max(start, row.leaveTime ? new Date(row.leaveTime).getTime() : nowMs)).getTime()
    : 0;
  const personOrders = useMemo(
    () =>
      products.filter((o) => {
        if (o.status === "CANCELLED" || (o.quantite || 0) <= 0) return false;
        if (memberId) return (o.memberId || o.externalRef) === memberId;
        return !!o.journalId && visitIdSet.has(o.journalId);
      }),
    [products, memberId, visitIdSet]
  );
  /** Orders of the visit: same day(s) as the visit (a visit past midnight keeps both days) */
  const cafeOrders = useMemo(
    () =>
      personOrders
        .filter((o) => !memberId || (orderAt(o) >= dayFrom && orderAt(o) <= dayTo))
        .sort((a, b) => orderAt(a) - orderAt(b)),
    [personOrders, memberId, dayFrom, dayTo]
  );

  const prevItems = useMemo((): PrevItem[] => {
    if (!row) return [];
    const items: PrevItem[] = debts.map((d) => ({
      key: `debt:${d.id}`,
      kind: "debt",
      id: d.id,
      label: d.note || "Dette",
      sub: `Crédit · ${format(new Date(d.createdAt), "dd/MM/yyyy")}`,
      amount: round3(d.amount),
    }));
    // A visit already carried by an open debt is not listed twice
    const linked = new Set(debts.map((d) => d.journalId).filter(Boolean));
    for (const v of ledger?.unpaidVisits || []) {
      if (v.isPayed || v.isOpen || visitIdSet.has(v.id) || v.id === row.id || linked.has(v.id)) continue;
      if (!(v.amount > 0.0005)) continue;
      // Same day(s) as this visit = another passage of today, not an old debt
      const at = new Date(v.registredTime).getTime();
      if (at >= dayFrom && at <= dayTo) continue;
      items.push({
        key: `visit:${v.id}`,
        kind: "visit",
        id: v.id,
        label: `Visite · ${v.forfait || "—"}`,
        sub: `Non payée · ${format(new Date(v.registredTime), "dd/MM/yyyy HH:mm")}`,
        amount: round3(v.amount),
      });
    }
    if (memberId) {
      for (const o of personOrders) {
        if (o.isPayed || orderAt(o) >= dayFrom) continue;
        items.push({
          key: `order:${o.id}`,
          kind: "order",
          id: o.id,
          label: `${o.quantite}× ${o.product?.name || "Produit"}`,
          sub: `Commande non payée · ${format(orderAt(o), "dd/MM/yyyy")}`,
          amount: orderTotal(o),
        });
      }
    }
    return items;
  }, [row, debts, ledger, visitIdSet, memberId, personOrders, dayFrom, dayTo]);
  const prevAll = round3(prevItems.reduce((s, i) => s + i.amount, 0));
  const prevPicked = prevItems.filter((i) => includePrev.has(i.key));
  const prevTotal = round3(prevPicked.reduce((s, i) => s + i.amount, 0));
  const allPrevIn = prevItems.length > 0 && prevPicked.length === prevItems.length;
  const togglePrev = (key: string) =>
    setIncludePrev((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Same kind of pass as the visit (day / open space), one per duration
  const passCategory = row && pricing?.mode === "FIXED" ? priceOf(row)?.category ?? null : null;
  const sortedTiers = useMemo(() => ladderFor(tiers, passCategory), [tiers, passCategory]);
  const currentTierId =
    pricing?.mode === "FIXED" ? pricing.fixedPriceId ?? null : null;
  const pickedTier = tierId ? sortedTiers.find((t) => t.priceId === tierId) ?? null : null;

  /** Departure instant for a visitor still on site (null = stays). */
  const leaveAtMs = useMemo(() => {
    if (!present) return row?.leaveTime ? new Date(row.leaveTime).getTime() : null;
    if (depart === "stay") return null;
    if (depart === "fixed_end" && fixedEnd) return Math.min(fixedEnd, nowMs);
    if (depart === "custom" && /^\d{2}:\d{2}$/.test(custom)) {
      const [h, m] = custom.split(":").map(Number);
      const d = new Date(start);
      d.setHours(h, m, 0, 0);
      if (d.getTime() < start) d.setDate(d.getDate() + 1);
      return Math.max(start, Math.min(d.getTime(), nowMs));
    }
    return nowMs;
  }, [present, row?.leaveTime, depart, fixedEnd, custom, start, nowMs]);

  const late = row && !present && !paid ? amountIfPaidNow(row, nowMs) : null;
  const lateHasChoice =
    !!late &&
    !pickedTier &&
    (late.extra > 0.001 ||
      (late.amountFixed != null && Math.abs(late.amountFixed - late.amountAtCheckout) > 0.001));

  /** What the visit costs with the chosen pass / departure / billing. */
  const visitAmount = useMemo(() => {
    if (!row) return 0;
    if (paid) return visitPaidAmount(row);
    const billAt = leaveAtMs ?? nowMs;
    if (pickedTier && row.pricing) {
      const p = row.pricing;
      const amount = round3(pickedTier.price * (1 - (p.discountPercent || 0) / 100));
      const res = computeSessionPricing({
        mode: "FIXED",
        registredTime: row.registredTime,
        at: billAt,
        ladder: tiers,
        rules: p.rules,
        discountPercent: p.discountPercent,
        fixed: {
          priceId: pickedTier.priceId,
          name: pickedTier.name,
          durationHours: pickedTier.durationHours,
          amount,
          category: pickedTier.category ?? null,
        },
      });
      return round3(Math.max(0, (res?.amountDue ?? amount) - (row.promoDiscount || 0)));
    }
    if (late) return lateAmountForMode(late, lateMode);
    if (present && row.pricing) {
      return rowPricingAt(row, billAt)?.amountDue ?? visitAmountDue(row, billAt);
    }
    return visitAmountDue(row, billAt);
  }, [row, paid, leaveAtMs, nowMs, pickedTier, tiers, late, lateMode, present]);

  const alreadyPaid = row && !paid ? visitPaidAmount(row) : 0;
  const visitDue = Math.max(0, round3(visitAmount - alreadyPaid));
  const balance = Number((row?.members || row?.member)?.points ?? 0);
  /** Points that can go to the visit: 1000 pts = 1 DT, 1200 pts → 1000 pts */
  const usablePoints = !paid && memberId ? redeemablePoints(balance, visitDue) : 0;
  const pointsUsed = usePoints ? usablePoints : 0;
  const pointsDt = pointsUsed / POINTS_PER_DT;
  const cafeUnpaid = cafeOrders.filter((o) => !o.isPayed);
  const cafeUnpaidTotal = round3(cafeUnpaid.reduce((s, o) => s + orderTotal(o), 0));
  const cafeDue = includeCafe ? cafeUnpaidTotal : 0;
  const total = round3(visitDue + prevTotal + cafeDue - pointsDt);
  const receivedNum = Number(String(received).replace(",", "."));
  /** Given away: only the visit, never older debts. */
  const offered =
    offerOn && received.trim() !== "" && Number.isFinite(receivedNum)
      ? round3(Math.min(visitDue - pointsDt, Math.max(0, total - receivedNum)))
      : 0;
  const toCollect = round3(total - offered);

  const payCafeOrders = async () => {
    for (const o of cafeUnpaid) await mobileApi.payOrder(o.id, true);
  };
  /** Settle the previous unpaid items the staff ticked */
  const payPrevious = async () => {
    for (const i of prevPicked) {
      if (i.kind === "debt") await membersApi.settleLedger(i.id, true);
      else if (i.kind === "visit") await mobileApi.setPayment(i.id, true, "checkout");
      else await mobileApi.payOrder(i.id, true);
    }
  };
  /** Visit already paid: what can still be collected (café + ticked old items) */
  const extrasTotal = round3(cafeUnpaidTotal + prevTotal);

  const done = (msg: string) => {
    toast.success(msg);
    queryClient.invalidateQueries({ queryKey: ["journal"] });
    queryClient.invalidateQueries({ queryKey: ["daily-products"] });
    queryClient.invalidateQueries({ queryKey: ["mobile-orders"] });
    queryClient.invalidateQueries({ queryKey: ["caisse-summary"] });
    queryClient.invalidateQueries({ queryKey: queryKeys.members });
    queryClient.invalidateQueries({ queryKey: queryKeys.debtors });
    queryClient.invalidateQueries({ queryKey: ["member-ledger"] });
    queryClient.invalidateQueries({ queryKey: ["booking-fees"] });
    queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
    onOpenChange(false);
  };

  const applyTier = async () => {
    if (pickedTier && pickedTier.priceId !== currentTierId) {
      await mobileApi.fixSessionTariff(row!.id, pickedTier.priceId);
    }
  };

  const collect = useMutation({
    mutationFn: async () => {
      await applyTier();
      if (pointsUsed > 0) {
        // Points first, while the visit is still unpaid; the rest is collected below
        await mobileApi.redeemVisitPoints({
          journalId: row!.id,
          points: pointsUsed,
          dueDt: visitDue,
          settle: false,
        });
      }
      if (present) {
        if (leaveAtMs == null) await mobileApi.setPayment(row!.id, true, undefined, offered);
        else
          await mobileApi.checkout(row!.id, {
            leaveAt: new Date(leaveAtMs).toISOString(),
            isPayed: true,
            ...(offered > 0 ? { offeredAmount: offered } : {}),
          });
      } else {
        // New pass on a finished visit is billed at the departure time
        await mobileApi.setPayment(
          row!.id,
          true,
          pickedTier ? "checkout" : lateMode,
          offered,
        );
      }
      if (cafeDue > 0) await payCafeOrders();
      await payPrevious();
    },
    onSuccess: () =>
      done(
        `Encaissé · ${formatDt(toCollect)}${
          pointsUsed > 0 ? ` · ${pointsUsed.toLocaleString("fr-FR")} pts (${formatDt(pointsDt)})` : ""
        }${cafeDue > 0 ? ` · dont café ${formatDt(cafeDue)}` : ""}${
          prevTotal > 0 ? ` · dont ancien impayé ${formatDt(prevTotal)}` : ""
        }${
          offered > 0 ? ` · offert ${formatDt(offered)}` : ""
        }`
      ),
    onError: (e: Error) => toast.error(e.message),
  });

  /** Visit already paid, café still open */
  const payCafeOnly = useMutation({
    mutationFn: async () => {
      await payCafeOrders();
      await payPrevious();
    },
    onSuccess: () => done(`Encaissé · ${formatDt(extrasTotal)}`),
    onError: (e: Error) => toast.error(e.message),
  });

  const checkoutOnly = useMutation({
    mutationFn: async () => {
      await applyTier();
      await mobileApi.checkout(row!.id, { leaveAt: new Date(leaveAtMs!).toISOString() });
    },
    onSuccess: () => done(`Check-out à ${format(leaveAtMs!, "HH:mm")} · non payé`),
    onError: (e: Error) => toast.error(e.message),
  });

  const saveTierOnly = useMutation({
    mutationFn: applyTier,
    onSuccess: () => done(`Forfait ${pickedTier?.name ?? ""} fixé`),
    onError: (e: Error) => toast.error(e.message),
  });

  const unpay = useMutation({
    mutationFn: () => mobileApi.setPayment(row!.id, false),
    onSuccess: () => done("Marqué non payé"),
    onError: (e: Error) => toast.error(e.message),
  });

  const billedAt =
    present || !lateHasChoice || lateMode === "checkout" ? leaveAtMs : lateMode === "now" ? nowMs : null;

  const busy =
    collect.isPending ||
    checkoutOnly.isPending ||
    unpay.isPending ||
    saveTierOnly.isPending ||
    payCafeOnly.isPending;
  const price = row ? priceOf(row) : null;
  const tariffLabel = pricing
    ? pricing.mode === "AUTO"
      ? `Auto · ${pricing.currentTier.name}`
      : pricing.fixedServiceName || price?.name || "Forfait"
    : price?.name || "—";

  /**
   * Tarif detail for the ticket (pack, overtime, promo). Only shown when it
   * adds up to the billed amount, else the ticket keeps one tarif line.
   */
  const tarifDetail = useMemo(() => {
    if (!row || paid || !row.pricing || !billedAt) return null;
    let res: SessionPricingResult | null = null;
    if (pickedTier) {
      const p = row.pricing;
      res = computeSessionPricing({
        mode: "FIXED",
        registredTime: row.registredTime,
        at: billedAt,
        ladder: tiers,
        rules: p.rules,
        discountPercent: p.discountPercent,
        fixed: {
          priceId: pickedTier.priceId,
          name: pickedTier.name,
          durationHours: pickedTier.durationHours,
          amount: round3(pickedTier.price * (1 - (p.discountPercent || 0) / 100)),
          category: pickedTier.category ?? null,
        },
      });
    } else {
      res = rowPricingAt(row, billedAt);
    }
    if (!res) return null;
    const promo = round3(row.promoDiscount || 0);
    const gross = round3(res.baseAmount + res.extraAmount);
    if (Math.abs(gross - visitAmount) < 0.01) return { res, promo: 0 };
    if (promo > 0 && Math.abs(gross - promo - visitAmount) < 0.01) return { res, promo };
    return null;
  }, [row, paid, billedAt, pickedTier, tiers, visitAmount]);

  const tarifName = pickedTier
    ? pickedTier.name
    : tarifDetail
      ? tarifDetail.res.currentTier.name
      : pricing?.mode === "AUTO"
        ? pricing.currentTier.name
        : pricing?.fixedServiceName || price?.name || "Visite";
  const tarifKind = pickedTier
    ? "Forfait choisi"
    : (tarifDetail?.res.mode ?? pricing?.mode) === "AUTO"
      ? "Tarif auto · palier"
      : (tarifDetail?.res.mode ?? pricing?.mode) === "FIXED"
        ? "Forfait"
        : "Tarif";
  const endMs = billedAt ?? (paid ? (row?.leaveTime ? new Date(row.leaveTime).getTime() : null) : null);
  const tarifWhen =
    !present && lateHasChoice && lateMode === "fixed"
      ? "prix du forfait, sans le temps après le départ"
      : `${format(start, "HH:mm")} → ${endMs ? format(endMs, "HH:mm") : "…"} · ${formatDurationHm(
          (endMs ?? nowMs) - start
        )}${billedAt === nowMs && !present ? " (facturé maintenant)" : ""}`;

  const departOptions: { id: Depart; label: string; hint?: string; hidden?: boolean }[] = [
    { id: "now", label: "Part maintenant", hint: format(nowMs, "HH:mm") },
    {
      id: "fixed_end",
      label: pricing?.mode === "AUTO" ? "Fin du palier" : "Fin du forfait",
      hint: fixedEnd ? format(fixedEnd, "HH:mm") : undefined,
      hidden: !fixedEnd || fixedEnd >= nowMs,
    },
    { id: "custom", label: "Heure choisie" },
    { id: "stay", label: "Il reste", hint: "payer sans partir" },
  ];

  const givenNum = given.trim() ? Number(given.replace(",", ".")) : null;
  const change = givenNum != null && Number.isFinite(givenNum) ? round3(givenNum - toCollect) : null;
  const showTarifStep = !paid && !!row?.pricing && sortedTiers.length > 0;
  const showPoints = !paid && !!memberId && balance > 0 && visitDue > 0.0005;
  const showOffer = !paid && visitDue > 0.0005;
  const showCafeStep = !paid && cafeUnpaid.length > 0;
  const hasOptions =
    present ||
    showTarifStep ||
    lateHasChoice ||
    prevItems.length > 0 ||
    showPoints ||
    showOffer ||
    showCafeStep;
  const chipTotal = paid ? (extrasTotal > 0 ? extrasTotal : visitAmount) : toCollect;
  const chipLabel = paid ? (extrasTotal > 0 ? "Reste à payer" : "Payé") : "À encaisser";
  let n = 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[92vh] w-[96vw] flex-col gap-0 overflow-hidden rounded-2xl border-0 p-0",
          hasOptions ? "max-w-4xl sm:max-w-4xl" : "max-w-md sm:max-w-md",
          "[&>button]:right-4 [&>button]:top-4 [&>button]:rounded-full [&>button]:bg-white/20 [&>button]:p-1.5 [&>button]:text-white [&>button]:opacity-100 [&>button]:transition-colors [&>button:hover]:bg-white/30"
        )}
      >
        {/* Banner — same look as the check-in modal */}
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 px-6 pb-5 pt-5 text-white">
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10" />
            <div className="absolute -bottom-14 left-1/3 h-32 w-32 rounded-full bg-white/10" />
          </div>
          <div className="relative flex flex-wrap items-end justify-between gap-4 pr-10">
            <DialogHeader className="min-w-0 space-y-1 text-left">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-100">
                Journal · Règlement
              </p>
              <DialogTitle className="flex min-w-0 items-center gap-2 text-2xl font-extrabold leading-tight text-white">
                <Wallet className="h-6 w-6 shrink-0" />
                <span className="truncate">{row ? visitorLabel(row) : ""}</span>
              </DialogTitle>
              <DialogDescription className="truncate text-[13px] text-indigo-100">
                {tariffLabel}
                {row?.pricing?.discountPercent ? ` · remise membre −${row.pricing.discountPercent}%` : ""}
              </DialogDescription>
            </DialogHeader>
            {row ? (
              <div className="flex flex-wrap gap-2">
                <BannerChip label="Arrivée" value={format(start, "HH:mm")} />
                <BannerChip label="Durée" value={formatDurationHm((leaveAtMs ?? nowMs) - start)} />
                {prevAll > 0 ? (
                  <BannerChip label="Ancien impayé" value={formatDt(prevAll)} alert />
                ) : null}
                <BannerChip label={chipLabel} value={formatDt(chipTotal)} strong />
              </div>
            ) : null}
          </div>
        </div>

        {row ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
            {hasOptions ? (
              <div className="min-w-0 flex-1 space-y-5 p-5 md:overflow-y-auto">
                {prevItems.length ? (
                  <section
                    className={cn(
                      "animate-in fade-in-0 slide-in-from-top-1 rounded-2xl border-2 p-3 duration-200 motion-reduce:animate-none",
                      "transition-colors duration-200 motion-reduce:transition-none",
                      prevPicked.length
                        ? "border-rose-500 bg-rose-50 dark:bg-rose-950/30"
                        : "border-rose-300 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/20"
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-600 text-white">
                          <AlertTriangle className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-rose-800 dark:text-rose-200">
                            Paiement précédent non réglé · {formatDt(prevAll)}
                          </p>
                          <p className="text-xs text-rose-700/80 dark:text-rose-300/80">
                            {prevItems.length} élément{prevItems.length > 1 ? "s" : ""} ·{" "}
                            {prevPicked.length
                              ? `${formatDt(prevTotal)} inclus dans le total`
                              : "pas compté tant que vous ne l’incluez pas"}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={allPrevIn ? "outline" : "default"}
                        className={cn(
                          "h-9 rounded-xl font-bold transition-colors duration-200",
                          !allPrevIn && "bg-rose-600 text-white hover:bg-rose-700"
                        )}
                        onClick={() =>
                          setIncludePrev(allPrevIn ? new Set() : new Set(prevItems.map((i) => i.key)))
                        }
                      >
                        {allPrevIn ? "Retirer" : `Inclure · ${formatDt(prevAll)}`}
                      </Button>
                    </div>
                    <div className="mt-2.5 space-y-1.5">
                      {prevItems.map((it) => {
                        const on = includePrev.has(it.key);
                        return (
                          <label
                            key={it.key}
                            className={cn(
                              "flex cursor-pointer items-center gap-3 rounded-xl bg-background px-3 py-2 text-sm ring-1 transition-[box-shadow,opacity] duration-200 motion-reduce:transition-none",
                              on ? "ring-2 ring-rose-500" : "opacity-80 ring-rose-200 dark:ring-rose-900"
                            )}
                          >
                            <Checkbox checked={on} onCheckedChange={() => togglePrev(it.key)} />
                            {it.kind === "order" ? (
                              <Coffee className="h-3.5 w-3.5 shrink-0 text-amber-700" />
                            ) : null}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{it.label}</span>
                              <span className="block truncate text-xs text-muted-foreground">{it.sub}</span>
                            </span>
                            <span className="font-semibold tabular-nums">{formatDt(it.amount)}</span>
                          </label>
                        );
                      })}
                    </div>
                  </section>
                ) : null}

                {present ? (
                  <Section n={++n} title="Départ">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {departOptions
                        .filter((o) => !o.hidden)
                        .map((o) => (
                          <Choice key={o.id} active={depart === o.id} onClick={() => setDepart(o.id)}>
                            <span className="block text-sm font-bold">{o.label}</span>
                            {o.hint ? (
                              <span className="block text-xs text-muted-foreground">{o.hint}</span>
                            ) : null}
                          </Choice>
                        ))}
                    </div>
                    <Reveal show={depart === "custom"}>
                      <Input
                        type="time"
                        value={custom}
                        onChange={(e) => setCustom(e.target.value)}
                        className="mt-2 h-11 w-36 rounded-xl"
                        aria-label="Heure de départ"
                      />
                    </Reveal>
                  </Section>
                ) : null}

                {showTarifStep ? (
                  <Section n={++n} title="Tarif">
                    <div className="flex flex-wrap gap-2">
                      <Choice active={!pickedTier} onClick={() => setTierId(null)} compact>
                        <span className="font-bold">Garder</span>{" "}
                        <span className="text-muted-foreground">· {tariffLabel}</span>
                      </Choice>
                      {sortedTiers.map((t) => (
                        <Choice
                          key={t.priceId}
                          active={tierId === t.priceId}
                          onClick={() => setTierId(t.priceId === currentTierId ? null : t.priceId)}
                          compact
                        >
                          <span className="font-bold">{t.name}</span>{" "}
                          <span className="tabular-nums text-muted-foreground">
                            {formatDt(round3(t.price * (1 - (row.pricing?.discountPercent || 0) / 100)))}
                          </span>
                        </Choice>
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Resté moins (ou plus) longtemps ? Choisissez le pass : le montant est recalculé
                      {present ? "" : " à l’heure de départ"}.
                    </p>
                  </Section>
                ) : null}

                {lateHasChoice && late ? (
                  <Section n={++n} title="Parti sans payer · montant">
                    <LateBillingChoice value={lateMode} onChange={setLateMode} info={late} compact />
                  </Section>
                ) : null}

                {showCafeStep ? (
                  <Section title="Consommation" icon={<Coffee className="h-3.5 w-3.5" />}>
                    <div className="flex flex-wrap gap-2">
                      <Choice active={includeCafe} onClick={() => setIncludeCafe(true)} compact>
                        <span className="font-bold">Payer avec la visite</span>{" "}
                        <span className="tabular-nums text-muted-foreground">
                          · {formatDt(cafeUnpaidTotal)}
                        </span>
                      </Choice>
                      <Choice active={!includeCafe} onClick={() => setIncludeCafe(false)} compact>
                        <span className="font-bold">Plus tard</span>{" "}
                        <span className="text-muted-foreground">· reste à payer</span>
                      </Choice>
                    </div>
                  </Section>
                ) : null}

                {showPoints ? (
                  <Section title="Points fidélité" icon={<Wallet className="h-3.5 w-3.5" />}>
                    {usablePoints > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        <Choice active={!usePoints} onClick={() => setUsePoints(false)} compact>
                          <span className="font-bold">Sans points</span>
                        </Choice>
                        <Choice active={usePoints} onClick={() => setUsePoints(true)} compact>
                          <span className="font-bold">
                            Utiliser {usablePoints.toLocaleString("fr-FR")} pts
                          </span>{" "}
                          <span className="text-muted-foreground">
                            · −{formatDt(usablePoints / POINTS_PER_DT)}
                          </span>
                        </Choice>
                      </div>
                    ) : null}
                    <p className="pt-1.5 text-xs text-muted-foreground">
                      Solde {balance.toLocaleString("fr-FR")} pts · par tranche de 1 000 pts = 1 DT
                      {usablePoints <= 0
                        ? balance < POINTS_PER_DT
                          ? " · pas encore 1 000 pts"
                          : " · moins de 1 DT à payer"
                        : balance > usablePoints && usePoints
                          ? ` · il garde ${(balance - usablePoints).toLocaleString("fr-FR")} pts`
                          : ""}
                    </p>
                  </Section>
                ) : null}

                {showOffer ? (
                  <Section title="Remise offerte" icon={<Gift className="h-3.5 w-3.5" />}>
                    <div className="flex flex-wrap gap-2">
                      <Choice active={!offerOn} onClick={() => setOfferOn(false)} compact>
                        <span className="font-bold">Prix complet</span>
                      </Choice>
                      <Choice
                        active={offerOn}
                        onClick={() => {
                          setOfferOn(true);
                          if (!received) setReceived(String(Math.floor(total)));
                        }}
                        compact
                      >
                        <span className="font-bold">Offrir une partie</span>{" "}
                        <span className="text-muted-foreground">· sans dette</span>
                      </Choice>
                    </div>
                    <Reveal show={offerOn}>
                      <div className="flex flex-wrap items-end gap-2 pt-2">
                        <div className="space-y-1">
                          <label htmlFor="regler-received" className="text-xs text-muted-foreground">
                            Montant reçu (DT)
                          </label>
                          <Input
                            id="regler-received"
                            inputMode="decimal"
                            value={received}
                            onChange={(e) => setReceived(e.target.value)}
                            className="h-10 w-28 rounded-xl"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 rounded-xl"
                          onClick={() => setReceived(String(round3(prevTotal + cafeDue)))}
                        >
                          Visite gratuite
                        </Button>
                        <p className="pb-2.5 text-xs text-muted-foreground">
                          {offered > 0
                            ? `${formatDt(offered)} offert par vous · pas de reste à payer`
                            : "Tapez ce que le client a donné"}
                        </p>
                      </div>
                    </Reveal>
                  </Section>
                ) : null}
              </div>
            ) : null}

            {/* Cash-register ticket: every amount that makes the total */}
            <aside
              className={cn(
                "flex shrink-0 flex-col bg-muted/20 p-4",
                hasOptions && "border-t md:w-[360px] md:overflow-y-auto md:border-l md:border-t-0"
              )}
            >
              <div className="rounded-xl border bg-background px-4 py-3 font-mono text-[13px] shadow-sm">
                <div className="flex items-center justify-between gap-2 border-b border-dashed pb-2">
                  <span className="flex items-center gap-1.5 font-sans text-sm font-bold">
                    <ReceiptText className="h-4 w-4 text-indigo-600" />
                    Ticket
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {format(nowMs, "dd/MM/yyyy HH:mm")}
                  </span>
                </div>

                <TicketHead>Tarif</TicketHead>
                {paid ? (
                  <>
                    <TicketLine label={tarifName} sub={tarifWhen} value={formatDt(visitAmount)} />
                    {row.offeredAmount ? (
                      <TicketLine label="Offert" value={formatDt(row.offeredAmount)} tone="gift" />
                    ) : null}
                    <TicketLine label="Visite payée" value="✓" tone="ok" />
                  </>
                ) : (
                  <>
                    <TicketLine
                      label={tarifName}
                      sub={`${tarifKind} · ${tarifWhen}`}
                      value={formatDt(tarifDetail ? tarifDetail.res.baseAmount : visitAmount)}
                    />
                    {tarifDetail && tarifDetail.res.extraAmount > 0.0005 ? (
                      <TicketLine
                        label={tarifDetail.res.surchargeApplied ? "Supplément dépassement" : "Dépassement"}
                        sub={
                          tarifDetail.res.overtimeMs > 0
                            ? `${formatDurationHm(tarifDetail.res.overtimeMs)} après la fin`
                            : undefined
                        }
                        value={`+ ${formatDt(tarifDetail.res.extraAmount)}`}
                      />
                    ) : null}
                    {tarifDetail && tarifDetail.promo > 0 ? (
                      <TicketLine label="Promotion" value={`− ${formatDt(tarifDetail.promo)}`} tone="gift" />
                    ) : null}
                    {row.pricing?.discountPercent ? (
                      <TicketLine label={`dont remise membre −${row.pricing.discountPercent}%`} muted />
                    ) : null}
                    {alreadyPaid > 0.0005 ? (
                      <TicketLine label="Déjà payé" value={`− ${formatDt(alreadyPaid)}`} muted />
                    ) : null}
                    <TicketLine label="Sous-total tarif" value={formatDt(visitDue)} strong />
                  </>
                )}

                {cafeOrders.length ? (
                  <>
                    <TicketHead>Consommation</TicketHead>
                    {cafeOrders.map((o) => {
                      const counted = !o.isPayed && includeCafe && !paid;
                      return (
                        <TicketLine
                          key={o.id}
                          label={`${o.quantite}× ${o.product?.name || "Produit"}`}
                          sub={`${o.quantite} × ${formatDt(orderUnitPrice(o))}${
                            o.isPayed ? " · déjà payé" : !counted && !paid ? " · plus tard" : ""
                          }`}
                          value={formatDt(orderTotal(o))}
                          muted={o.isPayed || (!includeCafe && !paid)}
                          strike={o.isPayed}
                        />
                      );
                    })}
                    <TicketLine
                      label={paid ? "Café à payer" : "Sous-total café"}
                      value={formatDt(paid ? cafeUnpaidTotal : cafeDue)}
                      strong
                    />
                  </>
                ) : null}

                {prevPicked.length ? (
                  <>
                    <TicketHead>Ancien impayé</TicketHead>
                    {prevPicked.map((it) => (
                      <TicketLine key={it.key} label={it.label} sub={it.sub} value={formatDt(it.amount)} tone="alert" />
                    ))}
                    <TicketLine label="Sous-total ancien impayé" value={formatDt(prevTotal)} strong tone="alert" />
                  </>
                ) : null}

                {!paid && (pointsUsed > 0 || offered > 0) ? (
                  <>
                    <TicketHead>Autres</TicketHead>
                    {pointsUsed > 0 ? (
                      <TicketLine
                        label={`Points · ${pointsUsed.toLocaleString("fr-FR")} pts`}
                        value={`− ${formatDt(pointsDt)}`}
                        tone="points"
                      />
                    ) : null}
                    {offered > 0 ? (
                      <TicketLine label="Offert" value={`− ${formatDt(offered)}`} tone="gift" />
                    ) : null}
                  </>
                ) : null}

                <div className="mt-2 flex items-baseline justify-between gap-3 border-t-2 border-dashed pt-2 font-sans">
                  <span className="text-sm font-bold uppercase tracking-wide">
                    {paid ? (extrasTotal > 0 ? "À encaisser" : "Total payé") : "Total à encaisser"}
                  </span>
                  <span
                    key={chipTotal.toFixed(3)}
                    className="animate-in fade-in-0 text-2xl font-black tabular-nums duration-200 motion-reduce:animate-none"
                  >
                    {formatDt(chipTotal)}
                  </span>
                </div>
              </div>

              {(!paid && toCollect > 0.0005) || (paid && extrasTotal > 0) ? (
                <div className="mt-3 space-y-2">
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <label htmlFor="regler-given" className="text-xs text-muted-foreground">
                        Donné par le client
                      </label>
                      <Input
                        id="regler-given"
                        inputMode="decimal"
                        placeholder={chipTotal.toFixed(1)}
                        value={given}
                        onChange={(e) => setGiven(e.target.value)}
                        className="h-10 rounded-xl bg-background"
                      />
                    </div>
                    <div className="min-w-[110px] pb-2 text-right text-sm">
                      {change == null ? null : change >= 0 ? (
                        <span className="animate-in fade-in-0 font-bold text-emerald-700 duration-150 motion-reduce:animate-none">
                          Rendu {formatDt(change)}
                        </span>
                      ) : (
                        <span className="animate-in fade-in-0 font-bold text-rose-700 duration-150 motion-reduce:animate-none">
                          Manque {formatDt(-change)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {quickGivenAmounts(chipTotal).map((v) => (
                      <button
                        key={v}
                        type="button"
                        className="rounded-lg border bg-background px-2 py-0.5 text-xs tabular-nums transition-colors duration-150 hover:bg-muted"
                        onClick={() => setGiven(String(v))}
                      >
                        {v.toFixed(v % 1 ? 1 : 0)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </aside>
          </div>
        ) : null}

        <DialogFooter className="shrink-0 flex-wrap gap-2 border-t px-6 py-3 sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          <div className="flex flex-wrap justify-end gap-2">
            {paid ? (
              <>
                <Button variant="outline" className="rounded-xl" disabled={busy} onClick={() => unpay.mutate()}>
                  Marquer non payé
                </Button>
                {present && leaveAtMs ? (
                  <Button variant="outline" className="rounded-xl" disabled={busy} onClick={() => checkoutOnly.mutate()}>
                    Check-out à {format(leaveAtMs, "HH:mm")}
                  </Button>
                ) : null}
                {extrasTotal > 0 ? (
                  <Button
                    disabled={busy}
                    className="gap-1.5 rounded-xl bg-emerald-600 px-5 font-bold text-white transition-colors hover:bg-emerald-700"
                    onClick={() => payCafeOnly.mutate()}
                  >
                    <Coffee className="h-4 w-4" />
                    Encaisser {formatDt(extrasTotal)}
                    <span className="font-medium opacity-80">
                      · {[cafeUnpaidTotal > 0 && "café", prevTotal > 0 && "ancien impayé"].filter(Boolean).join(" + ")}
                    </span>
                  </Button>
                ) : null}
              </>
            ) : (
              <>
                {present && leaveAtMs ? (
                  <Button variant="outline" className="rounded-xl" disabled={busy} onClick={() => checkoutOnly.mutate()}>
                    Check-out sans payer
                  </Button>
                ) : !present && pickedTier ? (
                  <Button variant="outline" className="rounded-xl" disabled={busy} onClick={() => saveTierOnly.mutate()}>
                    Changer le tarif seulement
                  </Button>
                ) : null}
                <Button
                  disabled={busy}
                  className="gap-1.5 rounded-xl bg-emerald-600 px-5 font-bold text-white transition-colors hover:bg-emerald-700"
                  onClick={() => collect.mutate()}
                >
                  {toCollect <= 0.0005 && pointsUsed > 0 ? (
                    <>
                      <Check className="h-4 w-4" />
                      Payer en points
                    </>
                  ) : (
                    <>
                      <Banknote className="h-4 w-4" />
                      Encaisser {formatDt(toCollect)}
                      {cafeDue > 0 || prevTotal > 0 ? (
                        <span className="font-medium opacity-80">
                          · {[cafeDue > 0 && "café", prevTotal > 0 && "ancien impayé"].filter(Boolean).join(" + ")} inclus
                        </span>
                      ) : null}
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Glass chip in the banner — same as the check-in modal. */
function BannerChip({
  label,
  value,
  strong,
  alert,
}: {
  label: string;
  value: string;
  strong?: boolean;
  alert?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-[84px] rounded-2xl px-3 py-2 text-center backdrop-blur-sm",
        alert
          ? "animate-in fade-in-0 zoom-in-95 bg-rose-500/90 ring-1 ring-rose-200/60 duration-200 motion-reduce:animate-none"
          : strong
            ? "bg-white/25 ring-1 ring-white/40"
            : "bg-white/15"
      )}
    >
      <p className={cn("text-[10px] font-bold uppercase tracking-wide", alert ? "text-rose-50" : "text-indigo-100")}>
        {label}
      </p>
      <p
        key={value}
        className="animate-in fade-in-0 text-base font-black tabular-nums duration-200 motion-reduce:animate-none"
      >
        {value}
      </p>
    </div>
  );
}

function Section({
  n,
  title,
  icon,
  children,
}: {
  n?: number;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200 motion-reduce:animate-none">
      <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[11px] text-white">
          {n ?? icon}
        </span>
        {title}
      </p>
      {children}
    </section>
  );
}

/** Selectable card — same look as the check-in choice cards. */
function Choice({
  active,
  onClick,
  compact,
  children,
}: {
  active: boolean;
  onClick: () => void;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-xl border-2 text-left text-sm transition-all duration-200 motion-reduce:transition-none",
        compact ? "px-3 py-1.5" : "px-3 py-2",
        active
          ? "border-indigo-600 bg-indigo-50 shadow-sm dark:bg-indigo-950/40"
          : "border-transparent bg-muted/50 hover:border-muted-foreground/20 hover:bg-muted"
      )}
    >
      {children}
    </button>
  );
}

/** Height + fade transition for a block that opens. */
function Reveal({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-200 motion-reduce:transition-none",
        show ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      )}
      aria-hidden={!show}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

function TicketHead({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2.5 mb-1 font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </p>
  );
}

function TicketLine({
  label,
  sub,
  value,
  strong,
  muted,
  strike,
  tone,
}: {
  label: string;
  sub?: string;
  value?: string;
  strong?: boolean;
  muted?: boolean;
  strike?: boolean;
  tone?: "gift" | "points" | "ok" | "alert";
}) {
  return (
    <div
      className={cn(
        "animate-in fade-in-0 py-0.5 duration-200 motion-reduce:animate-none",
        strong && "mt-1 border-t border-dotted pt-1 font-bold",
        muted && "text-muted-foreground",
        tone === "gift" && "text-emerald-700 dark:text-emerald-400",
        tone === "points" && "text-indigo-600 dark:text-indigo-400",
        tone === "ok" && "text-emerald-700 dark:text-emerald-400",
        tone === "alert" && "text-rose-700 dark:text-rose-400"
      )}
    >
      <div className="flex justify-between gap-3">
        <span className={cn("min-w-0", strike && "line-through")}>{label}</span>
        {value ? <span className={cn("shrink-0 tabular-nums", strike && "line-through")}>{value}</span> : null}
      </div>
      {sub ? <p className="text-[11px] font-normal leading-snug text-muted-foreground">{sub}</p> : null}
    </div>
  );
}
