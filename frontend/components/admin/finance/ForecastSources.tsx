"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Download, FileJson } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { analyticsApi } from "@/lib/api/resources";
import type { AbonnementMonth, ForecastSource, ForecastSourceDay, MonthForecast } from "@/lib/types";

const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR");
const dt = (n: number | null | undefined) => (n == null ? "—" : `${fmt(n)} DT`);
const dayLabel = (key: string) => format(new Date(`${key}T12:00:00`), "d MMM", { locale: fr });
const WD_SHORT = ["D", "L", "M", "M", "J", "V", "S"];
const WD_NAME = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

// Tarifs share a blue scale (darker = later in the list); other sources have their own hue
const TARIF_COLORS = ["#a5b4fc", "#818cf8", "#6366f1", "#4f46e5", "#4338ca", "#3730a3", "#312e81", "#c7d2fe"];
const KIND_COLOR = { cafe: "#f59e0b", abos: "#0d9488", events: "#db2777" } as const;

export function sourceColors(list: ForecastSource[]) {
  const out: Record<string, string> = {};
  let i = 0;
  for (const s of list) out[s.key] = s.kind === "tarif" ? TARIF_COLORS[i++ % TARIF_COLORS.length] : KIND_COLOR[s.kind];
  return out;
}

const followsDays = (s: ForecastSource) => s.kind === "tarif" || s.kind === "cafe";

/** Money of a source on a day: real when the day is over, else expected (× the pace for tarifs and café). */
export function dayValue(d: ForecastSourceDay, s: ForecastSource, mult: number) {
  if (d.complete) return d.actual?.[s.key] ?? 0;
  return (d.expected[s.key] ?? 0) * (followsDays(s) ? mult : 1);
}

type Pts = Array<[number, number]>;
const ptsOf = (pts: Pts, x: (i: number) => number, y: (v: number) => number) =>
  pts.map(([i, v]) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

/** Cumulative real (days over), probable (from the last day over to month end) and expected. */
function cumulative(days: ForecastSourceDay[], keys: ForecastSource[], mult: number) {
  const real: Pts = [];
  const proj: Pts = [];
  const exp: Pts = [];
  const prev: Pts = [];
  let r = 0;
  let p = 0;
  let e = 0;
  let o = 0;
  days.forEach((d, i) => {
    const v = keys.reduce((a, s) => a + dayValue(d, s, mult), 0);
    e += keys.reduce((a, s) => a + (d.expected[s.key] ?? 0), 0);
    o += keys.reduce((a, s) => a + (d.previous[s.key] ?? 0), 0);
    exp.push([i, e]);
    prev.push([i, o]);
    if (d.complete) {
      r += v;
      p = r;
      real.push([i, r]);
    } else {
      if (!proj.length) proj.push([i - 1, p]);
      p += v;
      proj.push([i, p]);
    }
  });
  const lastComplete = real.length - 1;
  return { real, proj, exp, prev, now: r, end: p, expEnd: e, prevEnd: o, prevAtPoint: lastComplete >= 0 ? prev[lastComplete][1] : 0, lastComplete };
}

// ---------------------------------------------------------------------------
// The month by source: pick sources, per day or cumulative
// ---------------------------------------------------------------------------

export function SourceCurveCard({
  f,
  pace,
  onPace,
}: {
  f: MonthForecast;
  pace: boolean;
  onPace: (v: boolean) => void;
}) {
  const list = f.sources.list;
  const colors = useMemo(() => sourceColors(list), [list]);
  const tarifKeys = list.filter((s) => s.kind === "tarif").map((s) => s.key);
  const [sel, setSel] = useState<Set<string>>(() => new Set(list.filter(followsDays).map((s) => s.key)));
  const [view, setView] = useState<"day" | "cum">("day");
  const firstOpen = f.sources.days.find((d) => !d.complete) ?? f.sources.days[0];
  const [picked, setPicked] = useState<string>(firstOpen?.key ?? "");
  const mult = pace ? (f.toDate?.pace.multiplier ?? 1) : 1;
  const on = list.filter((s) => sel.has(s.key));
  const days = f.sources.days;

  const totals = useMemo(() => {
    const out: Record<string, number> = {};
    for (const s of list) out[s.key] = days.reduce((a, d) => a + dayValue(d, s, mult), 0);
    return out;
  }, [list, days, mult]);

  const allOn = list.every((s) => sel.has(s.key));
  const passesOnly = list.every((s) => sel.has(s.key) === (s.kind === "tarif"));
  const toggle = (k: string) =>
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const hasPasses = tarifKeys.length > 0 && tarifKeys.every((k) => sel.has(k));
  const parts = [
    ...(hasPasses ? ["passes"] : on.filter((s) => s.kind === "tarif").map((s) => s.label)),
    ...on.filter((s) => s.kind !== "tarif").map((s) => s.label.toLowerCase()),
  ];
  const title = `${f.period.label} : ${parts.length ? parts.join(" + ") : "rien de sélectionné"}${
    view === "day" ? " jour par jour" : ", cumul du mois"
  }${sel.has("abos") ? "" : " (sans abonnements)"}`;

  // Per-day bars
  const bars = days.map((d) => {
    const segs = on.map((s) => ({ key: s.key, v: dayValue(d, s, mult) }));
    const tot = segs.reduce((a, x) => a + x.v, 0);
    const exp = on.reduce((a, s) => a + (d.expected[s.key] ?? 0), 0);
    return { d, segs, tot, exp };
  });
  const maxBar = Math.max(1, ...bars.map((b) => Math.max(b.tot, b.exp)));
  const periodByKey = new Map(f.days.map((d) => [d.key, d.period]));

  const cum = cumulative(days, on, mult);
  const W = 640;
  const H = 240;
  const pl = 44;
  const pr = 12;
  const pt = 12;
  const pb = 24;
  const n = days.length;
  const top = Math.max(cum.end, cum.expEnd, 1) * 1.06;
  const step = top > 8000 ? 2000 : top > 3000 ? 1000 : top > 1200 ? 500 : top > 400 ? 100 : 50;
  const maxY = Math.ceil(top / step) * step;
  const x = (i: number) => pl + ((W - pl - pr) * i) / Math.max(1, n - 1);
  const y = (v: number) => pt + (H - pt - pb) * (1 - v / maxY);

  const pd = days.find((d) => d.key === picked) ?? days[0];
  const pw = f.perWeekday[pd?.weekday ?? 0];
  const pPeriod = pd ? periodByKey.get(pd.key) : null;

  return (
    <Card className="min-w-0 shadow-none">
      <CardHeader className="gap-3 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base">{title}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Chaque jour = moyenne des mêmes jours de semaine habituels ({dayLabel(f.period.base.from)} → {dayLabel(f.period.base.to)})
              × l&apos;effet du calendrier. Abonnements le jour où ceux en cours finissent, événements le jour de l&apos;événement.
              Cliquez un jour pour voir le calcul.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Segmented
              label="Vue"
              value={view}
              options={[
                ["day", "Par jour"],
                ["cum", "Cumul du mois"],
              ]}
              onChange={(v) => setView(v as "day" | "cum")}
            />
            {f.toDate ? (
              <Segmented
                label="Méthode"
                value={pace ? "pace" : "current"}
                options={[
                  ["current", "Méthode actuelle"],
                  ["pace", "+ rythme du mois"],
                ]}
                onChange={(v) => onPace(v === "pace")}
              />
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Pill active={allOn} onClick={() => setSel(new Set(list.map((s) => s.key)))}>
            Tout
          </Pill>
          {tarifKeys.length ? (
            <Pill active={passesOnly} onClick={() => setSel(new Set(tarifKeys))}>
              Passes (tous les tarifs)
            </Pill>
          ) : null}
          <span aria-hidden className="h-6 w-px bg-border" />
          {list.map((s) => {
            const active = sel.has(s.key);
            return (
              <button
                key={s.key}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(s.key)}
                className={cn(
                  "inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500",
                  active ? "border-indigo-500 bg-indigo-50 text-foreground dark:bg-indigo-950/50" : "text-muted-foreground hover:border-foreground/40",
                )}
              >
                <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colors[s.key] }} />
                {s.label}
                <b className="tabular-nums">{fmt(totals[s.key] ?? 0)}</b>
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {view === "day" ? (
          <div key="day" className="grid gap-1 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
            <div className="flex h-56 items-end gap-[3px] border-b">
              {bars.map(({ d, segs, tot, exp }) => {
                const weekend = d.weekday === 0 || d.weekday === 6;
                const period = periodByKey.get(d.key);
                const isPicked = d.key === picked;
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setPicked(d.key)}
                    aria-label={`${dayLabel(d.key)} (${WD_NAME[d.weekday]}) : ${d.complete ? "réel" : "prévu"} ${fmt(tot)} DT`}
                    title={`${dayLabel(d.key)} · ${d.complete ? "réel" : "prévu"} ${fmt(tot)} DT${period ? ` · ${period.label}` : ""}`}
                    className={cn(
                      "relative flex h-full min-w-0 flex-1 flex-col justify-end rounded-t-md px-px transition-colors duration-200 hover:bg-indigo-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500",
                      isPicked ? "bg-indigo-500/15" : period ? "bg-amber-400/15" : weekend ? "bg-muted/70" : "",
                    )}
                  >
                    {on.length ? (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-x-px border-t-2 border-dashed border-indigo-500 transition-[bottom] duration-300 ease-out"
                        style={{ bottom: `${(exp / maxBar) * 100}%` }}
                      />
                    ) : null}
                    <span
                      className={cn(
                        "flex w-full flex-col-reverse overflow-hidden rounded-t-[3px] transition-[height,opacity] duration-300 ease-out",
                        !d.complete && "opacity-40",
                      )}
                      style={{ height: `${(tot / maxBar) * 100}%` }}
                    >
                      {segs.map((sg) => (
                        <span
                          key={sg.key}
                          className="block w-full shrink-0 transition-[height] duration-300 ease-out"
                          style={{ height: tot > 0 ? `${(sg.v / tot) * 100}%` : 0, backgroundColor: colors[sg.key] }}
                        />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-[3px]">
              {days.map((d) => (
                <span
                  key={d.key}
                  className={cn(
                    "min-w-0 flex-1 text-center text-[10px] leading-tight",
                    d.weekday === 0 || d.weekday === 6 ? "font-bold text-foreground" : "text-muted-foreground",
                  )}
                >
                  {WD_SHORT[d.weekday]}
                  <br />
                  {Number(d.key.slice(8))}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <svg
            key="cum"
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
            role="img"
            aria-label="Cumul du mois : prévu, réel et probable"
          >
            {f.periods.map((p) => {
              const i0 = days.findIndex((d) => d.key === p.from);
              const i1 = days.findIndex((d) => d.key === p.to);
              if (i0 < 0 || i1 < 0) return null;
              const half = (W - pl - pr) / Math.max(1, n - 1) / 2;
              return (
                <rect
                  key={`${p.label}-${p.from}`}
                  x={Math.max(pl, x(i0) - half)}
                  y={pt}
                  width={Math.max(2, Math.min(W - pr, x(i1) + half) - Math.max(pl, x(i0) - half))}
                  height={H - pt - pb}
                  className="fill-amber-400/15"
                >
                  <title>{p.label}</title>
                </rect>
              );
            })}
            {Array.from({ length: maxY / step + 1 }, (_, k) => k * step).map((g) => (
              <g key={g}>
                <line x1={pl} x2={W - pr} y1={y(g)} y2={y(g)} className="stroke-border" />
                <text x={pl - 6} y={y(g) + 4} textAnchor="end" fontSize={11} className="fill-muted-foreground">
                  {g >= 1000 ? `${g / 1000}k` : g}
                </text>
              </g>
            ))}
            {[0, 7, 14, 21, n - 1].map((i) => (
              <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize={11} className="fill-muted-foreground">
                {days[i] ? dayLabel(days[i].key) : ""}
              </text>
            ))}
            <polyline points={ptsOf(cum.exp, x, y)} fill="none" strokeWidth={2} strokeDasharray="5 4" className="stroke-indigo-500" />
            {cum.proj.length > 1 ? (
              <polyline
                points={ptsOf(cum.proj.map(([i, v]) => [Math.max(0, i), v]), x, y)}
                fill="none"
                strokeWidth={2}
                strokeDasharray="1 4"
                strokeLinecap="round"
                className="stroke-foreground"
              />
            ) : null}
            {cum.real.length ? (
              <polyline points={ptsOf(cum.real, x, y)} fill="none" strokeWidth={2.8} strokeLinejoin="round" className="stroke-foreground" />
            ) : null}
            <text x={W - pr} y={y(cum.end) - 8} textAnchor="end" fontSize={12} fontWeight={700} className="fill-foreground">
              fin de mois {fmt(cum.end)} DT
            </text>
          </svg>
        )}

        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <Legend swatch={<i className="inline-block w-4 border-t-2 border-dashed border-indigo-500" />}>Prévu</Legend>
          <Legend swatch={<i className="inline-block h-2.5 w-4 rounded-sm bg-indigo-500" />}>Réel (jours finis)</Legend>
          <Legend swatch={<i className="inline-block h-2.5 w-4 rounded-sm bg-indigo-500/40" />}>
            Probable (jours à venir{pace ? ", avec le rythme du mois" : ""})
          </Legend>
          <Legend swatch={<i className="inline-block h-2.5 w-4 rounded-sm bg-amber-400/30" />}>Calendrier (examens, fériés…)</Legend>
          <Legend swatch={<i className="inline-block h-2.5 w-4 rounded-sm bg-muted" />}>Samedi / dimanche</Legend>
        </div>

        {pace && f.toDate ? (
          <p className="text-xs text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
            Rythme du mois : l&apos;écart des {f.toDate.days} jours finis ({f.toDate.gapPct != null ? `${f.toDate.gapPct > 0 ? "+" : ""}${Math.round(f.toDate.gapPct)} %` : "—"}) compte à{" "}
            {Math.round(f.toDate.pace.weight * 100)} % pour les jours restants → passes et café × {f.toDate.pace.multiplier.toLocaleString("fr-FR")}.
            Plus il y a de jours vécus, plus il compte.
          </p>
        ) : null}

        {view === "day" && pd ? (
          <div
            key={pd.key}
            className="grid gap-4 rounded-xl border bg-muted/40 p-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]"
          >
            <div className="grid content-start gap-1 text-sm">
              <b className="text-base">
                {dayLabel(pd.key)} · {WD_NAME[pd.weekday]} · {pd.complete ? "fini" : pd.actual ? "aujourd'hui" : "à venir"}
              </b>
              <span className="text-muted-foreground">
                Passes + café : moyenne de {pw?.samples ?? 0} {WD_NAME[pd.weekday]}s habituels de la base ={" "}
                {dt((pw?.revenueVisits ?? 0) + (pw?.products ?? 0))}.
              </span>
              <span className="text-muted-foreground">
                {pPeriod
                  ? `${pPeriod.label} : ${pPeriod.known ? `× ${pPeriod.factor.toLocaleString("fr-FR")}, mesuré les fois précédentes` : "effet jamais mesuré, compté comme un jour habituel"}.`
                  : "Pas de date du calendrier ce jour-là."}
              </span>
            </div>
            <div className="grid content-start text-sm">
              <div className="grid grid-cols-[minmax(0,1fr)_88px_88px] gap-2 px-2 pb-1 text-xs font-semibold text-muted-foreground">
                <span>Source</span>
                <span className="text-right">Prévu</span>
                <span className="text-right">Réel</span>
              </div>
              {list.map((s) => (
                <div key={s.key} className="grid grid-cols-[minmax(0,1fr)_88px_88px] gap-2 border-t px-2 py-1.5 tabular-nums">
                  <span className="flex min-w-0 items-center gap-2">
                    <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: colors[s.key] }} />
                    <span className="truncate">{s.label}</span>
                  </span>
                  <span className="text-right">{dt(pd.expected[s.key] ?? 0)}</span>
                  <span className="text-right font-semibold">
                    {pd.actual ? dt(pd.actual[s.key] ?? 0) + (pd.complete ? "" : " *") : "—"}
                  </span>
                </div>
              ))}
              {pd.actual && !pd.complete ? <span className="px-2 pt-1 text-xs text-muted-foreground">* journée en cours</span> : null}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// This month vs last month, source by source
// ---------------------------------------------------------------------------

export function CompareCard({
  f,
  pace,
  abonnements,
}: {
  f: MonthForecast;
  pace: boolean;
  abonnements: AbonnementMonth | null;
}) {
  const list = f.sources.list;
  const tarifs = list.filter((s) => s.kind === "tarif");
  const [tab, setTab] = useState<string>("all");
  const mult = pace ? (f.toDate?.pace.multiplier ?? 1) : 1;
  const days = f.sources.days;
  const lastComplete = [...days].reverse().find((d) => d.complete);
  const pick = (kinds: string[]) => list.filter((s) => kinds.includes(s.kind));
  const passKeys = tab === "all" ? tarifs : tarifs.filter((s) => s.key === tab);
  const a = abonnements;
  const panels = [
    { key: "passes", label: tab === "all" ? "Passes (tous les tarifs)" : (passKeys[0]?.label ?? "Passes"), color: "#4f46e5", keys: passKeys },
    { key: "cafe", label: "Café & produits", color: "#d97706", keys: pick(["cafe"]) },
    {
      key: "abos",
      label: "Abonnements",
      color: "#0d9488",
      keys: pick(["abos"]),
      extra: a
        ? `Abonnés actifs ${a.active.now} (${f.period.previousLabel} ${a.active.previous}) · nouveaux ${a.newSubscribers.now} (${a.newSubscribers.previous}) · renouvelés ${a.renewedFromLastMonth.renewed} sur ${a.renewedFromLastMonth.ended} de ceux finis en ${f.period.previousLabel}`
        : null,
    },
    { key: "total", label: "Total", color: "currentColor", keys: list },
  ];

  return (
    <Card className="min-w-0 shadow-none">
      <CardHeader className="gap-3 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base">
              {f.period.label} vs {f.period.previousLabel}, source par source
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Cumul du mois. {f.period.previousLabel} est rejoué sur les jours de semaine de {f.period.label} (un dimanche face aux
              dimanches) ; abonnements et événements à la même date.
            </p>
          </div>
          {tarifs.length > 1 ? (
            <Segmented
              label="Tarif"
              value={tab}
              options={[["all", "Tous les tarifs"], ...tarifs.map((s) => [s.key, s.label] as [string, string])]}
              onChange={setTab}
            />
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {panels.map((p, idx) => (
            <ComparePanel
              key={`${p.key}-${tab}`}
              index={idx}
              label={p.label}
              color={p.color}
              extra={p.extra ?? null}
              c={cumulative(days, p.keys, mult)}
              pointLabel={lastComplete ? dayLabel(lastComplete.key) : null}
              previousLabel={f.period.previousLabel}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <Legend swatch={<i className="inline-block w-4 border-t-[3px] border-foreground" />}>{f.period.label} réel</Legend>
          <Legend swatch={<i className="inline-block w-4 border-t-2 border-dotted border-foreground" />}>{f.period.label} probable</Legend>
          <Legend swatch={<i className="inline-block w-4 border-t-2 border-dashed border-muted-foreground" />}>{f.period.previousLabel}</Legend>
        </div>
      </CardContent>
    </Card>
  );
}

function ComparePanel({
  label,
  color,
  extra,
  c,
  pointLabel,
  previousLabel,
  index,
}: {
  label: string;
  color: string;
  extra: string | null;
  c: ReturnType<typeof cumulative>;
  pointLabel: string | null;
  previousLabel: string;
  index: number;
}) {
  const W = 300;
  const H = 120;
  const n = Math.max(c.exp.length, 1);
  const max = Math.max(c.end, c.prevEnd, 1) * 1.08;
  const x = (i: number) => 2 + ((W - 4) * Math.max(0, i)) / Math.max(1, n - 1);
  const y = (v: number) => 4 + (H - 8) * (1 - v / max);
  const diff = pointLabel && c.prevAtPoint > 0 ? Math.round((c.now / c.prevAtPoint - 1) * 100) : null;
  const up = diff == null ? null : diff >= 0;
  return (
    <div
      style={{ animationDelay: `${index * 50}ms`, color: color === "currentColor" ? undefined : color }}
      className="grid min-w-0 content-start gap-2 rounded-xl border p-3 text-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300 motion-safe:fill-mode-both"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
          <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-sm bg-current" style={{ color }} />
          <span className="truncate">{label}</span>
        </span>
        <span
          className={cn(
            "shrink-0 text-sm font-bold tabular-nums",
            up == null ? "text-muted-foreground" : up ? "text-emerald-600" : "text-rose-600",
          )}
        >
          {diff == null ? "rien encore" : `${up ? "+" : "−"}${Math.abs(diff)} % vs ${previousLabel}`}
        </span>
      </div>
      <span className="text-xs text-muted-foreground">
        {pointLabel ? `Au ${pointLabel} : ${dt(c.now)} · ${previousLabel} au même point : ${dt(c.prevAtPoint)}` : "Pas encore de jour fini ce mois."}
      </span>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full border-b" role="img" aria-label={`${label} : probable ${dt(c.end)}, ${previousLabel} ${dt(c.prevEnd)}`}>
        <polyline points={ptsOf(c.prev, x, y)} fill="none" strokeWidth={1.8} strokeDasharray="5 4" className="stroke-muted-foreground" />
        {c.proj.length > 1 ? (
          <polyline points={ptsOf(c.proj, x, y)} fill="none" strokeWidth={2} strokeDasharray="1 4" strokeLinecap="round" stroke="currentColor" />
        ) : null}
        {c.real.length ? <polyline points={ptsOf(c.real, x, y)} fill="none" strokeWidth={3} strokeLinejoin="round" stroke="currentColor" /> : null}
      </svg>
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <span>
          Probable <b className="text-foreground tabular-nums">{dt(c.end)}</b>
        </span>
        <span className="text-right">
          {previousLabel} <b className="text-foreground tabular-nums">{dt(c.prevEnd)}</b>
        </span>
      </div>
      {extra ? <span className="border-t pt-2 text-xs text-muted-foreground">{extra}</span> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export function ExportCard({ year, month, facilityId }: { year: number; month: number; facilityId?: string }) {
  const [busy, setBusy] = useState<"csv" | "json" | null>(null);
  const run = async (fmtKind: "csv" | "json") => {
    setBusy(fmtKind);
    try {
      await analyticsApi.downloadForecast(year, month, fmtKind, facilityId);
    } catch (e) {
      toast.error((e as Error).message || "Export impossible");
    } finally {
      setBusy(null);
    }
  };
  return (
    <Card className="shadow-none">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="min-w-0">
          <div className="font-semibold">Exporter le calcul</div>
          <p className="text-sm text-muted-foreground">
            CSV : chaque jour, prévu et réel par tarif, café, abonnements, événements, avec le mois dernier. JSON : tout (règles,
            jours de la base, 2 mois d&apos;historique, abonnements qui finissent).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="gap-1.5" disabled={busy != null} onClick={() => void run("csv")}>
            <Download className="h-4 w-4" />
            {busy === "csv" ? "Export…" : "CSV jour par jour"}
          </Button>
          <Button variant="outline" className="gap-1.5" disabled={busy != null} onClick={() => void run("json")}>
            <FileJson className="h-4 w-4" />
            {busy === "json" ? "Export…" : "JSON complet"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Small controls
// ---------------------------------------------------------------------------

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex flex-wrap rounded-lg bg-muted p-1 text-sm" role="group" aria-label={label}>
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "rounded-md px-3 py-1 font-medium transition-all duration-200",
            value === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "min-h-9 rounded-full border px-3 py-1 text-sm font-semibold transition-colors duration-200",
        active ? "border-foreground bg-foreground text-background" : "hover:border-foreground/40",
      )}
    >
      {children}
    </button>
  );
}

function Legend({ swatch, children }: { swatch: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      {swatch}
      {children}
    </span>
  );
}
