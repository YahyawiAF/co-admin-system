"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CheckCircle2, HelpCircle, Lightbulb, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { advisorApi, analyticsApi } from "@/lib/api/resources";
import { CompareCard, ExportCard, SourceCurveCard } from "./ForecastSources";
import { MonthEndCard } from "./MonthEndCard";
import type {
  AbonnementMonth,
  AdviceMetric,
  AdvisorCategory,
  ForecastDriver,
  ForecastDriverKey,
  InitiativeChannel,
  InitiativeObjective,
  LeverStatus,
  MissingIdea,
  MonthForecast,
  PerformanceChange,
} from "@/lib/types";

const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR");
const dt = (n: number | null | undefined) => (n == null ? "—" : `${fmt(n)} DT`);
const r50 = (n: number) => Math.round(n / 50) * 50;
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmt(Math.abs(n))}`;
const dayLabel = (key: string) => format(new Date(`${key}T12:00:00`), "d MMM", { locale: fr });

const DRIVER_UI: Record<ForecastDriverKey, { label: string; sub: string; money?: boolean; decimals?: boolean }> = {
  calendar: { label: "Calendrier", sub: "nombre de chaque jour de semaine", money: true },
  periods: { label: "Périodes du calendrier", sub: "examens, vacances, jours fériés", money: true },
  newVisitors: { label: "Nouveaux visiteurs", sub: "1ʳᵉ visite" },
  otherVisits: { label: "Visites des habitués", sub: "déjà venus + sans compte" },
  conversions: { label: "Passés en abonnement", sub: "leurs passes deviennent un abonnement" },
  ticket: { label: "Ticket moyen", sub: "par visite", money: true, decimals: true },
  subscriptions: { label: "Abonnements", sub: "total du mois", money: true },
  products: { label: "Café et produits", sub: "ventes enregistrées", money: true },
  goodStart: { label: "Les jours déjà vécus", sub: "réel au-dessus / en dessous du prévu", money: true },
  events: { label: "Événements", sub: "places payées et réservées", money: true },
};

const RATE_SOURCE: Record<MonthForecast["subscriptions"]["renewalRateSource"], string> = {
  LAST_MONTH: "renouvelés le mois dernier",
  CAREFUL: "taux prudent : le plus bas entre le mois dernier et tout l'historique",
  HISTORY: "renouvelés sur tout l'historique",
  ASSUMED: "pas assez d'historique",
};

const pctLabel = (factor: number) => `${factor >= 1 ? "+" : "−"}${Math.round(Math.abs(factor - 1) * 100)} %`;
const rangeLabel = (from: string, to: string) =>
  from === to ? dayLabel(from) : `${format(new Date(`${from}T12:00:00`), "d", { locale: fr })}–${dayLabel(to)}`;

function driverValue(d: ForecastDriver, v: number) {
  const ui = DRIVER_UI[d.key];
  const n = ui.decimals ? v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : fmt(v);
  return ui.money ? `${n} DT` : n;
}

// ---------------------------------------------------------------------------
// Drivers: which part of the money moved
// ---------------------------------------------------------------------------

function Drivers({ drivers, fromLabel, toLabel }: { drivers: ForecastDriver[]; fromLabel: string; toLabel: string }) {
  const max = Math.max(1, ...drivers.map((d) => Math.abs(d.effect)));
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[520px]">
        <div className="grid grid-cols-[minmax(0,1.3fr)_72px_80px_72px_minmax(110px,1fr)] gap-3 border-b pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Moteur</span>
          <span className="text-right">{fromLabel}</span>
          <span className="text-right">{toLabel}</span>
          <span className="text-right">Effet</span>
          <span />
        </div>
        {drivers.map((d) => {
          const w = (Math.abs(d.effect) / max) * 50;
          const pos = d.effect >= 0;
          const flat = Math.abs(d.effect) < 1;
          return (
            <div
              key={d.key}
              className="grid grid-cols-[minmax(0,1.3fr)_72px_80px_72px_minmax(110px,1fr)] items-center gap-3 border-b py-2 text-sm last:border-b-0 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
            >
              <span>
                <span className="font-medium">{DRIVER_UI[d.key].label}</span>
                <span className="block text-xs text-muted-foreground">{DRIVER_UI[d.key].sub}</span>
              </span>
              <span className="text-right tabular-nums text-muted-foreground">{driverValue(d, d.from)}</span>
              <span className="text-right font-semibold tabular-nums">{driverValue(d, d.to)}</span>
              <span className={cn("text-right font-semibold tabular-nums", flat ? "text-muted-foreground" : pos ? "text-emerald-600" : "text-rose-600")}>
                {flat ? "0" : signed(d.effect)}
              </span>
              <span className="relative h-4">
                <span className="absolute inset-y-[-4px] left-1/2 w-px bg-border" />
                <span
                  className={cn("absolute top-0.5 h-3 rounded-sm transition-all duration-300", pos ? "bg-emerald-500" : "bg-rose-500")}
                  style={{ left: `${pos ? 50 : 50 - w}%`, width: `${w}%` }}
                />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function verdictText(f: MonthForecast): string {
  const list = f.toDate?.drivers ?? f.versusPrevious?.drivers ?? [];
  if (!list.length) return "";
  const sorted = [...list].sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect));
  const top = sorted[0];
  const ups = list.filter((d) => d.effect >= 20).sort((a, b) => b.effect - a.effect);
  const downs = list.filter((d) => d.effect <= -20).sort((a, b) => a.effect - b.effect);
  const name = (d: ForecastDriver) => DRIVER_UI[d.key].label.toLowerCase();
  if (f.toDate) {
    const parts: string[] = [];
    if (ups.length) parts.push(`${ups.map(name).join(" et ")} ${ups.length > 1 ? "tirent" : "tire"} le mois (${signed(ups.reduce((a, d) => a + d.effect, 0))} DT)`);
    if (downs.length) parts.push(`${downs.map(name).join(" et ")} ${downs.length > 1 ? "freinent" : "freine"} (${signed(downs.reduce((a, d) => a + d.effect, 0))} DT)`);
    return parts.length ? `${parts.join(", ")}.` : "Le mois suit le prévu, aucun moteur ne s'écarte vraiment.";
  }
  return `Le plus gros changement vs ${f.period.previousLabel} : ${name(top)} (${signed(top.effect)} DT).`;
}

// ---------------------------------------------------------------------------
// Forecast block
// ---------------------------------------------------------------------------

export function ForecastBlock({
  year,
  month,
  facilityId,
  abonnements,
}: {
  year: number;
  month: number;
  facilityId?: string;
  abonnements?: AbonnementMonth | null;
}) {
  const { data: f, isLoading } = useQuery({
    queryKey: ["performance", "forecast", year, month],
    queryFn: () => analyticsApi.performanceForecast(year, month),
  });
  // « Rythme du mois » is the main forecast; the old rule stays one click away
  const [pace, setPace] = useState(true);
  const [whyMode, setWhyMode] = useState<"previous" | "expected">("previous");

  if (isLoading || !f) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-96" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  const t = f.toDate;
  const ev = f.events;
  const prevTotal = f.versusPrevious ? f.versusPrevious.previousTotal + ev.previousMonth : null;
  const lastComplete = t ? f.days[t.days - 1] : null;
  const showsPast = !f.period.isCurrent && !f.period.isFuture;
  const s = f.subscriptions;
  const subsPaid = t?.subscriptions.actual ?? null;
  const projectedVariable = t ? (pace ? t.pace.projectedVariable : t.projectedVariable) : f.expected.variable;
  const projectedSubs = t ? t.projectedSubscriptions : f.expected.subscriptions;
  const projected = pace ? f.projectedAll.pace : f.projectedAll.current;
  const monthDone = showsPast && t ? t.actual + t.subscriptions.actual + ev.paid : null;

  // Why vs last month: the expected month's drivers, then what the days lived,
  // the abonnements paid above the expected and the events add
  const whyPrevious: ForecastDriver[] = f.versusPrevious
    ? [
        ...f.versusPrevious.drivers.map((d) =>
          d.key === "subscriptions" && t ? { ...d, to: projectedSubs, effect: d.effect + (projectedSubs - f.expected.subscriptions) } : d,
        ),
        ...(t ? [{ key: "goodStart" as const, from: f.expected.variable, to: projectedVariable, effect: projectedVariable - f.expected.variable }] : []),
        ...(ev.projected || ev.previousMonth
          ? [{ key: "events" as const, from: ev.previousMonth, to: ev.projected, effect: ev.projected - ev.previousMonth }]
          : []),
      ]
    : [];
  const showExpected = whyMode === "expected" && t;

  return (
    <div className="grid gap-4">
      <MonthEndCard f={f} year={year} month={month} pace={pace} onPace={setPace} />

      <SourceCurveCard f={f} pace={pace} onPace={setPace} />

      {f.period.isFuture ? null : <CompareCard f={f} pace={pace} abonnements={abonnements ?? null} />}

      <Card className="min-w-0 shadow-none">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 pb-2">
          <div className="min-w-0">
            <CardTitle className="text-base">
              {showExpected
                ? `Pourquoi l'écart ${showsPast ? `en ${f.period.label}` : `au ${dayLabel(lastComplete!.key)}`}`
                : `Pourquoi ${f.period.label} ${showsPast ? "" : "probable "}vs ${f.period.previousLabel}`}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {showExpected
                ? "Passes + café, prévu contre réel sur les mêmes jours. Barre = ce que ce moteur a ajouté ou retiré."
                : `${f.period.previousLabel} ${prevTotal != null ? dt(prevTotal) : ""} → ${f.period.label} ${dt(monthDone ?? projected)}. « Calendrier » = le nombre de chaque jour de semaine, le reste est comparé à calendrier égal.`}
            </p>
          </div>
          {t ? (
            <div className="inline-flex rounded-lg bg-muted p-1 text-sm" role="group" aria-label="Comparer à">
              {(["previous", "expected"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={whyMode === m}
                  onClick={() => setWhyMode(m)}
                  className={cn(
                    "rounded-md px-3 py-1 font-medium transition-all duration-200",
                    whyMode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m === "previous" ? `vs ${f.period.previousLabel}` : "vs prévu"}
                </button>
              ))}
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          <div key={whyMode} className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
            {showExpected ? (
              <Drivers drivers={t.drivers} fromLabel="Prévu" toLabel="Réel" />
            ) : whyPrevious.length ? (
              <Drivers drivers={whyPrevious} fromLabel={f.period.previousLabel} toLabel={showsPast ? f.period.label : "Probable"} />
            ) : null}
          </div>
          <p className="rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-950 dark:bg-indigo-950/40 dark:text-indigo-100">
            <b>À retenir : </b>
            {verdictText(f)}
            {t && !pace && t.gap > 0 && t.days < 14
              ? ` Le bon début ne compte que pour ${t.days} jour${t.days > 1 ? "s" : ""} : avec « + rythme du mois », la fin de mois serait ${dt(r50(f.projectedAll.pace))}.`
              : ""}
          </p>
          {f.periods.length ? (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {f.periods.map((p) => (
                <li key={`${p.label}-${p.from}`}>
                  <b className="text-foreground">{p.label}</b> ({rangeLabel(p.from, p.to)}) :{" "}
                  {p.known ? (
                    <>
                      {pctLabel(p.factor)} vs un jour habituel, mesuré les fois précédentes → {signed(p.effect)} DT
                    </>
                  ) : (
                    <>effet inconnu (jamais mesuré), compté comme un jour habituel avec une fourchette plus large</>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-xs text-muted-foreground">
            <b className="text-foreground">Abonnements</b> : {dt(s.expected)} prévus
            {subsPaid != null ? `, ${fmt(subsPaid)} DT encaissés` : ""}. {s.endingCount} finissent ce mois ({dt(s.endingValue)}) ×{" "}
            {s.renewalRatePct != null ? `${s.renewalRatePct} %` : "40 %"} ({RATE_SOURCE[s.renewalRateSource]}), plus {dt(s.newPace)} de
            nouveaux abonnés au rythme récent.
            {ev.projected ? ` Événements : ${dt(ev.paid)} encaissés + ${dt(ev.upcoming)} de places réservées.` : ""}
          </p>
          {f.bookings.thisMonth || f.bookings.lastMonthSamePoint ? (
            <p className="text-xs text-muted-foreground">
              Réservations pour {f.period.label} : <b className="text-foreground">{f.bookings.thisMonth}</b> (à la même date le mois
              dernier : {f.bookings.lastMonthSamePoint}).
            </p>
          ) : null}
        </CardContent>
      </Card>

      <ExportCard year={year} month={month} facilityId={facilityId} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// « Qu'est-ce qui a changé ? »
// ---------------------------------------------------------------------------

export function ChangeQuestions() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["performance", "changes"],
    queryFn: () => analyticsApi.performanceChanges(),
    refetchInterval: 30 * 60_000,
  });
  const [done, setDone] = useState<Record<string, string>>({});
  const answer = useMutation({
    mutationFn: (v: { c: PerformanceChange; cause: string }) =>
      analyticsApi.answerPerformanceChange({ metric: v.c.metric, direction: v.c.direction, from: v.c.from, to: v.c.to, cause: v.cause }),
    onSuccess: (res, v) => {
      const label = v.c.causes.find((x) => x.code === v.cause)?.label ?? "";
      setDone((d) => ({
        ...d,
        [v.c.key]: res.initiativeId
          ? `Noté comme action du ${dayLabel(v.c.from)} : « ${label} ». Le conseiller la mesure et te la proposera à nouveau si l'effet tient.`
          : v.cause === "UNKNOWN"
            ? "Noté. Le conseiller regardera les réponses « Comment tu nous as connus ? » de ces jours-là."
            : `Noté : « ${label} ». Le conseiller en tient compte dans ses prochains conseils.`,
      }));
      void queryClient.invalidateQueries({ queryKey: ["performance", "levers"] });
    },
    onError: (e: Error) => toast.error(e.message || "Erreur"),
  });

  const open = (data?.changes ?? []).filter((c) => !c.explainedBy || done[c.key]);
  if (!open.length) return null;

  return (
    <div className="grid gap-3">
      {open.map((c) => (
        <section
          key={c.key}
          className="grid gap-3 rounded-xl border border-dashed border-violet-400 bg-violet-50/70 p-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-300 dark:bg-violet-950/30"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold">
                {c.direction === "up" ? "Hausse" : "Baisse"} inexpliquée : {c.label.toLowerCase()} {signed(c.changePct)} %
              </h3>
              <p className="text-sm text-muted-foreground">
                Du {dayLabel(c.from)} au {dayLabel(c.to)} : {fmt(c.actual)} au lieu de {fmt(c.expected)} d&apos;habitude, et aucune action
                n&apos;est notée. Qu&apos;est-ce qui a changé ?
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-900/60 dark:text-violet-200">
              <HelpCircle className="h-3.5 w-3.5" /> Le conseiller demande
            </span>
          </div>
          {done[c.key] ? (
            <p className="rounded-lg bg-background/80 px-3 py-2 text-sm motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
              <CheckCircle2 className="mr-1.5 inline h-4 w-4 text-emerald-600" />
              {done[c.key]}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {c.causes.map((x) => (
                <button
                  key={x.code}
                  type="button"
                  disabled={answer.isPending}
                  onClick={() => answer.mutate({ c, cause: x.code })}
                  className="rounded-full border bg-background px-3 py-1 text-sm font-medium transition-colors hover:border-violet-500 hover:bg-violet-600 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500 disabled:opacity-50"
                >
                  {x.label}
                </button>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lever map + missing ideas
// ---------------------------------------------------------------------------

const STATUS_UI: Record<LeverStatus, { label: string; className: string }> = {
  MISSING: { label: "Manque", className: "bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-200" },
  NO_DATA: { label: "Donnée manquante", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200" },
  IN_PROGRESS: { label: "En cours", className: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-200" },
  WORKING: { label: "Ça marche", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200" },
  OK: { label: "Pas prioritaire", className: "bg-muted text-muted-foreground" },
};

function ideaPayload(idea: MissingIdea) {
  const p = idea.plan as {
    title?: string;
    category?: AdvisorCategory;
    objective?: InitiativeObjective;
    channels?: InitiativeChannel[];
    metric?: AdviceMetric;
    targetPct?: number;
    targetKind?: "ALL" | "SLOT" | "LIST";
    targetDays?: number[];
  };
  return {
    title: p.title ?? idea.title,
    category: p.category ?? "NEW_REVENUE",
    objective: p.objective,
    channels: p.channels,
    metric: p.metric,
    targetPct: p.targetPct ?? null,
    // A slot needs days: without them the whole space is measured
    targetKind: p.targetKind === "SLOT" && !p.targetDays?.length ? "ALL" : p.targetKind,
    targetDays: p.targetDays,
    hypothesis: idea.why.slice(0, 300),
    recommendationTitle: idea.title,
    startDate: format(new Date(), "yyyy-MM-dd"),
    steps: idea.steps.map((text) => ({ text, done: false })),
    // Same as « Je m'en occupe » in Conseil IA: a goal in DT, tied to its lever
    leverId: idea.leverId,
    goalAmount: Math.max(50, Math.round(idea.gain / 10) * 10),
  };
}

export function LeverMapCard() {
  const queryClient = useQueryClient();
  const [onlyMissing, setOnlyMissing] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["performance", "levers"],
    queryFn: () => analyticsApi.performanceLevers(),
    refetchInterval: 30 * 60_000,
  });
  const [added, setAdded] = useState<Set<string>>(new Set());
  const add = useMutation({
    mutationFn: (idea: MissingIdea) => advisorApi.createInitiative(ideaPayload(idea)),
    onSuccess: (_r, idea) => {
      setAdded((s) => new Set(s).add(idea.leverId));
      toast.success("Solution lancée : suivez-la dans Conseil IA", {
        action: { label: "Ouvrir", onClick: () => window.location.assign("/conseiller") },
      });
      void queryClient.invalidateQueries({ queryKey: ["advisor"] });
    },
    onError: (e: Error) => toast.error(e.message || "Erreur"),
  });

  const groups = useMemo(
    () =>
      (data?.groups ?? []).map((g) => ({
        ...g,
        levers: onlyMissing ? g.levers.filter((l) => l.status === "MISSING" || l.status === "NO_DATA") : g.levers,
      })),
    [data, onlyMissing],
  );

  if (isLoading || !data) return <Skeleton className="h-72" />;

  return (
    <div className="grid gap-4">
      <Card className="shadow-none">
        <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3 pb-2">
          <div>
            <CardTitle className="text-base">Ce que le conseiller vérifie</CardTitle>
            <p className="text-sm text-muted-foreground">
              Les 4 façons de faire grandir l&apos;espace. Pour chaque levier : ce que disent tes chiffres, et s&apos;il y a une action en cours.
            </p>
          </div>
          <div className="inline-flex rounded-lg bg-muted p-1 text-sm" role="group" aria-label="Filtre des leviers">
            {[false, true].map((v) => (
              <button
                key={String(v)}
                type="button"
                aria-pressed={onlyMissing === v}
                onClick={() => setOnlyMissing(v)}
                className={cn(
                  "rounded-md px-3 py-1 font-medium transition-all duration-200",
                  onlyMissing === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v ? `Ce qui manque (${data.counts.MISSING + data.counts.NO_DATA})` : "Tout"}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {groups.map((g) => (
            <div key={g.group} className="grid content-start gap-2 rounded-xl bg-muted/50 p-3">
              <h3 className="text-sm font-semibold">{g.label}</h3>
              {g.levers.length ? (
                g.levers.map((l, i) => (
                  <div
                    key={l.id}
                    style={{ animationDelay: `${i * 40}ms` }}
                    className={cn(
                      "grid gap-1 rounded-lg border bg-background px-3 py-2 transition-[border-color,transform] duration-200 hover:-translate-y-px motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300 motion-safe:fill-mode-both",
                      l.status === "MISSING" && "border-violet-400",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 text-sm font-medium">
                      <span>{l.title}</span>
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS_UI[l.status].className)}>
                        {STATUS_UI[l.status].label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{l.signal}</p>
                    {l.note && l.status !== "OK" ? (
                      <p className="text-xs">
                        {l.status === "NO_DATA" ? "⚠ " : "→ "}
                        {l.note}
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">Rien ne manque ici.</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-4 w-4 text-violet-600" /> Idées manquantes
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Un levier que tes chiffres poussent, sans action en cours. Classées par gain estimé par mois.
          </p>
        </CardHeader>
        <CardContent>
          {data.missing.length ? (
            <div className="grid gap-3 lg:grid-cols-3">
              {data.missing.map((idea, i) => {
                const isAdded = added.has(idea.leverId);
                return (
                  <article
                    key={idea.leverId}
                    style={{ animationDelay: `${i * 50}ms` }}
                    className="grid content-start gap-2.5 rounded-xl border p-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300 motion-safe:fill-mode-both"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-900/60 dark:text-violet-200">
                        {data.groups.find((g) => g.group === idea.group)?.label}
                      </span>
                      {idea.gain > 0 ? <span className="text-sm font-bold text-emerald-600">≈ +{fmt(idea.gain)} DT/mois</span> : null}
                    </div>
                    <b className="leading-snug">{idea.title}</b>
                    <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs">{idea.why}</p>
                    <ol className="list-decimal space-y-0.5 pl-5 text-sm">
                      {idea.steps.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ol>
                    <div>
                      <Button
                        size="sm"
                        variant={isAdded ? "outline" : "default"}
                        disabled={isAdded || add.isPending}
                        onClick={() => add.mutate(idea)}
                        className={cn("gap-1.5 transition-colors", isAdded && "border-emerald-500 text-emerald-700")}
                      >
                        {isAdded ? <CheckCircle2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        {isAdded ? "Ajoutée au plan" : "Ajouter au plan"}
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> Chaque levier fort a une action en cours.
            </p>
          )}
          <details className="group mt-4 text-sm">
            <summary className="cursor-pointer font-medium text-indigo-600">Comment le conseiller trouve une idée manquante</summary>
            <ol className="mt-2 grid gap-2 text-muted-foreground motion-safe:group-open:animate-in motion-safe:group-open:fade-in sm:grid-cols-2 xl:grid-cols-4">
              <li><b className="text-foreground">1. Découper le chiffre d&apos;affaires</b> : nouveaux, habitués, ticket moyen, abonnements, café. Chaque moteur a son prévu.</li>
              <li><b className="text-foreground">2. Trouver le moteur qui bouge</b> : l&apos;écart en DT contre le prévu. Le plus gros passe en premier.</li>
              <li><b className="text-foreground">3. Vérifier les leviers</b> : un levier fort sans action en cours = idée manquante.</li>
              <li><b className="text-foreground">4. Expliquer les hausses</b> : une hausse sans action → il te demande ce que tu as fait, puis le mesure.</li>
            </ol>
            <p className="mt-2 text-xs text-muted-foreground">
              Les mêmes leviers sont envoyés au <Link href="/conseiller" className="underline">Conseiller IA</Link> : il doit proposer une
              recommandation pour chaque levier qui manque.
            </p>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}
