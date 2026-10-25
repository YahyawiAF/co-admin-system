"use client";

import { Check, Crown, Flame, Loader2 } from "lucide-react";

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
  hasActiveSubscription: boolean;
  subscriptionName?: string | null;
  subscriptionHoursRemaining?: number | null;
  /** Period abonnement: hours left today (≤0 → counter on tiers). */
  dailyRemainingHours?: number | null;
  /** Current streak (days): the chip shows the next one */
  streak?: number;
  pending: boolean;
  error?: string | null;
  onStart: () => void;
};

/** "Mission du jour": one glowing tap to check in — tarif auto, nothing to choose. */
export function StartSessionCard({
  hasActiveSubscription,
  subscriptionName,
  subscriptionHoursRemaining,
  dailyRemainingHours,
  streak = 0,
  pending,
  error,
  onStart,
}: Props) {
  const creditUsed =
    hasActiveSubscription &&
    dailyRemainingHours != null &&
    dailyRemainingHours <= 0;
  const usesPass = hasActiveSubscription && !creditUsed;

  const subtitle = usesPass
    ? `${subscriptionName || "Abonnement"} · ${
        dailyRemainingHours != null
          ? `${Number(dailyRemainingHours).toFixed(1)} h disponibles aujourd’hui`
          : subscriptionHoursRemaining != null
            ? `${Number(subscriptionHoursRemaining).toFixed(1)} h restantes`
            : "inclus dans votre abonnement"
      }`
    : creditUsed
      ? "Crédit du jour terminé : tarif auto, vous payez le temps passé."
      : "Tarif auto inclus : rien à choisir, vous payez le temps passé.";

  return (
    <section className="v-rise rounded-3xl bg-white p-3.5 shadow-sm ring-1 ring-slate-900/5 [animation-delay:60ms]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
          Mission du jour
        </p>
        {streak > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-lg bg-orange-100 px-2 py-0.5 text-[11px] font-extrabold text-orange-800">
            <Flame className="h-3 w-3" />
            Série → {streak + 1} jours
          </span>
        ) : usesPass ? (
          <span className="inline-flex items-center gap-1 rounded-lg bg-violet-100 px-2 py-0.5 text-[11px] font-extrabold text-violet-800">
            <Crown className="h-3 w-3" />
            Abonnement
          </span>
        ) : null}
      </div>
      <h1 className="mt-1 text-xl font-extrabold leading-tight text-slate-900">
        Pointez votre arrivée
      </h1>
      <p className="mt-0.5 text-[13px] leading-snug text-slate-600">{subtitle}</p>
      <button
        type="button"
        disabled={pending}
        onClick={onStart}
        className="v-glow relative mt-3 flex h-14 w-full items-center justify-center gap-2.5 overflow-hidden rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-base font-extrabold text-white transition-transform duration-150 active:scale-[0.98] disabled:opacity-80 motion-reduce:transition-none"
      >
        <span
          aria-hidden
          className="v-shine absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-white/0 via-white/35 to-white/0"
        />
        <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white text-indigo-600">
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" strokeWidth={3} />
          )}
        </span>
        <span className="relative">{pending ? "Pointage…" : "Pointer mon arrivée"}</span>
      </button>
      {error ? (
        <p className="mt-2 text-center text-xs font-medium text-rose-600">{error}</p>
      ) : (
        <p className="mt-2 text-center text-xs text-slate-600">
          ou scannez le QR à l’entrée{usesPass ? "" : " · 1 DT payé = 50 pts"}
        </p>
      )}
    </section>
  );
}
