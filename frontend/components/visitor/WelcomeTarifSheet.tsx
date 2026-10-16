"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Check, Loader2, Timer } from "lucide-react";
import { BottomSheet } from "@/components/visitor/BottomSheet";
import { formatDt, type PricingTier } from "@/lib/session-pricing";
import type { SessionPricingPayload } from "@/lib/types";
import { cn } from "@/lib/utils";

const H = 3_600_000;
const AUTO = "auto";

function withDiscount(price: number, discountPercent: number) {
  return Math.round(price * (1 - (discountPercent || 0) / 100) * 1000) / 1000;
}

/**
 * Shown once right after the QR scan started the session.
 * The session already runs (AUTO): closing the sheet simply keeps "au temps passé".
 */
export function WelcomeTarifSheet({
  open,
  onOpenChange,
  live,
  tiers,
  sessionStart,
  now,
  pending,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  live: SessionPricingPayload;
  tiers: PricingTier[];
  sessionStart: number;
  now: number;
  pending: boolean;
  error?: string | null;
  onConfirm: (priceId: string) => void;
}) {
  const [picked, setPicked] = useState<string>(AUTO);

  useEffect(() => {
    if (open) setPicked(AUTO);
  }, [open]);

  const options = useMemo(
    () =>
      tiers
        .filter((t) => sessionStart + t.durationHours * H > now)
        .slice(0, 5)
        .map((t) => ({
          tier: t,
          amount: withDiscount(t.price, live.discountPercent),
          endsAt: sessionStart + t.durationHours * H,
        })),
    [tiers, sessionStart, now, live.discountPercent]
  );
  const choice = options.find((o) => o.tier.priceId === picked) ?? null;

  const tile = (selected: boolean) =>
    cn(
      "relative flex flex-col items-center justify-center rounded-2xl px-1 py-3 ring-1 transition active:scale-95",
      selected
        ? "bg-indigo-600 text-white ring-indigo-600 shadow-md"
        : "bg-slate-50 text-slate-900 ring-slate-200"
    );

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      dismissible={!pending}
      title={
        <span className="inline-flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
          Session démarrée
        </span>
      }
      description={`Depuis ${format(sessionStart, "HH:mm")}`}
      footer={
        <>
          {error ? (
            <p className="mb-2 text-center text-xs font-medium text-rose-600">{error}</p>
          ) : null}
          <button
            type="button"
            disabled={pending}
            onClick={() => (choice ? onConfirm(choice.tier.priceId) : onOpenChange(false))}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-indigo-600 text-sm font-semibold text-white transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-70"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {pending
              ? "Enregistrement…"
              : choice
                ? `Valider · ${formatDt(choice.amount)}`
                : "Valider"}
          </button>
        </>
      }
    >
      <p className="mb-2.5 text-sm font-bold text-slate-900">Votre tarif ?</p>
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          disabled={pending}
          aria-pressed={picked === AUTO}
          onClick={() => setPicked(AUTO)}
          className={tile(picked === AUTO)}
        >
          <Timer className="h-5 w-5" />
          <span className="mt-1 text-[13px] font-bold leading-none">Libre</span>
          <span
            className={cn(
              "mt-1 text-[10px]",
              picked === AUTO ? "text-indigo-100" : "text-slate-400"
            )}
          >
            au temps passé
          </span>
        </button>
        {options.map((o) => {
          const selected = picked === o.tier.priceId;
          return (
            <button
              key={o.tier.priceId}
              type="button"
              disabled={pending}
              aria-pressed={selected}
              onClick={() => setPicked(o.tier.priceId)}
              className={tile(selected)}
            >
              <span className="text-lg font-bold leading-none">
                {o.tier.durationHours >= 7 ? "Journée" : `${o.tier.durationHours}h`}
              </span>
              <span
                className={cn(
                  "mt-1 text-xs font-semibold tabular-nums",
                  selected ? "text-white" : "text-indigo-600"
                )}
              >
                {formatDt(o.amount)}
              </span>
              <span
                className={cn(
                  "mt-0.5 text-[10px]",
                  selected ? "text-indigo-100" : "text-slate-400"
                )}
              >
                → {format(o.endsAt, "HH:mm")}
              </span>
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}
