"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mobileApi } from "@/lib/api/resources";
import { rowPricing, visitPaidAmount, visitorLabel } from "@/lib/journal-utils";
import {
  computeSessionPricing,
  formatDt,
  type PricingTier,
} from "@/lib/session-pricing";
import type { Journal } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Admin fixes / changes the pack of a running session (any pack allowed). */
export function FixSessionTariffDialog({
  row,
  tiers,
  onOpenChange,
}: {
  row: Journal | null;
  tiers: PricingTier[];
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const pricing = row ? rowPricing(row) : null;
  const start = row ? new Date(row.registredTime).getTime() : 0;
  const elapsedH = row ? (Date.now() - start) / 3_600_000 : 0;
  const sorted = useMemo(
    () => [...tiers].sort((a, b) => a.durationHours - b.durationHours),
    [tiers]
  );

  const fix = useMutation({
    mutationFn: (priceId: string) =>
      mobileApi.fixSessionTariff(row!.id, priceId),
    onSuccess: () => {
      toast.success("Forfait fixé");
      queryClient.invalidateQueries({ queryKey: ["journal"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Fixer le forfait</DialogTitle>
          <DialogDescription>
            {row ? visitorLabel(row) : ""} · arrivé à{" "}
            {row ? format(start, "HH:mm") : ""}
            {pricing
              ? pricing.mode === "AUTO"
                ? ` · actuellement Auto (palier ${pricing.currentTier.name})`
                : ` · actuellement ${pricing.fixedServiceName} (${formatDt(pricing.fixedAmount)})`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {sorted.map((t) => {
            const tooShort = t.durationHours <= elapsedH;
            const isCurrent =
              pricing?.mode === "FIXED" && pricing.fixedPriceId === t.priceId;
            return (
              <button
                key={t.priceId}
                type="button"
                disabled={fix.isPending || isCurrent}
                onClick={() => fix.mutate(t.priceId)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition hover:bg-muted",
                  isCurrent && "border-primary bg-primary/5"
                )}
              >
                <span>
                  <span className="font-medium">{t.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    Fin {format(start + t.durationHours * 3_600_000, "HH:mm")}
                    {tooShort ? " · déjà dépassé" : ""}
                    {isCurrent ? " · actuel" : ""}
                  </span>
                </span>
                <span className="font-semibold tabular-nums">{formatDt(t.price)}</span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type CloseMode = "fixed_end" | "paid" | "now" | "custom";

/** Check-out at the real departure time (forgotten checkout) with amount preview. */
export function CloseSessionAtDialog({
  row,
  ladder,
  onOpenChange,
}: {
  row: Journal | null;
  ladder: PricingTier[] | null | undefined;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<CloseMode>("fixed_end");
  const [custom, setCustom] = useState("");
  const pricing = row ? rowPricing(row) : null;
  const start = row ? new Date(row.registredTime).getTime() : 0;
  const fixedEnd = pricing?.fixedEndsAt ?? pricing?.tierEndsAt ?? null;
  const paidAt =
    row?.isPayed && row.paidAt ? new Date(row.paidAt).getTime() : null;

  useEffect(() => {
    if (!row) return;
    setMode(fixedEnd && fixedEnd < Date.now() ? "fixed_end" : "now");
    setCustom(format(Date.now(), "HH:mm"));
  }, [row?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const leaveAtMs = useMemo(() => {
    const nowMs = Date.now();
    if (mode === "fixed_end" && fixedEnd) return Math.min(fixedEnd, nowMs);
    if (mode === "paid" && paidAt) return Math.min(Math.max(paidAt, start), nowMs);
    if (mode === "custom" && /^\d{2}:\d{2}$/.test(custom)) {
      const [h, m] = custom.split(":").map(Number);
      const d = new Date(start);
      d.setHours(h, m, 0, 0);
      if (d.getTime() < start) d.setDate(d.getDate() + 1);
      return Math.min(d.getTime(), nowMs);
    }
    return nowMs;
  }, [mode, custom, fixedEnd, paidAt, start]);

  const preview = useMemo(() => {
    if (!row?.pricing || !ladder?.length) return null;
    const p = row.pricing;
    const m = row.pricingMode ?? p.mode;
    return computeSessionPricing({
      mode: m,
      registredTime: row.registredTime,
      at: leaveAtMs,
      ladder,
      rules: p.rules,
      discountPercent: p.discountPercent,
      fixed:
        m === "FIXED" && p.fixedDurationHours
          ? {
              priceId: p.fixedPriceId,
              name: p.fixedServiceName,
              durationHours: p.fixedDurationHours,
              amount: p.fixedAmount ?? p.baseAmount,
              category: (row.prices ?? row.price)?.category ?? null,
            }
          : null,
    });
  }, [row, ladder, leaveAtMs]);

  const paid = row ? visitPaidAmount(row) : 0;

  const close = useMutation({
    mutationFn: () =>
      mobileApi.checkout(row!.id, {
        leaveAt: new Date(leaveAtMs).toISOString(),
      }),
    onSuccess: (res) => {
      toast.success(
        `Check-out à ${format(leaveAtMs, "HH:mm")} · ${formatDt(res?.payedAmount ?? preview?.amountDue)}`
      );
      queryClient.invalidateQueries({ queryKey: ["journal"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const options: { id: CloseMode; label: string; hint?: string; hidden?: boolean }[] = [
    {
      id: "fixed_end",
      label:
        pricing?.mode === "AUTO" ? "Fin du palier actuel" : "Fin du forfait fixé",
      hint: fixedEnd ? format(fixedEnd, "HH:mm") : undefined,
      hidden: !fixedEnd,
    },
    {
      id: "paid",
      label: "Heure du paiement",
      hint: paidAt ? format(paidAt, "HH:mm") : undefined,
      hidden: !paidAt,
    },
    { id: "now", label: "Maintenant", hint: format(Date.now(), "HH:mm") },
    { id: "custom", label: "Heure choisie" },
  ];

  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Clôturer la session</DialogTitle>
          <DialogDescription>
            {row ? visitorLabel(row) : ""} · arrivé à {row ? format(start, "HH:mm") : ""}
            {pricing?.mode === "FIXED"
              ? ` · forfait fixé ${pricing.fixedServiceName} (${formatDt(pricing.fixedAmount)})`
              : pricing
                ? " · tarif auto"
                : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {options
            .filter((o) => !o.hidden)
            .map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setMode(o.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm",
                  mode === o.id ? "border-primary bg-primary/5" : "hover:bg-muted"
                )}
              >
                <span className="font-medium">{o.label}</span>
                {o.hint ? (
                  <span className="text-xs text-muted-foreground">{o.hint}</span>
                ) : null}
              </button>
            ))}
          {mode === "custom" ? (
            <div className="space-y-1">
              <Label htmlFor="close-at">Heure de départ</Label>
              <Input
                id="close-at"
                type="time"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
              />
            </div>
          ) : null}
        </div>
        <div className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
          <div className="flex justify-between">
            <span>Départ</span>
            <span className="font-medium">{format(leaveAtMs, "HH:mm")}</span>
          </div>
          {preview ? (
            <>
              <div className="flex justify-between">
                <span>Montant</span>
                <span className="font-semibold tabular-nums">
                  {formatDt(preview.amountDue)}
                </span>
              </div>
              {preview.extraAmount > 0 ? (
                <div className="flex justify-between text-xs text-rose-700">
                  <span>dont dépassement</span>
                  <span>+{formatDt(preview.extraAmount)}</span>
                </div>
              ) : null}
              {paid > 0 ? (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Déjà payé</span>
                  <span>
                    {formatDt(paid)}
                    {preview.amountDue - paid > 0.0005
                      ? ` · reste ${formatDt(preview.amountDue - paid)}`
                      : ""}
                  </span>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button disabled={close.isPending} onClick={() => close.mutate()}>
            Check-out à {format(leaveAtMs, "HH:mm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
