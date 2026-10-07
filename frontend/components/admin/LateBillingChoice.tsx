"use client";

import { cn } from "@/lib/utils";
import type { LateBillingMode } from "@/lib/types";
import type { LatePaymentAmounts } from "@/lib/journal-utils";

const OPTIONS: Array<{ id: LateBillingMode; label: string; hint: string }> = [
  { id: "now", label: "Heure du paiement", hint: "Comme s'il était resté jusqu'à maintenant" },
  { id: "checkout", label: "Heure du départ", hint: "Montant figé au check-out" },
  { id: "fixed", label: "Forfait fixé", hint: "Prix du forfait choisi" },
];

/** Radio-like picker for how a late payment is billed. With `info`, shows each amount. */
export function LateBillingChoice({
  value,
  onChange,
  info,
  compact,
}: {
  value: LateBillingMode;
  onChange: (mode: LateBillingMode) => void;
  info?: LatePaymentAmounts | null;
  compact?: boolean;
}) {
  const amountOf = (mode: LateBillingMode) => {
    if (!info) return null;
    if (mode === "checkout") return info.amountAtCheckout;
    if (mode === "fixed") return info.amountFixed;
    return info.amountIfPaidNow;
  };

  return (
    <div
      role="radiogroup"
      className={cn("grid gap-1.5", compact ? "grid-cols-3" : "grid-cols-1")}
    >
      {OPTIONS.map((o) => {
        const amount = amountOf(o.id);
        const unavailable = !!info && o.id === "fixed" && amount == null;
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={unavailable}
            onClick={() => onChange(o.id)}
            className={cn(
              "flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
              compact && "flex-col items-start gap-0.5 px-2 py-1.5 text-xs",
              active
                ? "border-orange-500 bg-orange-50 text-orange-950 dark:bg-orange-950/40 dark:text-orange-100"
                : "bg-background hover:bg-muted/60",
              unavailable && "cursor-not-allowed opacity-50",
            )}
          >
            {!compact ? (
              <span
                className={cn(
                  "h-3.5 w-3.5 shrink-0 rounded-full border-2",
                  active ? "border-orange-600 bg-orange-600" : "border-muted-foreground/40",
                )}
              />
            ) : null}
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{o.label}</span>
              {!compact ? (
                <span className="block text-xs text-muted-foreground">
                  {unavailable ? "Aucun forfait sur cette visite" : o.hint}
                </span>
              ) : null}
            </span>
            {amount != null ? (
              <span className="shrink-0 font-semibold tabular-nums">
                {amount.toFixed(1)} DT
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
