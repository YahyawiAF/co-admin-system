"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Check, Gift, Receipt, Wallet } from "lucide-react";
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
import { membersApi, mobileApi } from "@/lib/api/resources";
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
import { computeSessionPricing, formatDt, ladderFor, type PricingTier } from "@/lib/session-pricing";
import { POINTS_PER_DT, redeemablePoints } from "@/lib/points-catalog";
import type { Journal, LateBillingMode } from "@/lib/types";
import { cn } from "@/lib/utils";

type Depart = "stay" | "now" | "fixed_end" | "custom";

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * One place to settle a visit: departure time (forgotten check-out),
 * pass change (stayed less / longer), late-payment billing, old debts
 * (e.g. fee of a cancelled reservation), then collect.
 */
export function JournalReglerDialog({
  row,
  tiers,
  onOpenChange,
}: {
  row: Journal | null;
  tiers: PricingTier[];
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
  const [skipDebt, setSkipDebt] = useState<Set<string>>(new Set());
  /** "Offert": staff gives part of the visit away — collected less, no debt */
  const [offerOn, setOfferOn] = useState(false);
  const [received, setReceived] = useState("");
  /** Pay part of the visit with loyalty points (whole 1000-pt blocks) */
  const [usePoints, setUsePoints] = useState(false);
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
    setSkipDebt(new Set());
    setOfferOn(false);
    setReceived("");
    setUsePoints(false);
  }, [row?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: ledger } = useQuery({
    queryKey: ["member-ledger", memberId],
    queryFn: () => membersApi.ledger(memberId!),
    enabled: open && !!memberId && !paid,
    staleTime: 15_000,
  });
  const debts = useMemo(
    () =>
      (ledger?.entries || []).filter(
        (e) => e.kind === "CREDIT" && !e.settled && e.journalId !== row?.id
      ),
    [ledger, row?.id]
  );

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
  const debtTotal = round3(
    debts.filter((d) => !skipDebt.has(d.id)).reduce((s, d) => s + d.amount, 0)
  );
  const balance = Number((row?.members || row?.member)?.points ?? 0);
  /** Points that can go to the visit: 1000 pts = 1 DT, 1200 pts → 1000 pts */
  const usablePoints = !paid && memberId ? redeemablePoints(balance, visitDue) : 0;
  const pointsUsed = usePoints ? usablePoints : 0;
  const pointsDt = pointsUsed / POINTS_PER_DT;
  const total = round3(visitDue + debtTotal - pointsDt);
  const receivedNum = Number(String(received).replace(",", "."));
  /** Given away: only the visit, never older debts. */
  const offered =
    offerOn && received.trim() !== "" && Number.isFinite(receivedNum)
      ? round3(Math.min(visitDue - pointsDt, Math.max(0, total - receivedNum)))
      : 0;
  const toCollect = round3(total - offered);

  const done = (msg: string) => {
    toast.success(msg);
    queryClient.invalidateQueries({ queryKey: ["journal"] });
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
      for (const d of debts) {
        if (!skipDebt.has(d.id)) await membersApi.settleLedger(d.id, true);
      }
    },
    onSuccess: () =>
      done(
        `Encaissé · ${formatDt(toCollect)}${
          pointsUsed > 0 ? ` · ${pointsUsed.toLocaleString("fr-FR")} pts (${formatDt(pointsDt)})` : ""
        }${offered > 0 ? ` · offert ${formatDt(offered)}` : ""}`
      ),
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
  const visitLine =
    !present && lateHasChoice && lateMode === "fixed"
      ? "Visite · prix du forfait"
      : billedAt
        ? `Visite jusqu’à ${format(billedAt, "HH:mm")}${billedAt === nowMs && !present ? " (maintenant)" : ""}`
        : "Visite";

  const busy = collect.isPending || checkoutOnly.isPending || unpay.isPending || saveTierOnly.isPending;
  const price = row ? priceOf(row) : null;
  const tariffLabel = pricing
    ? pricing.mode === "AUTO"
      ? `Auto · ${pricing.currentTier.name}`
      : pricing.fixedServiceName || price?.name || "Forfait"
    : price?.name || "—";

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Régler · {row ? visitorLabel(row) : ""}</DialogTitle>
          <DialogDescription>
            {row
              ? `Arrivé ${format(start, "HH:mm")}${
                  row.leaveTime ? ` · parti ${format(new Date(row.leaveTime), "HH:mm")}` : ""
                } · ${formatDurationHm((leaveAtMs ?? nowMs) - start)} · ${tariffLabel}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {row ? (
          <div className="space-y-4">
            {present ? (
              <Section n={1} title="Départ">
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {departOptions
                    .filter((o) => !o.hidden)
                    .map((o) => (
                      <Choice key={o.id} active={depart === o.id} onClick={() => setDepart(o.id)}>
                        <span className="block font-semibold">{o.label}</span>
                        {o.hint ? <span className="block text-[11px] opacity-75">{o.hint}</span> : null}
                      </Choice>
                    ))}
                </div>
                <Reveal show={depart === "custom"}>
                  <Input
                    type="time"
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    className="mt-2 w-36"
                    aria-label="Heure de départ"
                  />
                </Reveal>
              </Section>
            ) : null}

            {!paid && row.pricing && sortedTiers.length ? (
              <Section n={present ? 2 : 1} title="Tarif">
                <div className="flex flex-wrap gap-1.5">
                  <Choice active={!pickedTier} onClick={() => setTierId(null)} compact>
                    <span className="font-semibold">Garder</span>{" "}
                    <span className="opacity-75">· {tariffLabel}</span>
                  </Choice>
                  {sortedTiers.map((t) => (
                    <Choice
                      key={t.priceId}
                      active={tierId === t.priceId}
                      onClick={() => setTierId(t.priceId === currentTierId ? null : t.priceId)}
                      compact
                    >
                      <span className="font-semibold">{t.name}</span>{" "}
                      <span className="tabular-nums opacity-75">
                        {formatDt(round3(t.price * (1 - (row.pricing?.discountPercent || 0) / 100)))}
                      </span>
                    </Choice>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Resté moins (ou plus) longtemps ? Choisissez le pass : le montant est recalculé
                  {present ? "" : " à l’heure de départ"}.
                </p>
              </Section>
            ) : null}

            {lateHasChoice && late ? (
              <Section n={present ? 3 : 2} title="Parti sans payer · montant">
                <LateBillingChoice value={lateMode} onChange={setLateMode} info={late} compact />
              </Section>
            ) : null}

            {debts.length ? (
              <Section title="Dettes précédentes" icon={<Receipt className="h-3.5 w-3.5" />}>
                <div className="space-y-1.5">
                  {debts.map((d) => (
                    <label
                      key={d.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg bg-rose-50 px-3 py-2 text-sm ring-1 ring-rose-200 dark:bg-rose-950/30 dark:ring-rose-900"
                    >
                      <Checkbox
                        checked={!skipDebt.has(d.id)}
                        onCheckedChange={(v) =>
                          setSkipDebt((prev) => {
                            const next = new Set(prev);
                            if (v === true) next.delete(d.id);
                            else next.add(d.id);
                            return next;
                          })
                        }
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {d.note || "Dette"}
                        <span className="ml-1 text-xs text-muted-foreground">
                          · {format(new Date(d.createdAt), "dd/MM")}
                        </span>
                      </span>
                      <span className="font-semibold tabular-nums">{formatDt(d.amount)}</span>
                    </label>
                  ))}
                </div>
              </Section>
            ) : null}

            {!paid && memberId && balance > 0 && visitDue > 0.0005 ? (
              <Section title="Points fidélité" icon={<Wallet className="h-3.5 w-3.5" />}>
                {usablePoints > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    <Choice active={!usePoints} onClick={() => setUsePoints(false)} compact>
                      <span className="font-semibold">Sans points</span>
                    </Choice>
                    <Choice active={usePoints} onClick={() => setUsePoints(true)} compact>
                      <span className="font-semibold">
                        Utiliser {usablePoints.toLocaleString("fr-FR")} pts
                      </span>{" "}
                      <span className="opacity-75">· −{formatDt(usablePoints / POINTS_PER_DT)}</span>
                    </Choice>
                  </div>
                ) : null}
                <p className="pt-1.5 text-[11px] text-muted-foreground">
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

            {!paid && visitDue > 0.0005 ? (
              <Section title="Remise offerte" icon={<Gift className="h-3.5 w-3.5" />}>
                <div className="flex flex-wrap gap-1.5">
                  <Choice active={!offerOn} onClick={() => setOfferOn(false)} compact>
                    <span className="font-semibold">Prix complet</span>
                  </Choice>
                  <Choice
                    active={offerOn}
                    onClick={() => {
                      setOfferOn(true);
                      if (!received) setReceived(String(Math.floor(total)));
                    }}
                    compact
                  >
                    <span className="font-semibold">Offrir une partie</span>{" "}
                    <span className="opacity-75">· sans dette</span>
                  </Choice>
                </div>
                <Reveal show={offerOn}>
                  <div className="flex flex-wrap items-end gap-2 pt-2">
                    <div className="space-y-1">
                      <label htmlFor="regler-received" className="text-[11px] text-muted-foreground">
                        Montant reçu (DT)
                      </label>
                      <Input
                        id="regler-received"
                        inputMode="decimal"
                        value={received}
                        onChange={(e) => setReceived(e.target.value)}
                        className="h-9 w-28"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9"
                      onClick={() => setReceived(String(debtTotal))}
                    >
                      Visite gratuite
                    </Button>
                    <p className="pb-2 text-[11px] text-muted-foreground">
                      {offered > 0
                        ? `${formatDt(offered)} offert par vous · pas de reste à payer`
                        : "Tapez ce que le client a donné"}
                    </p>
                  </div>
                </Reveal>
              </Section>
            ) : null}

            <div className="space-y-1 rounded-xl bg-muted/60 px-3 py-2.5 text-sm">
              {paid ? (
                <>
                  <Line label="Payé" value={formatDt(visitAmount)} strong />
                  {row.offeredAmount ? (
                    <Line label="Offert" value={formatDt(row.offeredAmount)} muted />
                  ) : null}
                </>
              ) : (
                <>
                  <Line label={visitLine} value={formatDt(visitAmount)} />
                  {row.pricing?.discountPercent ? (
                    <Line
                      label={`Remise membre −${row.pricing.discountPercent}% incluse`}
                      value=""
                      muted
                    />
                  ) : null}
                  {alreadyPaid > 0.0005 ? (
                    <Line label="Déjà payé" value={`− ${formatDt(alreadyPaid)}`} muted />
                  ) : null}
                  {debtTotal > 0.0005 ? <Line label="Dettes" value={`+ ${formatDt(debtTotal)}`} /> : null}
                  {pointsUsed > 0 ? (
                    <Line
                      label={`Points · ${pointsUsed.toLocaleString("fr-FR")} pts`}
                      value={`− ${formatDt(pointsDt)}`}
                      tone="points"
                    />
                  ) : null}
                  {offered > 0 ? (
                    <Line label="Offert" value={`− ${formatDt(offered)}`} tone="gift" />
                  ) : null}
                  <div className="my-1 border-t" />
                  <Line label="À encaisser" value={formatDt(toCollect)} strong />
                </>
              )}
            </div>
          </div>
        ) : null}

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          {paid ? (
            <>
              <Button variant="outline" disabled={busy} onClick={() => unpay.mutate()}>
                Marquer non payé
              </Button>
              {present && leaveAtMs ? (
                <Button disabled={busy} onClick={() => checkoutOnly.mutate()}>
                  Check-out à {format(leaveAtMs, "HH:mm")}
                </Button>
              ) : null}
            </>
          ) : (
            <>
              {present && leaveAtMs ? (
                <Button variant="outline" disabled={busy} onClick={() => checkoutOnly.mutate()}>
                  Check-out sans payer
                </Button>
              ) : !present && pickedTier ? (
                <Button variant="outline" disabled={busy} onClick={() => saveTierOnly.mutate()}>
                  Changer le tarif seulement
                </Button>
              ) : null}
              <Button
                disabled={busy}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => collect.mutate()}
              >
                <Check className="h-4 w-4" />
                {toCollect <= 0.0005 && pointsUsed > 0
                  ? "Payer en points"
                  : `Encaisser ${formatDt(toCollect)}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {n ? (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-[10px] text-background">
            {n}
          </span>
        ) : (
          icon
        )}
        {title}
      </p>
      {children}
    </section>
  );
}

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
        "rounded-lg border text-left text-sm transition-[background-color,border-color,color,box-shadow] duration-150 motion-reduce:transition-none",
        compact ? "px-2.5 py-1.5 text-xs" : "px-2.5 py-2",
        active
          ? "border-primary bg-primary/10 text-foreground shadow-[inset_0_0_0_1px_hsl(var(--primary))]"
          : "bg-background hover:bg-muted/70"
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

function Line({
  label,
  value,
  strong,
  muted,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
  tone?: "gift" | "points";
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-3",
        strong && "text-base font-bold",
        muted && "text-xs text-muted-foreground",
        tone === "gift" &&
          "font-medium text-emerald-700 animate-in fade-in-0 duration-200 motion-reduce:animate-none dark:text-emerald-400",
        tone === "points" &&
          "font-medium text-indigo-600 animate-in fade-in-0 slide-in-from-top-1 duration-200 motion-reduce:animate-none dark:text-indigo-400"
      )}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
