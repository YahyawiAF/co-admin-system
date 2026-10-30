"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { analyticsApi } from "@/lib/api/resources";
import { cn } from "@/lib/utils";

const GOOD = "hsl(152 60% 38%)";
const NOT_BACK = "hsl(214 32% 85%)";
const LINE = "hsl(var(--primary))";

function pctTone(pct: number | null) {
  if (pct == null) return "bg-muted text-muted-foreground";
  if (pct >= 45) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300";
  if (pct >= 30) return "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300";
  return "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300";
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="space-y-0.5 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

/** Finance → Nouveaux: arrivals curve, who comes back within 14 days and why. */
export function FinanceNewcomers() {
  const [scale, setScale] = useState<"week" | "day">("week");
  const { data, isLoading } = useQuery({
    queryKey: ["analytics-newcomers"],
    queryFn: () => analyticsApi.newcomers(12),
  });

  const weekChart = useMemo(
    () =>
      (data?.cohorts ?? []).map((c) => ({
        label: format(parseISO(c.weekStart), "d MMM", { locale: fr }),
        Revenus: c.back,
        "Pas revenus": c.count - c.back,
        Cumul: c.total,
        early: c.early,
      })),
    [data]
  );
  const dayChart = useMemo(() => {
    const days = data?.daily ?? [];
    return days.map((d, i) => {
      const win = days.slice(Math.max(0, i - 6), i + 1);
      return {
        label: format(parseISO(d.day), "d MMM", { locale: fr }),
        Nouveaux: d.count,
        "Moyenne 7 j": Math.round((win.reduce((a, x) => a + x.count, 0) / win.length) * 10) / 10,
      };
    });
  }, [data]);

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const k = data.kpis;
  const vsPrev = k.thisMonth - k.prevMonthSamePoint;

  return (
    <div className="space-y-4 animate-in fade-in-0 duration-300 motion-reduce:animate-none">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Nouveaux ce mois"
          value={String(k.thisMonth)}
          hint={`${vsPrev >= 0 ? "+" : ""}${vsPrev} vs même jour du mois dernier · ${k.prevMonth} le mois dernier`}
        />
        <Kpi
          label="Reviennent en 14 j"
          value={k.returnPct != null ? `${k.returnPct} %` : "—"}
          hint={`sur ${k.returnBase} nouveaux des 60 derniers jours`}
        />
        <Kpi
          label="App installée le 1ᵉʳ jour"
          value={k.appDay1Pct != null ? `${k.appDay1Pct} %` : "—"}
          hint="nouveaux des 60 derniers jours"
        />
        <Kpi label="Cette semaine" value={String(k.thisWeek)} hint="nouveaux depuis lundi" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">Arrivées des nouveaux</CardTitle>
              <p className="text-sm text-muted-foreground">
                {scale === "week"
                  ? "Par semaine · vert = revenu dans les 14 jours · courbe = total"
                  : "Par jour · courbe = moyenne sur 7 jours"}
              </p>
            </div>
            <div className="inline-flex rounded-lg bg-muted p-0.5" role="group" aria-label="Échelle">
              {(["week", "day"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={scale === s}
                  onClick={() => setScale(s)}
                  className={cn(
                    "rounded-md px-3 py-1 text-sm font-medium transition-colors duration-200",
                    scale === s ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {s === "week" ? "Semaine" : "Jour"}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <div key={scale} className="h-72 animate-in fade-in-0 duration-300 motion-reduce:animate-none">
              <ResponsiveContainer width="100%" height="100%">
                {scale === "week" ? (
                  <ComposedChart data={weekChart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis yAxisId="n" allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis yAxisId="c" orientation="right" allowDecimals={false} tick={{ fontSize: 11, fill: LINE }} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    />
                    <Bar yAxisId="n" dataKey="Revenus" stackId="a" fill={GOOD} radius={[0, 0, 0, 0]} />
                    <Bar yAxisId="n" dataKey="Pas revenus" stackId="a" fill={NOT_BACK} radius={[3, 3, 0, 0]} />
                    <Line yAxisId="c" dataKey="Cumul" stroke={LINE} strokeWidth={2.5} dot={false} />
                  </ComposedChart>
                ) : (
                  <ComposedChart data={dayChart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" interval={6} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    />
                    <Bar dataKey="Nouveaux" fill="hsl(var(--primary) / 0.35)" radius={[2, 2, 0, 0]} />
                    <Line dataKey="Moyenne 7 j" stroke={LINE} strokeWidth={2.5} dot={false} />
                  </ComposedChart>
                )}
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Qui revient ?</CardTitle>
            <p className="text-sm text-muted-foreground">% des nouveaux revenus dans les 14 jours</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.factors.map((f) => (
              <div key={f.title} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold">{f.title}</p>
                  {!f.rows.length ? (
                    <span className="text-xs text-muted-foreground">pas encore de réponses</span>
                  ) : null}
                </div>
                {f.rows.map((r) => (
                  <div key={r.label} className="grid grid-cols-[120px_minmax(0,1fr)_88px] items-center gap-2 text-xs">
                    <span className="truncate text-muted-foreground">{r.label}</span>
                    <span className="h-2.5 overflow-hidden rounded-full bg-muted">
                      <span
                        className={cn(
                          "block h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none",
                          (r.pct ?? 0) >= 45 ? "bg-emerald-600" : (r.pct ?? 0) >= 30 ? "bg-amber-500" : "bg-rose-500"
                        )}
                        style={{ width: `${r.pct ?? 0}%` }}
                      />
                    </span>
                    <span className="text-right tabular-nums">
                      <b className="text-foreground">{r.pct ?? "—"} %</b>{" "}
                      <span className="text-muted-foreground">({r.count})</span>
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
          <div>
            <CardTitle className="text-base">Détail par semaine d’arrivée</CardTitle>
            <p className="text-sm text-muted-foreground">
              {k.notBack} nouveaux venus une seule fois à relancer
            </p>
          </div>
          <Button asChild size="sm" variant="outline" className="gap-1">
            <Link href="/relances?reason=NEW_NOT_BACK">
              Relancer les « pas revenus »
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-2 font-semibold">Semaine du</th>
                <th className="py-2 pr-2 text-right font-semibold">Nouveaux</th>
                <th className="py-2 pr-2 text-right font-semibold">Revenus en 14 j</th>
                <th className="py-2 pr-2 text-right font-semibold">%</th>
                <th className="py-2 pr-2 text-right font-semibold">Jours de visite (moy.)</th>
                <th className="py-2 text-right font-semibold">App 1ᵉʳ jour</th>
              </tr>
            </thead>
            <tbody>
              {[...data.cohorts].reverse().map((c) => (
                <tr key={c.weekStart} className="border-b last:border-0 transition-colors hover:bg-muted/50">
                  <td className="py-2 pr-2">
                    {format(parseISO(c.weekStart), "d MMM", { locale: fr })}
                    {c.early && c.count ? (
                      <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        trop tôt
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">{c.count}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{c.back}</td>
                  <td className="py-2 pr-2 text-right">
                    {c.count ? (
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", pctTone(c.pct))}>
                        {c.pct} %
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">{c.avgVisitDays ?? "—"}</td>
                  <td className="py-2 text-right tabular-nums">{c.count ? c.appDay1 : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
