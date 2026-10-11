"use client";

import { ArrowRight, CalendarClock, CalendarX2, ChevronRight, Crown, RefreshCw } from "lucide-react";
import type { MobileSubscriptionRef } from "@/lib/api/resources";
import {
  ENDED_SUBSCRIPTION_VISIBLE_DAYS,
  subscriptionTiming,
  type SubscriptionTone,
} from "@/lib/subscription-dates";
import { cn } from "@/lib/utils";

type ActiveSub = {
  priceId?: string | null;
  price?: { name?: string | null } | null;
  serviceName?: string | null;
  registredDate: string | Date;
  leaveDate?: string | Date | null;
  kind?: string | null;
  hoursRemaining?: number | null;
  hoursQuota?: number | null;
  dailyCreditRemainingHours?: number | null;
};

type Props = {
  subscription?: ActiveSub | null;
  lastSubscription?: MobileSubscriptionRef | null;
  upcomingSubscription?: MobileSubscriptionRef | null;
  /** Only render when something needs attention (ends ≤ 1 day / ended). */
  alertsOnly?: boolean;
  onOpen: () => void;
  onRenew: (priceId?: string) => void;
};

const TONE_TEXT: Record<SubscriptionTone, string> = {
  indigo: "text-indigo-600",
  amber: "text-amber-700",
  rose: "text-rose-600",
  slate: "text-slate-500",
};

const TONE_CHIP: Record<SubscriptionTone, string> = {
  indigo: "bg-indigo-50 text-indigo-700",
  amber: "bg-amber-50 text-amber-700",
  rose: "bg-rose-50 text-rose-700",
  slate: "bg-slate-100 text-slate-600",
};

/** Whether the Accueil should surface the abonnement (used for the session screen). */
export function subscriptionNeedsAttention(
  subscription?: ActiveSub | null,
  lastSubscription?: MobileSubscriptionRef | null,
  upcomingSubscription?: MobileSubscriptionRef | null
) {
  if (subscription) {
    const t = subscriptionTiming(subscription);
    return t.state === "active" && t.daysRemaining != null && t.daysRemaining <= 2;
  }
  if (upcomingSubscription) return false;
  if (!lastSubscription) return false;
  const t = subscriptionTiming(lastSubscription);
  return (t.endedDaysAgo ?? Infinity) <= ENDED_SUBSCRIPTION_VISIBLE_DAYS;
}

/** Accueil: which abonnement, start → end (weekday), days left, renewal nudge. */
export function SubscriptionStatusCard({
  subscription,
  lastSubscription,
  upcomingSubscription,
  alertsOnly,
  onOpen,
  onRenew,
}: Props) {
  if (
    alertsOnly &&
    !subscriptionNeedsAttention(subscription, lastSubscription, upcomingSubscription)
  ) {
    return null;
  }

  if (subscription) {
    const name =
      subscription.serviceName || subscription.price?.name || "Abonnement";
    const t = subscriptionTiming(subscription);
    const isPool = subscription.kind === "HOURS_POOL";
    const hoursLeft = subscription.hoursRemaining;
    const upcoming = t.state === "upcoming";

    return (
      <section className="rounded-3xl bg-white px-4 py-3.5 shadow-sm">
        <button
          type="button"
          onClick={onOpen}
          className="flex w-full items-center gap-3 text-left"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <Crown className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Mon abonnement
              </span>
              <span
                className={cn(
                  "rounded-md px-1.5 py-px text-[10px] font-semibold",
                  TONE_CHIP[t.tone]
                )}
              >
                {upcoming ? "À venir" : t.tone === "amber" ? "Bientôt fini" : "Actif"}
              </span>
            </span>
            <span className="block truncate text-base font-bold text-slate-900">
              {name}
            </span>
            <span className="flex items-center gap-1 truncate text-[11px] text-slate-500">
              {t.startLabel}
              {t.endLabel ? (
                <>
                  <ArrowRight className="h-3 w-3 shrink-0 text-slate-300" />
                  {t.endLabel}
                </>
              ) : null}
            </span>
          </span>
          <span className="shrink-0 text-right">
            {isPool && hoursLeft != null ? (
              <>
                <span className="block text-xl font-bold tabular-nums leading-tight text-indigo-600">
                  {Number(hoursLeft).toFixed(hoursLeft % 1 ? 1 : 0)} h
                </span>
                <span className="block text-[10px] text-slate-400">restantes</span>
              </>
            ) : t.daysRemaining != null ? (
              <>
                <span
                  className={cn(
                    "block text-xl font-bold tabular-nums leading-tight",
                    TONE_TEXT[t.tone]
                  )}
                >
                  {t.daysRemaining}
                </span>
                <span className="block text-[10px] text-slate-400">
                  jour{t.daysRemaining > 1 ? "s" : ""} restant
                  {t.daysRemaining > 1 ? "s" : ""}
                </span>
              </>
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-300" />
            )}
          </span>
        </button>

        {t.progressPct != null ? (
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                t.tone === "amber" ? "bg-amber-500" : "bg-indigo-600"
              )}
              style={{ width: `${Math.max(4, t.progressPct)}%` }}
            />
          </div>
        ) : null}

        <div className="mt-2 flex items-center justify-between gap-2">
          <p className={cn("min-w-0 text-[11px] font-medium leading-snug", TONE_TEXT[t.tone])}>
            {t.headline}
            {t.renewHint ? (
              <span className="block font-normal text-slate-500">{t.renewHint}</span>
            ) : null}
          </p>
          {t.renewHint ? (
            <button
              type="button"
              onClick={() => onRenew(subscription.priceId ?? undefined)}
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-indigo-200 px-3 text-xs font-semibold text-indigo-700 transition active:scale-95"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Renouveler
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  if (upcomingSubscription) {
    const t = subscriptionTiming(upcomingSubscription);
    return (
      <section className="flex items-center gap-3 rounded-3xl bg-white px-4 py-3 shadow-sm">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          <CalendarClock className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Prochain abonnement
          </p>
          <p className="truncate text-sm font-bold text-slate-900">
            {upcomingSubscription.name}
          </p>
          <p className="text-[11px] font-medium text-indigo-600">{t.headline}</p>
          {t.endLabel ? (
            <p className="text-[11px] text-slate-500">
              {t.startLabel} → {t.endLabel.toLowerCase()}
            </p>
          ) : null}
        </div>
      </section>
    );
  }

  if (lastSubscription) {
    const t = subscriptionTiming(lastSubscription);
    if ((t.endedDaysAgo ?? Infinity) > ENDED_SUBSCRIPTION_VISIBLE_DAYS) return null;
    return (
      <section className="rounded-3xl bg-white px-4 py-3.5 shadow-sm ring-1 ring-rose-100">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <CalendarX2 className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Abonnement terminé
            </p>
            <p className="truncate text-base font-bold text-slate-900">
              {lastSubscription.name}
            </p>
            <p className="text-[11px] font-medium text-rose-600">{t.headline}</p>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Du {t.startLabel.toLowerCase()} au {t.endLabel?.toLowerCase()}. {t.renewHint}
        </p>
        <button
          type="button"
          onClick={() => onRenew(lastSubscription.priceId)}
          className="mt-2.5 flex h-11 w-full items-center justify-center gap-1.5 rounded-full border border-indigo-200 text-sm font-semibold text-indigo-700 transition active:scale-[0.98]"
        >
          <RefreshCw className="h-4 w-4" />
          Renouveler mon abonnement
        </button>
      </section>
    );
  }

  return null;
}
