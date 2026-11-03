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
import type {
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
// Curve: expected (dashed + band) vs real, cumulative
// ---------------------------------------------------------------------------

function ForecastCurve({ f, previousTotal }: { f: MonthForecast; previousTotal: number | null }) {
  // previousTotal = last month's passes + café replayed on this month's calendar
  const W = 640;
  const H = 260;
  const pl = 44;
  const pr = 16;
  const pt = 16;
  const pb = 28;
  const n = f.days.length;
  const lived = f.days.filter((d) => d.actualCum != null);
  const top = Math.max(f.expected.variableHigh, previousTotal ?? 0, lived.at(-1)?.actualCum ?? 0) * 1.08 || 1;
  const step = top > 8000 ? 2000 : top > 3000 ? 1000 : top > 1200 ? 500 : 200;
  const max = Math.ceil(top / step) * step;
  const x = (i: number) => pl + ((W - pl - pr) * i) / Math.max(1, n - 1);
  const y = (v: number) => pt + (H - pt - pb) * (1 - v / max);
  const line = (pts: Array<[number, number]>) => pts.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ");
  const band = [
    ...f.days.map((d, i) => [x(i), y(d.highCum)] as [number, number]),
    ...[...f.days].reverse().map((d, i) => [x(n - 1 - i), y(d.lowCum)] as [number, number]),
  ];
  const ticks = [1, 8, 15, 22, n];
  const last = lived.at(-1);
  const lastIdx = last ? f.days.indexOf(last) : -1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Passes et café cumulés : prévu et réel">
      {f.periods.map((p) => {
        const i0 = f.days.findIndex((d) => d.key === p.from);
        const i1 = f.days.findIndex((d) => d.key === p.to);
        if (i0 < 0 || i1 < 0) return null;
        const half = (W - pl - pr) / Math.max(1, n - 1) / 2;
        const x0 = Math.max(pl, x(i0) - half);
        const x1 = Math.min(W - pr, x(i1) + half);
        return (
          <g key={`${p.label}-${p.from}`} className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
            <rect
              x={x0}
              y={pt}
              width={Math.max(2, x1 - x0)}
              height={H - pt - pb}
              className={p.known ? (p.factor < 1 ? "fill-amber-400/15" : "fill-emerald-400/15") : "fill-slate-400/15"}
            >
              <title>{`${p.label} : ${p.known ? pctLabel(p.factor) : "effet inconnu"}`}</title>
            </rect>
            {x1 - x0 > 34 ? (
              <text x={(x0 + x1) / 2} y={pt + 11} textAnchor="middle" fontSize={10} className="fill-muted-foreground">
                {p.label.length > 14 ? `${p.label.slice(0, 13)}…` : p.label}
              </text>
            ) : null}
          </g>
        );
      })}
      {Array.from({ length: max / step + 1 }, (_, k) => k * step).map((g) => (
        <g key={g}>
          <line x1={pl} x2={W - pr} y1={y(g)} y2={y(g)} className="stroke-border" />
          <text x={pl - 6} y={y(g) + 4} textAnchor="end" fontSize={11} className="fill-muted-foreground">
            {g >= 1000 ? `${g / 1000}k` : g}
          </text>
        </g>
      ))}
      {ticks.map((d) => (
        <text key={d} x={x(d - 1)} y={H - 8} textAnchor="middle" fontSize={11} className="fill-muted-foreground">
          {dayLabel(f.days[d - 1].key)}
        </text>
      ))}
      {previousTotal != null ? (
        <g>
          <line x1={pl} x2={W - pr} y1={y(previousTotal)} y2={y(previousTotal)} strokeDasharray="2 4" className="stroke-muted-foreground" />
          <text x={W - pr} y={y(previousTotal) - 6} textAnchor="end" fontSize={11} className="fill-muted-foreground">
            {f.period.previousLabel} à calendrier égal {fmt(previousTotal)}
          </text>
        </g>
      ) : null}
      <polygon points={line(band)} className="fill-indigo-500/10" />
      <polyline
        points={line(f.days.map((d, i) => [x(i), y(d.expectedCum)]))}
        fill="none"
        strokeWidth={2}
        strokeDasharray="5 4"
        className="stroke-indigo-500"
      />
      <text x={x(n - 1) - 4} y={y(f.expected.total) + 16} textAnchor="end" fontSize={11.5} fontWeight={700} className="fill-indigo-600">
        prévu {fmt(r50(f.expected.variable))}
      </text>
      {lived.length ? (
        <g className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
          <polyline
            points={line(lived.map((d) => [x(f.days.indexOf(d)), y(d.actualCum!)]))}
            fill="none"
            strokeWidth={2.6}
            strokeLinejoin="round"
            className="stroke-foreground"
          />
          <circle cx={x(lastIdx)} cy={y(last!.actualCum!)} r={4.5} className="fill-foreground" />
          <text
            x={x(lastIdx) + (lastIdx > n / 2 ? -8 : 8)}
            y={y(last!.actualCum!) - 10}
            textAnchor={lastIdx > n / 2 ? "end" : "start"}
            fontSize={12}
            fontWeight={700}
            className="fill-foreground"
          >
            {fmt(last!.actualCum!)} DT
          </text>
        </g>
      ) : null}
    </svg>
  );
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

export function ForecastBlock({ year, month }: { year: number; month: number }) {
  const { data: f, isLoading } = useQuery({
    queryKey: ["performance", "forecast", year, month],
    queryFn: () => analyticsApi.performanceForecast(year, month),
  });

  if (isLoading || !f) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-28" />
        <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  const t = f.toDate;
  const prevTotal = f.versusPrevious?.previousTotal ?? null;
  const calendarDriver = f.versusPrevious?.drivers.find((d) => d.key === "calendar");
  // Last month's passes + café on this month's calendar (5 Sundays vs 4…)
  const prevVariableAdjusted = calendarDriver ? calendarDriver.to : null;
  const vsPrev = prevTotal != null ? f.expected.total - prevTotal : null;
  const subsDriver = f.versusPrevious?.drivers.find((d) => d.key === "subscriptions");
  const ahead = t ? t.gap >= 0 : null;
  const lastComplete = t ? f.days[t.days - 1] : null;
  const showsPast = !f.period.isCurrent && !f.period.isFuture;
  const s = f.subscriptions;
  const subsPaid = t?.subscriptions.actual ?? null;

  return (
    <div className="grid gap-4">
      <Card className="shadow-none">
        <CardContent className="grid gap-5 p-5 sm:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_1fr]">
          {t && lastComplete ? (
            <>
              <div className="grid content-start gap-1.5">
                <span
                  className={cn(
                    "justify-self-start rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors duration-300",
                    ahead ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700",
                  )}
                >
                  {showsPast ? (ahead ? "Au-dessus du prévu" : "En dessous du prévu") : ahead ? "En avance sur le prévu" : "En retard sur le prévu"}
                </span>
                <div className="text-3xl font-extrabold tracking-tight tabular-nums">{dt(t.actual)}</div>
                <p className="text-sm text-muted-foreground">
                  passes + café {showsPast ? `en ${f.period.label}` : `au ${dayLabel(lastComplete.key)}`} · prévu{" "}
                  <b className="text-foreground">{dt(t.expected)}</b>
                </p>
              </div>
              <Kpi
                label="Écart vs prévu"
                value={`${signed(t.gap)} DT`}
                tone={t.gap >= 0 ? "good" : "bad"}
                sub={t.gapPct != null ? `${signed(t.gapPct)} % · mêmes jours de semaine` : undefined}
              />
              <Kpi
                label={showsPast ? "Mois complet" : "Fin de mois estimée"}
                value={dt(showsPast ? t.actual + t.subscriptions.actual : r50(t.projected))}
                sub={
                  showsPast
                    ? `prévu ${fmt(r50(f.expected.total))} · abonnements ${fmt(t.subscriptions.actual)} DT`
                    : `passes + café ${fmt(r50(t.projectedVariable))} + abonnements ${fmt(r50(t.projectedSubscriptions))}`
                }
              />
              <Kpi
                label={`vs ${f.period.previousLabel}`}
                value={prevTotal != null ? dt(prevTotal) : "—"}
                sub={
                  prevTotal != null
                    ? `${signed((showsPast ? t.actual + t.subscriptions.actual : t.projected) - prevTotal)} DT${
                        calendarDriver && Math.abs(calendarDriver.effect) >= 20 ? ` · dont calendrier ${signed(calendarDriver.effect)}` : ""
                      }`
                    : undefined
                }
              />
            </>
          ) : (
            <>
              <div className="grid content-start gap-1.5">
                <span className="justify-self-start rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                  {f.period.label} prévu
                </span>
                <div className="text-3xl font-extrabold tracking-tight tabular-nums">{dt(r50(f.expected.total))}</div>
                <p className="text-sm text-muted-foreground">
                  Passes + café {fmt(r50(f.expected.variable))} + abonnements {fmt(r50(f.expected.subscriptions))} · fourchette{" "}
                  {fmt(r50(f.expected.low))} – {fmt(r50(f.expected.high))} DT.
                  {f.period.isCurrent ? " Le réel se remplit chaque soir." : ""}
                </p>
              </div>
              <Kpi
                label={`vs ${f.period.previousLabel}`}
                value={vsPrev != null ? `${signed(vsPrev)} DT` : "—"}
                tone={vsPrev == null ? "neutral" : vsPrev >= 0 ? "good" : "bad"}
                sub={
                  prevTotal != null
                    ? `${f.period.previousLabel} : ${fmt(prevTotal)} DT${
                        calendarDriver && Math.abs(calendarDriver.effect) >= 20 ? ` · calendrier ${signed(calendarDriver.effect)}` : ""
                      }${subsDriver && Math.abs(subsDriver.effect) >= 50 ? ` · abonnements ${signed(subsDriver.effect)}` : ""}`
                    : undefined
                }
              />
              <Kpi
                label={`Repère du ${dayLabel(f.checkpoints[0].key)}`}
                value={dt(r50(f.checkpoints[0].expectedCum))}
                sub={`passes + café · en dessous de ${fmt(r50(f.checkpoints[0].expectedCum * 0.9))} DT → lancer une idée`}
              />
              <Kpi
                label="Nouveaux attendus"
                value={fmt(f.expected.newVisitors)}
                sub={`${fmt(f.expected.visitCount)} visites au total`}
              />
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card className="min-w-0 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{f.period.label} : passes + café jour par jour</CardTitle>
            <p className="text-sm text-muted-foreground">
              Chaque jour reçoit la moyenne du même jour de semaine avant le mois ({dayLabel(f.period.base.from)} →{" "}
              {dayLabel(f.period.base.to)}), sans les jours fériés ni les périodes. Zones colorées = calendrier du Conseiller. Les
              abonnements sont comptés à part.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <ForecastCurve f={f} previousTotal={prevVariableAdjusted} />
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><i className="inline-block h-0.5 w-4 border-t-2 border-dashed border-indigo-500" />Prévu</span>
              <span className="flex items-center gap-1.5"><i className="inline-block h-0.5 w-4 bg-foreground" />Réel</span>
              <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-4 rounded-sm bg-indigo-500/15" />Fourchette</span>
              {f.periods.length ? (
                <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-4 rounded-sm bg-amber-400/25" />Période du calendrier</span>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {f.checkpoints.slice(-4).map((c) => {
                const ok = c.actualCum == null ? null : c.actualCum >= c.expectedCum * 0.97;
                return (
                  <div
                    key={c.key}
                    className={cn(
                      "grid gap-0.5 rounded-lg px-3 py-2 transition-colors duration-300",
                      ok == null ? "bg-muted/60" : ok ? "bg-emerald-50 dark:bg-emerald-950/40" : "bg-amber-50 dark:bg-amber-950/40",
                    )}
                  >
                    <span className="text-[11px] font-semibold text-muted-foreground">Au {dayLabel(c.key)}</span>
                    <b className="tabular-nums">{dt(r50(c.expectedCum))}</b>
                    <span className="text-[11px] text-muted-foreground">{c.actualCum != null ? `réel ${fmt(c.actualCum)}` : "prévu"}</span>
                  </div>
                );
              })}
            </div>
            {f.periods.length ? (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {f.periods.map((p) => (
                  <li key={`${p.label}-${p.from}`} className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
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
              <b className="text-foreground">Abonnements</b> (jamais répartis par jour) : {dt(s.expected)} prévus
              {subsPaid != null ? `, ${fmt(subsPaid)} DT encaissés` : ""}. {s.endingCount} finissent ce mois ({dt(s.endingValue)}) ×{" "}
              {s.renewalRatePct != null ? `${s.renewalRatePct} %` : "40 %"} ({RATE_SOURCE[s.renewalRateSource]}), plus {dt(s.newPace)} de
              nouveaux abonnés au rythme récent.
            </p>
            {f.bookings.thisMonth || f.bookings.lastMonthSamePoint ? (
              <p className="text-xs text-muted-foreground">
                Réservations pour {f.period.label} : <b className="text-foreground">{f.bookings.thisMonth}</b> (à la même date le mois
                dernier : {f.bookings.lastMonthSamePoint}).
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="min-w-0 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {t ? `Pourquoi l'écart ${showsPast ? `en ${f.period.label}` : `au ${dayLabel(lastComplete!.key)}`}` : `${f.period.previousLabel} → ${f.period.label} prévu`}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {t
                ? "Passes + café, prévu contre réel sur les mêmes jours. Barre = ce que ce moteur a ajouté ou retiré."
                : `${f.period.previousLabel} réel contre ${f.period.label} prévu. « Calendrier » = l'effet du nombre de chaque jour de semaine, le reste est comparé à calendrier égal.`}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {t ? (
              <Drivers drivers={t.drivers} fromLabel="Prévu" toLabel="Réel" />
            ) : f.versusPrevious ? (
              <Drivers drivers={f.versusPrevious.drivers} fromLabel={f.period.previousLabel} toLabel="Prévu" />
            ) : null}
            <p className="rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-950 dark:bg-indigo-950/40 dark:text-indigo-100">
              <b>À retenir : </b>
              {verdictText(f)}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, tone = "neutral" }: { label: string; value: string; sub?: string; tone?: "good" | "bad" | "neutral" }) {
  return (
    <div className="grid content-start gap-1 border-t pt-3 sm:border-t-0 sm:pt-0 xl:border-l xl:pl-4">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-2xl font-bold tabular-nums",
          tone === "good" && "text-emerald-600",
          tone === "bad" && "text-rose-600",
        )}
      >
        {value}
      </span>
      {sub ? <span className="text-xs text-muted-foreground">{sub}</span> : null}
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
    targetKind: p.targetKind,
    targetDays: p.targetDays,
    hypothesis: idea.why.slice(0, 300),
    recommendationTitle: idea.title,
    startDate: format(new Date(), "yyyy-MM-dd"),
    steps: idea.steps.map((text) => ({ text, done: false })),
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
      toast.success("Ajoutée au plan : suivie dans Conseiller → Actions");
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
