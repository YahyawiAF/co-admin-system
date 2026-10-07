"use client";

import { useMemo } from "react";
import { Check, ChevronRight, Crown, Loader2, Play, Ticket, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDt } from "@/lib/promo-price";
import { isJournalPack } from "@/lib/journal-utils";
import { BillingUnit, type Price } from "@/lib/types";
import {
  TarifMiniTile,
  tarifDurationLabel,
} from "@/components/visitor/TarifOption";

const FACILITY_PHOTO =
  "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=300&q=60";

/** "QR détecté" header: big check + welcome line. */
export function QrWelcome({
  facilityName,
  receptionAway,
}: {
  facilityName: string;
  receptionAway?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col items-center pt-2 text-center">
        <span className="relative flex h-20 w-20 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-indigo-100 [animation-iteration-count:2]" />
          <span className="absolute inset-1 rounded-full bg-indigo-50" />
          <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-md">
            <Check className="h-6 w-6" strokeWidth={3} />
          </span>
        </span>
        <h1 className="mt-2 text-xl font-bold text-slate-900">
          Bienvenue à {facilityName}
        </h1>
        <p className="text-sm text-slate-500">Vous êtes au bon endroit 🎉</p>
      </div>
      <div className="flex items-center gap-3 rounded-3xl bg-white p-2.5 shadow-sm">
        <img
          src={FACILITY_PHOTO}
          alt=""
          className="h-14 w-16 shrink-0 rounded-2xl object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900">
            {facilityName}
          </p>
          <p className="text-[11px] text-slate-500">
            {receptionAway ? "Accès libre — accueil absent" : "Géré par l’accueil"}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Ouvert
        </span>
      </div>
    </div>
  );
}

type Props = {
  tarifs: Price[];
  hasActiveSubscription: boolean;
  subscriptionName?: string | null;
  subscriptionDaysRemaining?: number | null;
  subscriptionHoursRemaining?: number | null;
  /** Period abonnement: hours left today (≤0 → counter on tiers). */
  dailyRemainingHours?: number | null;
  pending: boolean;
  error?: string | null;
  canChooseForfait: boolean;
  onStart: () => void;
  onPickForfait: (priceId?: string) => void;
  onSubscription: () => void;
};

/** One-tap check-in + "Pas de pass ?" quick picks. */
export function StartSessionCard({
  tarifs,
  hasActiveSubscription,
  subscriptionName,
  subscriptionDaysRemaining,
  subscriptionHoursRemaining,
  dailyRemainingHours,
  pending,
  error,
  canChooseForfait,
  onStart,
  onPickForfait,
  onSubscription,
}: Props) {
  const forfaits = useMemo(
    () =>
      tarifs
        .filter(
          (t) =>
            isJournalPack(t) &&
            t.billingUnit !== BillingUnit.HOURLY &&
            (t.durationHours ?? 0) > 0
        )
        .sort((a, b) => (a.durationHours ?? 0) - (b.durationHours ?? 0)),
    [tarifs]
  );
  const quickPicks = forfaits.slice(0, 3);
  const creditUsed =
    hasActiveSubscription &&
    dailyRemainingHours != null &&
    dailyRemainingHours <= 0;
  const usesPass = hasActiveSubscription && !creditUsed;

  const passSubtitle = usesPass
    ? dailyRemainingHours != null
      ? `${Number(dailyRemainingHours).toFixed(1)} h disponibles aujourd’hui`
      : subscriptionHoursRemaining != null
        ? `${Number(subscriptionHoursRemaining).toFixed(1)} h restantes`
        : subscriptionDaysRemaining != null
          ? `Valable encore ${subscriptionDaysRemaining} jour${
              subscriptionDaysRemaining > 1 ? "s" : ""
            }`
          : "Abonnement actif"
    : creditUsed
      ? "Crédit du jour terminé — le prix suit le temps passé"
      : quickPicks.length
        ? `Dès ${formatDt(quickPicks[0].price)} DT · le prix suit le temps passé`
        : "Le prix suit le temps passé";

  return (
    <div className="space-y-3">
      <div className="rounded-3xl bg-white px-4 py-3.5 shadow-sm">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
              usesPass
                ? "bg-gradient-to-br from-violet-100 to-fuchsia-50 text-violet-600"
                : "bg-gradient-to-br from-indigo-100 to-sky-50 text-indigo-600"
            )}
          >
            {usesPass ? <Crown className="h-6 w-6" /> : <Timer className="h-6 w-6" />}
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {usesPass ? "Pass actif" : "Sur place"}
            </p>
            <p className="truncate text-base font-bold text-slate-900">
              {usesPass ? subscriptionName || "Abonnement" : "Tarif au temps passé"}
            </p>
            <p className="text-[11px] text-slate-500">{passSubtitle}</p>
          </div>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={onStart}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2.5 rounded-full bg-indigo-600 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-70"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-indigo-600">
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
            )}
          </span>
          {pending ? "Démarrage…" : "Démarrer ma session"}
        </button>
        {error ? (
          <p className="mt-2 text-center text-xs text-rose-600">{error}</p>
        ) : null}
      </div>

      {!hasActiveSubscription && canChooseForfait && quickPicks.length ? (
        <div className="rounded-3xl bg-white px-3 py-3 shadow-sm">
          <div className="px-1">
            <p className="text-sm font-bold text-slate-900">Pas de pass ?</p>
            <p className="text-[11px] text-slate-500">
              Choisissez un pass et profitez de l’espace.
            </p>
          </div>
          <div
            className={cn(
              "mt-2 grid gap-1",
              quickPicks.length === 1
                ? "grid-cols-1"
                : quickPicks.length === 2
                  ? "grid-cols-2"
                  : "grid-cols-3"
            )}
          >
            {quickPicks.map((p) => (
              <TarifMiniTile
                key={p.id}
                price={p}
                label={tarifDurationLabel(p) || p.name}
                amount={`${formatDt(p.price)} TND`}
                onClick={() => onPickForfait(p.id)}
              />
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onPickForfait()}
              className="flex h-10 items-center justify-center gap-1 rounded-full border border-slate-200 text-xs font-semibold text-slate-700 transition active:scale-[0.98]"
            >
              <Ticket className="h-3.5 w-3.5" />
              Acheter un pass
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            </button>
            <button
              type="button"
              onClick={onSubscription}
              className="flex h-10 items-center justify-center gap-1 rounded-full border border-indigo-200 text-xs font-semibold text-indigo-700 transition active:scale-[0.98]"
            >
              <Crown className="h-3.5 w-3.5" />
              Abonnement
              <ChevronRight className="h-3.5 w-3.5 text-indigo-300" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
