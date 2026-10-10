"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ArrowUp, Check, Loader2, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDt, formatMinutes, type PricingTier } from "@/lib/session-pricing";
import type { SessionPricingPayload } from "@/lib/types";

const H = 3_600_000;

function tierShort(t: { durationHours: number }) {
  return t.durationHours >= 7 ? "Jour" : `${t.durationHours}h`;
}

function withDiscount(price: number, discountPercent: number) {
  return Math.round(price * (1 - (discountPercent || 0) / 100) * 1000) / 1000;
}

/** FIXED session: game-like "level up" nudge towards the next tier. */
export function TierLevelUp({
  live,
  tiers,
  sessionStart,
  now,
  pending,
  error,
  onUpgrade,
  onOpenAll,
}: {
  live: SessionPricingPayload;
  tiers: PricingTier[];
  sessionStart: number;
  now: number;
  pending: boolean;
  error?: string | null;
  onUpgrade: (priceId: string) => void;
  onOpenAll: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 6000);
    return () => clearTimeout(t);
  }, [confirming]);

  useEffect(() => {
    setConfirming(false);
  }, [live.fixedPriceId]);

  const currentHours =
    live.fixedDurationHours ??
    tiers.find((t) => t.priceId === live.fixedPriceId)?.durationHours ??
    live.currentTier.durationHours;

  const next = useMemo(
    () =>
      tiers.find(
        (t) =>
          t.durationHours > currentHours &&
          sessionStart + t.durationHours * H > now
      ) ?? null,
    [tiers, currentHours, sessionStart, now]
  );

  if (!next) {
    return (
      <div className="flex items-center gap-2.5 rounded-3xl border border-amber-100 bg-amber-50/60 px-3 py-2.5 text-left">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-amber-500 shadow-sm">
          <Sparkles className="h-4 w-4" />
        </span>
        <p className="text-xs font-semibold text-amber-800">
          Niveau max atteint : {live.fixedServiceName ?? "pass"} 🏆
        </p>
      </div>
    );
  }

  const currentAmount = live.fixedAmount ?? live.baseAmount;
  const nextAmount = withDiscount(next.price, live.discountPercent);
  const extra = Math.max(0, nextAmount - currentAmount);
  const extraHours = next.durationHours - currentHours;
  const nextEndsAt = sessionStart + next.durationHours * H;
  const perHourNow = currentHours > 0 ? currentAmount / currentHours : null;
  const perHourNext = nextAmount / next.durationHours;
  const cheaperPerHour = perHourNow != null && perHourNext < perHourNow - 0.0005;
  const beatsOvertime = live.overtime && live.amountDue >= nextAmount;
  const urgent = live.stage !== "WITHIN";

  const levelIdx = tiers.findIndex((t) => t.durationHours === currentHours);
  const nextIdx = tiers.findIndex((t) => t.priceId === next.priceId);
  const track = tiers.slice(0, Math.min(tiers.length, Math.max(nextIdx + 2, 4)));

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-600 px-3.5 py-3 text-left text-white shadow-md">
      <span className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/10" />
      <span className="pointer-events-none absolute -bottom-10 right-10 h-20 w-20 rounded-full bg-white/5" />

      <div className="relative flex items-center gap-3">
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
          <span className="absolute inset-0 animate-ping rounded-2xl bg-white/10 [animation-duration:2s]" />
          <ArrowUp className="h-6 w-6 animate-bounce" strokeWidth={3} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-100">
            {urgent ? "Pass bientôt fini" : "Niveau supérieur"}
          </p>
          <p className="truncate text-base font-bold leading-tight">
            Passez à {next.name}
          </p>
          <p className="text-[11px] text-indigo-100">
            +{extraHours} h · jusqu’à {format(nextEndsAt, "HH:mm")}
            {" · "}
            <span className="font-semibold text-white">
              +{formatDt(extra)}
            </span>
          </p>
        </div>
      </div>

      <div className="relative mt-3 flex items-center">
        {track.map((t, i) => {
          const done = i <= levelIdx;
          const isNext = i === nextIdx;
          return (
            <div key={t.priceId} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold",
                    done
                      ? "bg-white text-indigo-700"
                      : isNext
                        ? "bg-amber-300 text-amber-900 ring-2 ring-amber-200/60 animate-pulse"
                        : "bg-white/20 text-white/70"
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : tierShort(t)}
                </span>
                <span
                  className={cn(
                    "mt-0.5 text-[9px] font-semibold",
                    done || isNext ? "text-white" : "text-white/50"
                  )}
                >
                  {done ? tierShort(t) : isNext ? "Suivant" : ""}
                </span>
              </div>
              {i < track.length - 1 ? (
                <span
                  className={cn(
                    "mx-1 mb-3 h-1 flex-1 rounded-full",
                    i < levelIdx ? "bg-white" : "bg-white/20"
                  )}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      {beatsOvertime || cheaperPerHour || urgent ? (
        <p className="relative mt-1.5 text-[11px] font-medium text-amber-200">
          {beatsOvertime
            ? `Moins cher que votre dépassement (${formatDt(live.amountDue)})`
            : urgent
              ? `Fin du pass dans ${formatMinutes(live.tierEndsAt - now)} — évitez le supplément`
              : `Meilleur prix : ${formatDt(perHourNext)}/h au lieu de ${formatDt(perHourNow)}/h`}
        </p>
      ) : null}

      {error ? (
        <p className="relative mt-1.5 text-[11px] font-medium text-rose-200">{error}</p>
      ) : null}

      <div className="relative mt-2.5 flex items-center gap-2">
        {confirming ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => onUpgrade(next.priceId)}
              className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-amber-300 text-sm font-bold text-amber-950 shadow-sm transition active:scale-[0.98] disabled:opacity-70"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" strokeWidth={3} />
              )}
              {pending ? "Activation…" : `Confirmer · ${formatDt(nextAmount)}`}
            </button>
            <button
              type="button"
              aria-label="Annuler"
              disabled={pending}
              onClick={() => setConfirming(false)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-white text-sm font-bold text-indigo-700 shadow-sm transition hover:bg-indigo-50 active:scale-[0.98]"
            >
              <ArrowUp className="h-4 w-4" strokeWidth={3} />
              Booster vers {tierShort(next)}
            </button>
            <button
              type="button"
              onClick={onOpenAll}
              className="shrink-0 px-1 text-[11px] font-semibold text-indigo-100 underline-offset-2 hover:underline"
            >
              Autres pass
            </button>
          </>
        )}
      </div>
    </div>
  );
}
