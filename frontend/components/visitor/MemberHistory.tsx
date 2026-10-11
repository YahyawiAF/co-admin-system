"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ChevronRight, Crown, History, RefreshCw } from "lucide-react";
import {
  mobileApi,
  type MobileSubscriptionHistoryItem,
  type MobileVisitHistoryItem,
} from "@/lib/api/resources";
import { BottomSheet } from "@/components/visitor/BottomSheet";
import { TarifIcon } from "@/components/visitor/TarifOption";
import { formatDt } from "@/lib/session-pricing";
import {
  dayLabel,
  subscriptionTiming,
  type SubscriptionTone,
} from "@/lib/subscription-dates";
import { useOrg } from "@/lib/org";
import { cn } from "@/lib/utils";

type Tab = "tarif" | "abonnement";

type TarifGroup = {
  key: string;
  name: string;
  price: MobileVisitHistoryItem["price"];
  visits: MobileVisitHistoryItem[];
  lastDate: string;
  total: number;
  unpaid: number;
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

function groupByTarif(visits: MobileVisitHistoryItem[]): TarifGroup[] {
  const map = new Map<string, TarifGroup>();
  for (const v of visits) {
    const key = v.priceId || v.priceName || "pass";
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        name: v.priceName || "Pass",
        price: v.price ?? null,
        visits: [],
        lastDate: v.date,
        total: 0,
        unpaid: 0,
      };
      map.set(key, g);
    }
    g.visits.push(v);
    if (new Date(v.date) > new Date(g.lastDate)) g.lastDate = v.date;
    if (v.isPayed) g.total += Number(v.payedAmount) || 0;
    else if (!v.isOpen) g.unpaid += 1;
  }
  const groups = [...map.values()];
  for (const g of groups) {
    g.visits.sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }
  return groups.sort((a, b) => +new Date(b.lastDate) - +new Date(a.lastDate));
}

/** Active first, then newest start first (upcoming naturally lead the rest). */
function sortSubscriptions(subs: MobileSubscriptionHistoryItem[]) {
  const rank = (s: MobileSubscriptionHistoryItem) =>
    subscriptionTiming(s).state === "active" ? 0 : 1;
  return [...subs].sort(
    (a, b) =>
      rank(a) - rank(b) || +new Date(b.registredDate) - +new Date(a.registredDate)
  );
}

const hhmm = (d?: string | null) => (d ? format(new Date(d), "HH:mm") : null);

/** Profile: visits grouped by tarif + abonnement timeline (latest first). */
export function MemberHistory({
  memberId,
  showEmpty = false,
}: {
  memberId: string;
  /** Show an empty state instead of rendering nothing. */
  showEmpty?: boolean;
}) {
  const router = useRouter();
  const { href } = useOrg();
  const [tab, setTab] = useState<Tab | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const { data: visits = [], isLoading: visitsLoading } = useQuery({
    queryKey: ["mobile-history", memberId],
    queryFn: () => mobileApi.history(memberId),
    staleTime: 60_000,
  });
  const { data: subsRaw = [], isLoading: subsLoading } = useQuery({
    queryKey: ["mobile-subscriptions", memberId],
    queryFn: () => mobileApi.subscriptions(memberId),
    staleTime: 60_000,
  });

  const groups = useMemo(() => groupByTarif(visits), [visits]);
  const subs = useMemo(() => sortSubscriptions(subsRaw), [subsRaw]);
  const hasActive = subs.some((s) => subscriptionTiming(s).state === "active");
  const hasCurrent = subs.some((s) => subscriptionTiming(s).state !== "ended");

  const activeTab: Tab =
    tab ?? (hasActive || (!groups.length && subs.length) ? "abonnement" : "tarif");
  const selected = groups.find((g) => g.key === openGroup) ?? null;

  if (visitsLoading || subsLoading) {
    return (
      <section className="rounded-3xl bg-white px-4 py-3.5 shadow-sm">
        <p className="text-sm text-slate-400">Chargement de l’historique…</p>
      </section>
    );
  }

  if (!groups.length && !subs.length) {
    if (!showEmpty) return null;
    return (
      <section className="rounded-3xl bg-white p-6 text-center shadow-sm">
        <History className="mx-auto h-6 w-6 text-slate-300" />
        <p className="mt-2 text-sm text-slate-500">Aucune visite pour le moment.</p>
      </section>
    );
  }

  const renew = (priceId?: string) =>
    router.push(
      href(
        priceId
          ? `/choose?mode=subscription&priceId=${encodeURIComponent(priceId)}`
          : "/choose?mode=subscription"
      )
    );

  return (
    <section className="rounded-3xl bg-white px-4 py-3.5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Historique
        </p>
        <p className="text-[11px] text-slate-400">
          {visits.length} visite{visits.length > 1 ? "s" : ""}
        </p>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1 rounded-full bg-slate-100 p-1">
        {(
          [
            { id: "tarif", label: "Par tarif", count: groups.length },
            { id: "abonnement", label: "Abonnements", count: subs.length },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex h-8 items-center justify-center gap-1.5 rounded-full text-xs font-semibold transition",
              activeTab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            )}
          >
            {t.label}
            <span className="tabular-nums text-[10px] text-slate-400">{t.count}</span>
          </button>
        ))}
      </div>

      {activeTab === "tarif" ? (
        groups.length ? (
          <ul className="mt-2 divide-y divide-slate-100">
            {groups.map((g) => (
              <li key={g.key}>
                <button
                  type="button"
                  onClick={() => setOpenGroup(g.key)}
                  className="flex w-full items-center gap-3 py-2.5 text-left transition active:opacity-70"
                >
                  <TarifIcon
                    price={g.price ?? {}}
                    className="h-10 w-10"
                    iconClassName="h-5 w-5"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {g.name}
                    </span>
                    <span className="block truncate text-[11px] text-slate-500">
                      {g.visits.length} visite{g.visits.length > 1 ? "s" : ""} · dernière{" "}
                      {dayLabel(g.lastDate).toLowerCase()}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-semibold tabular-nums text-slate-900">
                      {formatDt(g.total)}
                    </span>
                    {g.unpaid ? (
                      <span className="block text-[10px] font-medium text-amber-700">
                        {g.unpaid} non payé{g.unpaid > 1 ? "s" : ""}
                      </span>
                    ) : null}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-4 text-center text-sm text-slate-500">Aucune visite.</p>
        )
      ) : subs.length ? (
        <ul className="mt-2.5 space-y-2">
          {subs.map((s, i) => {
            const t = subscriptionTiming(s);
            const isPool = s.kind === "HOURS_POOL" && s.hoursQuota != null;
            const canRenew =
              (t.state === "active" && t.tone === "amber") ||
              (t.state === "ended" && !hasCurrent && i === 0);
            const due = Math.max(0, Number(s.amountDue) - Number(s.payedAmount));
            return (
              <li
                key={s.id}
                className={cn(
                  "rounded-2xl p-3",
                  t.state === "ended" ? "bg-slate-50" : "bg-indigo-50/40 ring-1 ring-indigo-100"
                )}
              >
                <div className="flex items-center gap-3">
                  {s.price ? (
                    <TarifIcon price={s.price} className="h-10 w-10" iconClassName="h-5 w-5" />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                      <Crown className="h-5 w-5" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{s.name}</p>
                    <span
                      className={cn(
                        "mt-0.5 inline-block rounded-md px-1.5 py-px text-[10px] font-semibold",
                        TONE_CHIP[t.tone]
                      )}
                    >
                      {t.state === "upcoming"
                        ? "À venir"
                        : t.state === "ended"
                          ? "Terminé"
                          : t.tone === "amber"
                            ? "Bientôt fini"
                            : "Actif"}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    {t.state === "active" && t.daysRemaining != null ? (
                      <>
                        <p className={cn("text-lg font-bold tabular-nums leading-tight", TONE_TEXT[t.tone])}>
                          {t.daysRemaining}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          jour{t.daysRemaining > 1 ? "s" : ""} restant{t.daysRemaining > 1 ? "s" : ""}
                        </p>
                      </>
                    ) : t.state === "ended" && t.endedDaysAgo != null ? (
                      <p className="text-[11px] font-medium text-slate-500">
                        {t.endedDaysAgo === 1 ? "hier" : `il y a ${t.endedDaysAgo} j`}
                      </p>
                    ) : t.state === "upcoming" && t.startsInDays != null ? (
                      <p className="text-[11px] font-medium text-indigo-600">
                        {t.startsInDays === 1 ? "demain" : `dans ${t.startsInDays} j`}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-white px-2.5 py-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Début
                    </p>
                    <p className="truncate text-xs font-medium text-slate-800">{t.startLabel}</p>
                  </div>
                  <div className="rounded-xl bg-white px-2.5 py-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Fin
                    </p>
                    <p
                      className={cn(
                        "truncate text-xs font-medium",
                        t.tone === "amber" || t.tone === "rose"
                          ? TONE_TEXT[t.tone]
                          : "text-slate-800"
                      )}
                    >
                      {t.endLabel ?? "—"}
                    </p>
                  </div>
                </div>

                {t.state === "active" && t.progressPct != null ? (
                  <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        t.tone === "amber" ? "bg-amber-500" : "bg-indigo-600"
                      )}
                      style={{ width: `${Math.max(4, t.progressPct)}%` }}
                    />
                  </div>
                ) : null}

                <p className={cn("mt-2 text-[11px] font-medium leading-snug", TONE_TEXT[t.tone])}>
                  {t.headline}
                  {t.renewHint && (t.state !== "ended" || canRenew) ? (
                    <span className="block font-normal text-slate-500">{t.renewHint}</span>
                  ) : null}
                </p>

                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span className="min-w-0 truncate">
                    {isPool
                      ? `${Number(s.hoursUsed).toFixed(1)} / ${s.hoursQuota} h utilisées`
                      : s.reservedSeatLabel
                        ? `Place ${s.reservedSeatLabel}`
                        : null}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-medium",
                      s.isPayed || due <= 0 ? "text-emerald-600" : "text-amber-700"
                    )}
                  >
                    {s.isPayed || due <= 0
                      ? `Payé · ${formatDt(s.payedAmount || s.amountDue)}`
                      : `Reste ${formatDt(due)}`}
                  </span>
                </div>

                {canRenew ? (
                  <button
                    type="button"
                    onClick={() => renew(s.priceId)}
                    className="mt-2.5 flex h-10 w-full items-center justify-center gap-1.5 rounded-full border border-indigo-200 bg-white text-sm font-semibold text-indigo-700 transition active:scale-[0.98]"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Renouveler
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="py-4 text-center">
          <p className="text-sm text-slate-500">Aucun abonnement pour le moment.</p>
          <button
            type="button"
            onClick={() => renew()}
            className="mt-1 text-xs font-semibold text-indigo-600"
          >
            Découvrir les abonnements
          </button>
        </div>
      )}

      <BottomSheet
        open={!!selected}
        onOpenChange={(o) => !o && setOpenGroup(null)}
        title={selected?.name}
        description={
          selected
            ? `${selected.visits.length} visite${selected.visits.length > 1 ? "s" : ""} · ${formatDt(selected.total)} payés`
            : undefined
        }
      >
        <ul className="divide-y divide-slate-100">
          {selected?.visits.map((v) => {
            const from = hhmm(v.registredTime);
            const to = hhmm(v.leaveTime);
            return (
              <li key={v.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{dayLabel(v.date)}</p>
                  <p className="truncate text-[11px] text-slate-500">
                    {from ? `${from}${to ? ` – ${to}` : ""} · ` : ""}
                    {v.durationLabel}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums text-slate-900">
                    {formatDt(v.payedAmount)}
                  </p>
                  <p
                    className={cn(
                      "text-[10px] font-medium",
                      v.isOpen
                        ? "text-indigo-600"
                        : v.isPayed
                          ? "text-emerald-600"
                          : "text-amber-700"
                    )}
                  >
                    {v.isOpen ? "En cours" : v.isPayed ? "Payé" : "Non payé"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </BottomSheet>
    </section>
  );
}
