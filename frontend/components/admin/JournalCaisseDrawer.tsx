"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format, isSameDay } from "date-fns";
import { Banknote, Check, Coffee, LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { mobileApi, type DailyProduct } from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import type { Journal, LateBillingMode } from "@/lib/types";
import {
  amountIfPaidNow,
  isActiveVisit,
  isLeftUnpaid,
  journalPersonKey,
  lateAmountForMode,
  visitBalanceDue,
  visitorLabel,
} from "@/lib/journal-utils";
import { LateBillingChoice } from "@/components/admin/LateBillingChoice";

type VisitLine = {
  row: Journal;
  kind: "present" | "left_unpaid" | "balance";
  amount: number;
};

type PersonCard = {
  key: string;
  label: string;
  memberId: string | null;
  visits: VisitLine[];
  orders: DailyProduct[];
  ordersTotal: number;
  total: number;
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const money = (n: number) => `${n.toFixed(1)} DT`;

/** Cash amounts a customer is likely to hand over for `due`. */
function quickGivenAmounts(due: number): number[] {
  if (due <= 0) return [];
  const steps = [5, 10, 20, 50];
  const out = new Set<number>([round1(due)]);
  for (const s of steps) {
    const v = Math.ceil(due / s) * s;
    if (v > due + 0.05) out.add(v);
  }
  return [...out].sort((a, b) => a - b).slice(0, 4);
}

function parseGiven(v: string): number | null {
  const n = Number(v.replace(",", "."));
  return v.trim() && Number.isFinite(n) ? n : null;
}

export function JournalCaisseDrawer({
  open,
  onOpenChange,
  rows,
  dailyProducts,
  date,
  now,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Selected journal visits (raw passages). */
  rows: Journal[];
  dailyProducts: DailyProduct[];
  date: Date;
  now: number;
  /** Called after "Tout encaisser" succeeds (e.g. clear the selection). */
  onDone?: () => void;
}) {
  const queryClient = useQueryClient();
  const [billing, setBilling] = useState<LateBillingMode>("now");
  const [doCheckout, setDoCheckout] = useState(true);
  const [markPaid, setMarkPaid] = useState(true);
  const [given, setGiven] = useState<Record<string, string>>({});
  const [groupGiven, setGroupGiven] = useState("");
  const [paidCards, setPaidCards] = useState<Record<string, number>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setGiven({});
    setGroupGiven("");
    setPaidCards({});
    setBilling("now");
    setDoCheckout(true);
    setMarkPaid(true);
  }, [open]);

  const dayKey = format(date, "yyyy-MM-dd");

  const cards = useMemo((): PersonCard[] => {
    const byKey = new Map<string, PersonCard>();
    for (const row of rows) {
      if (row.isReservation) continue;
      const key = journalPersonKey(row);
      let card = byKey.get(key);
      if (!card) {
        card = {
          key,
          label: visitorLabel(row),
          memberId: row.memberID || null,
          visits: [],
          orders: [],
          ordersTotal: 0,
          total: 0,
        };
        byKey.set(key, card);
      }
      let line: VisitLine | null = null;
      if (isActiveVisit(row)) {
        line = { row, kind: "present", amount: visitBalanceDue(row, now) };
      } else if (isLeftUnpaid(row)) {
        const info = amountIfPaidNow(row, now);
        line = {
          row,
          kind: "left_unpaid",
          amount: info ? lateAmountForMode(info, billing) : row.payedAmount || 0,
        };
      } else {
        const bal = visitBalanceDue(row, now);
        if (bal > 0.009) line = { row, kind: "balance", amount: bal };
      }
      if (line) card.visits.push(line);
    }
    for (const card of byKey.values()) {
      if (card.memberId) {
        card.orders = dailyProducts.filter((dp) => {
          const mid = dp.memberId || dp.externalRef;
          if (mid !== card.memberId) return false;
          if (dp.status === "CANCELLED" || dp.isPayed) return false;
          return !dp.date || isSameDay(new Date(dp.date), date);
        });
        card.ordersTotal = card.orders.reduce(
          (s, dp) => s + (dp.product?.sellingPrice || 0) * (dp.quantite || 0),
          0
        );
      }
      card.total = round1(
        card.visits.reduce((s, v) => s + v.amount, 0) + card.ordersTotal
      );
    }
    return [...byKey.values()].filter(
      (c) => c.visits.length > 0 || c.orders.length > 0
    );
  }, [rows, dailyProducts, date, now, billing]);

  const pendingCards = cards.filter((c) => paidCards[c.key] == null);
  const groupTotal = round1(pendingCards.reduce((s, c) => s + c.total, 0));
  const collectedTotal = round1(
    Object.values(paidCards).reduce((s, v) => s + v, 0)
  );
  const hasLeftUnpaid = cards.some((c) =>
    c.visits.some((v) => v.kind === "left_unpaid")
  );
  const presentCount = cards.reduce(
    (s, c) => s + c.visits.filter((v) => v.kind === "present").length,
    0
  );
  const groupGivenNum = parseGiven(groupGiven);
  const nothingToDo = !doCheckout && !markPaid;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["journal"] });
    queryClient.invalidateQueries({ queryKey: ["daily-products"] });
    queryClient.invalidateQueries({ queryKey: ["bookings"] });
    queryClient.invalidateQueries({ queryKey: ["facility-occupancy"] });
    queryClient.invalidateQueries({ queryKey: ["caisse-summary"] });
    queryClient.invalidateQueries({ queryKey: queryKeys.members });
    queryClient.invalidateQueries({ queryKey: queryKeys.debtors });
  };

  const settleCard = async (card: PersonCard) => {
    for (const v of card.visits) {
      if (v.kind === "present") {
        if (doCheckout) {
          await mobileApi.checkout(v.row.id, markPaid ? { isPayed: true } : {});
        } else if (markPaid && v.amount > 0.009) {
          await mobileApi.setPayment(v.row.id, true);
        }
      } else if (markPaid && v.amount > 0.009) {
        await mobileApi.setPayment(
          v.row.id,
          true,
          v.kind === "left_unpaid" ? billing : undefined
        );
      }
    }
    if (markPaid && card.memberId && card.orders.length) {
      await mobileApi.payMemberDayOrders(card.memberId, true, dayKey);
    }
  };

  const payOne = async (card: PersonCard) => {
    setBusyKey(card.key);
    try {
      await settleCard(card);
      setPaidCards((p) => ({ ...p, [card.key]: card.total }));
      toast.success(`${card.label} · ${money(card.total)} encaissé`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyKey(null);
      invalidate();
    }
  };

  const payAll = async () => {
    setBusyKey("__all__");
    const done: Record<string, number> = {};
    let failed = 0;
    for (const card of pendingCards) {
      try {
        await settleCard(card);
        done[card.key] = card.total;
      } catch (e) {
        failed++;
        toast.error(`${card.label} : ${(e as Error).message}`);
      }
    }
    setPaidCards((p) => ({ ...p, ...done }));
    setBusyKey(null);
    invalidate();
    const n = Object.keys(done).length;
    if (n > 0) {
      const sum = round1(Object.values(done).reduce((s, v) => s + v, 0));
      toast.success(
        `${n} personne${n > 1 ? "s" : ""} encaissée${n > 1 ? "s" : ""} · ${money(sum)}`
      );
    }
    if (!failed) {
      onDone?.();
      onOpenChange(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
      >
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-emerald-600" />
            Caisse
          </SheetTitle>
          <SheetDescription>
            {cards.length} personne{cards.length > 1 ? "s" : ""} · visites et
            commandes impayées du jour. Paiement en espèces.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {!cards.length ? (
            <p className="rounded-lg border border-dashed px-3 py-10 text-center text-sm text-muted-foreground">
              Rien à encaisser pour la sélection.
            </p>
          ) : null}
          {cards.map((card) => {
            const paid = paidCards[card.key];
            const givenNum = parseGiven(given[card.key] ?? "");
            const diff = givenNum != null ? round1(givenNum - card.total) : null;
            return (
              <div
                key={card.key}
                className={cn(
                  "rounded-xl border bg-card p-3 shadow-sm transition-opacity",
                  paid != null && "border-emerald-300 bg-emerald-50/60 opacity-80 dark:bg-emerald-950/20"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{card.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {card.visits.length} visite{card.visits.length > 1 ? "s" : ""}
                      {card.orders.length
                        ? ` · ${card.orders.length} commande${card.orders.length > 1 ? "s" : ""}`
                        : ""}
                    </p>
                  </div>
                  {paid != null ? (
                    <Badge className="shrink-0 bg-emerald-600 hover:bg-emerald-600">
                      <Check className="mr-1 h-3 w-3" />
                      Encaissé {money(paid)}
                    </Badge>
                  ) : (
                    <span className="shrink-0 text-lg font-bold tabular-nums">
                      {money(card.total)}
                    </span>
                  )}
                </div>

                <ul className="mt-2 space-y-1 text-sm">
                  {card.visits.map((v) => (
                    <li key={v.row.id} className="flex items-center gap-2">
                      {v.kind === "present" ? (
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                          Présent
                        </Badge>
                      ) : v.kind === "left_unpaid" ? (
                        <Badge className="h-5 bg-orange-600 px-1.5 text-[10px] hover:bg-orange-600">
                          Parti sans payer
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                          Reste
                        </Badge>
                      )}
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {format(new Date(v.row.registredTime), "HH:mm")}
                        {v.row.leaveTime
                          ? ` → ${format(new Date(v.row.leaveTime), "HH:mm")}`
                          : ""}
                        {v.row.prices?.name ? ` · ${v.row.prices.name}` : ""}
                      </span>
                      <span className="tabular-nums">{money(v.amount)}</span>
                    </li>
                  ))}
                  {card.orders.map((dp) => (
                    <li key={dp.id} className="flex items-center gap-2">
                      <Coffee className="h-3.5 w-3.5 text-amber-700" />
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {dp.quantite}× {dp.product?.name || "Produit"}
                      </span>
                      <span className="tabular-nums">
                        {money((dp.product?.sellingPrice || 0) * (dp.quantite || 0))}
                      </span>
                    </li>
                  ))}
                </ul>

                {paid == null ? (
                  <div className="mt-3 space-y-2 border-t pt-3">
                    <div className="flex items-end gap-2">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs" htmlFor={`given-${card.key}`}>
                          Donné
                        </Label>
                        <Input
                          id={`given-${card.key}`}
                          inputMode="decimal"
                          placeholder={card.total.toFixed(1)}
                          value={given[card.key] ?? ""}
                          onChange={(e) =>
                            setGiven((g) => ({ ...g, [card.key]: e.target.value }))
                          }
                          className="h-9"
                        />
                      </div>
                      <div className="min-w-[96px] pb-1 text-right text-sm">
                        {diff == null ? null : diff >= 0 ? (
                          <span className="font-semibold text-emerald-700">
                            Rendu {money(diff)}
                          </span>
                        ) : (
                          <span className="font-semibold text-rose-700">
                            Reste {money(-diff)}
                          </span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        className="h-9"
                        disabled={!!busyKey || nothingToDo}
                        onClick={() => payOne(card)}
                      >
                        {busyKey === card.key ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Encaisser"
                        )}
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {quickGivenAmounts(card.total).map((v) => (
                        <button
                          key={v}
                          type="button"
                          className="rounded-md border px-2 py-0.5 text-xs tabular-nums hover:bg-muted"
                          onClick={() =>
                            setGiven((g) => ({ ...g, [card.key]: String(v) }))
                          }
                        >
                          {v.toFixed(v % 1 ? 1 : 0)}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="space-y-3 border-t bg-muted/30 px-5 py-4">
          {hasLeftUnpaid ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Partis sans payer : facturer à
              </p>
              <LateBillingChoice value={billing} onChange={setBilling} compact />
            </div>
          ) : null}

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <label className="flex items-center gap-2">
              <Switch checked={doCheckout} onCheckedChange={setDoCheckout} />
              <LogOut className="h-3.5 w-3.5" />
              Check-out les présents
              {presentCount ? (
                <span className="text-muted-foreground">({presentCount})</span>
              ) : null}
            </label>
            <label className="flex items-center gap-2">
              <Switch checked={markPaid} onCheckedChange={setMarkPaid} />
              Marquer payé
            </label>
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1">
              <Label className="text-xs" htmlFor="caisse-group-given">
                Donné total
              </Label>
              <Input
                id="caisse-group-given"
                inputMode="decimal"
                placeholder={groupTotal.toFixed(1)}
                value={groupGiven}
                onChange={(e) => setGroupGiven(e.target.value)}
                className="h-9 bg-background"
              />
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total à encaisser</p>
              <p className="text-2xl font-bold tabular-nums">{money(groupTotal)}</p>
              {groupGivenNum != null ? (
                groupGivenNum - groupTotal >= 0 ? (
                  <p className="text-sm font-semibold text-emerald-700">
                    Rendu {money(round1(groupGivenNum - groupTotal))}
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-rose-700">
                    Reste {money(round1(groupTotal - groupGivenNum))}
                  </p>
                )
              ) : null}
            </div>
          </div>

          {collectedTotal > 0 ? (
            <p className="text-xs text-muted-foreground">
              Déjà encaissé dans cette caisse : {money(collectedTotal)}
            </p>
          ) : null}

          <Button
            className="h-11 w-full bg-emerald-600 text-base hover:bg-emerald-700"
            disabled={!pendingCards.length || !!busyKey || nothingToDo}
            onClick={payAll}
          >
            {busyKey === "__all__" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Banknote className="mr-2 h-4 w-4" />
            )}
            Tout encaisser
            {pendingCards.length ? ` (${pendingCards.length}) · ${money(groupTotal)}` : ""}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
