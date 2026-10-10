"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Check, Loader2 } from "lucide-react";
import { BottomSheet } from "@/components/visitor/BottomSheet";
import { TarifIcon } from "@/components/visitor/TarifOption";
import { formatDt, type PricingTier } from "@/lib/session-pricing";
import {
  BillingUnit,
  type PriceCategory,
  type SessionPricingPayload,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const H = 3_600_000;

function withDiscount(price: number, discountPercent: number) {
  return Math.round(price * (1 - (discountPercent || 0) / 100) * 1000) / 1000;
}

function durationLabel(hours: number) {
  return hours >= 7 ? "Journée" : `${hours} h`;
}

export function PassPickerSheet({
  open,
  onOpenChange,
  live,
  currentLabel,
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
  /** e.g. "Pass 2h" — shown in the sheet subtitle */
  currentLabel: string;
  tiers: PricingTier[];
  sessionStart: number;
  now: number;
  pending: boolean;
  error?: string | null;
  onConfirm: (priceId: string) => void;
}) {
  const [pickedId, setPickedId] = useState<string | null>(null);

  useEffect(() => {
    if (open) setPickedId(null);
  }, [open]);

  const currentHours =
    live.mode === "FIXED"
      ? live.fixedDurationHours ?? live.currentTier.durationHours
      : 0;

  const options = useMemo(
    () =>
      tiers
        .map((t) => ({
          tier: t,
          endsAt: sessionStart + t.durationHours * H,
          amount: withDiscount(t.price, live.discountPercent),
          isCurrent: live.mode === "FIXED" && live.fixedPriceId === t.priceId,
        }))
        .filter((o) => o.isCurrent || o.endsAt > now),
    [tiers, sessionStart, now, live.discountPercent, live.mode, live.fixedPriceId]
  );

  const recommendedId =
    options.find((o) => !o.isCurrent && o.tier.durationHours > currentHours)
      ?.tier.priceId ?? null;
  const picked = options.find((o) => o.tier.priceId === pickedId) || null;
  const delta = picked ? picked.amount - live.amountDue : 0;

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      dismissible={!pending}
      title="Choisir mon pass"
      description={`Actuel : ${currentLabel} · ${formatDt(live.amountDue)}`}
      footer={
        <>
          {error ? (
            <p className="mb-2 text-xs font-medium text-rose-600">{error}</p>
          ) : picked ? (
            <p className="mb-2 text-center text-[11px] text-slate-500">
              {Math.abs(delta) < 0.0005
                ? "Même prix qu’actuellement"
                : delta > 0
                  ? `+${formatDt(delta)} par rapport à maintenant`
                  : `${formatDt(-delta)} de moins qu’actuellement`}
              {" · jusqu’à "}
              {format(picked.endsAt, "HH:mm")}
            </p>
          ) : (
            <p className="mb-2 text-center text-[11px] text-slate-500">
              Prix bloqué d’avance · supplément au-delà de la durée
            </p>
          )}
          <button
            type="button"
            disabled={!picked || pending}
            onClick={() => picked && onConfirm(picked.tier.priceId)}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-indigo-600 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {pending
              ? "Enregistrement…"
              : picked
                ? `Choisir ${picked.tier.name} · ${formatDt(picked.amount)}`
                : "Sélectionnez un pass"}
          </button>
        </>
      }
    >
      {options.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">
          Aucun pass disponible pour le temps restant. Demandez à l’accueil.
        </p>
      ) : (
        <div className="space-y-2">
          {options.map((o) => {
            const selected = pickedId === o.tier.priceId;
            const recommended = o.tier.priceId === recommendedId;
            return (
              <button
                key={o.tier.priceId}
                type="button"
                disabled={o.isCurrent || pending}
                aria-pressed={selected}
                onClick={() =>
                  setPickedId((cur) =>
                    cur === o.tier.priceId ? null : o.tier.priceId
                  )
                }
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left ring-1 transition active:scale-[0.99]",
                  selected
                    ? "bg-indigo-50/60 ring-2 ring-indigo-600"
                    : o.isCurrent
                      ? "bg-slate-50 ring-slate-200"
                      : "bg-white ring-slate-200 hover:ring-indigo-200"
                )}
              >
                <TarifIcon
                  price={{
                    durationHours: o.tier.durationHours,
                    category: (o.tier.category as PriceCategory | null) ?? null,
                    billingUnit: BillingUnit.PACK,
                  }}
                  className="h-11 w-11 rounded-xl"
                  iconClassName="h-5 w-5"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-bold text-slate-900">
                      {o.tier.name}
                    </span>
                    {recommended ? (
                      <span className="shrink-0 rounded-md bg-indigo-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                        Conseillé
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-slate-500">
                    {o.isCurrent
                      ? "Pass actuel"
                      : `${durationLabel(o.tier.durationHours)} · jusqu’à ${format(o.endsAt, "HH:mm")}`}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-indigo-600">
                  {formatDt(o.amount)}
                </span>
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition",
                    selected
                      ? "bg-indigo-600 text-white"
                      : "border border-slate-300 text-transparent"
                  )}
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </BottomSheet>
  );
}
