"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { analyticsApi } from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import {
  HOUR_STRENGTH_CLASS,
  HOUR_STRENGTH_LABEL,
  WEEKDAY_LABELS,
  WEEKDAYS_MON_FIRST,
  formatPeopleCount,
  formatPeopleDetail,
  hourLabel,
  hourStrength,
} from "@/lib/traffic-utils";
import {
  insightDotClass,
  weeklyInsights,
} from "@/lib/traffic-insights";

type Metric = "arrivals" | "present";
const WEEK_OPTIONS = [4, 8, 12] as const;

export function FinanceWeeklyTraffic() {
  const [metric, setMetric] = useState<Metric>("arrivals");
  const [weeks, setWeeks] = useState<(typeof WEEK_OPTIONS)[number]>(8);
  const range = useMemo(() => {
    const to = new Date();
    return {
      from: format(subDays(to, weeks * 7 - 1), "yyyy-MM-dd"),
      to: format(to, "yyyy-MM-dd"),
    };
  }, [weeks]);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.analyticsTrafficWeekly(range.from, range.to),
    queryFn: () => analyticsApi.trafficWeekly(range),
  });

  const days = useMemo(() => data?.days ?? [], [data?.days]);
  const insights = useMemo(
    () => (days.length ? weeklyInsights(days, weeks) : []),
    [days, weeks],
  );

  /** Opening window: hours with any presence across the week (fallback 8h-20h). */
  const [firstHour, lastHour] = useMemo(() => {
    const active = new Set<number>();
    for (const d of days) {
      for (const h of d.hours) {
        if (h.avgPresent > 0 || h.avgArrivals > 0) active.add(h.hour);
      }
    }
    if (!active.size) return [8, 20];
    return [Math.min(...active), Math.max(...active)];
  }, [days]);

  const hours = useMemo(
    () => Array.from({ length: lastHour - firstHour + 1 }, (_, i) => firstHour + i),
    [firstHour, lastHour],
  );

  const summary = useMemo(() => {
    let totalVisits = 0;
    let bestWd: number | null = null;
    let bestAvg = -1;
    let worstWd: number | null = null;
    let worstAvg = Infinity;
    let peakHour = 8;
    let peakSum = -1;
    for (const d of days) {
      const visits = Math.round(d.avgVisits * d.occurrences);
      totalVisits += visits;
      if (d.occurrences >= 2 && d.avgVisits > bestAvg) {
        bestAvg = d.avgVisits;
        bestWd = d.weekday;
      }
      if (d.occurrences >= 2 && d.avgVisits < worstAvg) {
        worstAvg = d.avgVisits;
        worstWd = d.weekday;
      }
      for (const h of d.hours) {
        const v = metric === "arrivals" ? h.avgArrivals : h.avgPresent;
        const score = v * d.occurrences;
        if (score > peakSum) {
          peakSum = score;
          peakHour = h.hour;
        }
      }
    }
    const openDays = days.filter((d) => d.occurrences > 0).length || 1;
    return {
      totalVisits,
      avgPerDay: Math.round(totalVisits / Math.max(1, weeks * 7) * 10) / 10,
      bestWd,
      bestAvg,
      worstWd,
      worstAvg: Number.isFinite(worstAvg) ? worstAvg : 0,
      peakHour,
    };
  }, [days, weeks, metric]);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <div>
          <CardTitle className="text-base">Affluence par jour et par heure</CardTitle>
          <p className="text-xs text-muted-foreground">
            Moyenne sur les {weeks} dernières semaines · couleurs = force relative au pic du jour
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="inline-flex rounded-full border p-0.5">
            {(
              [
                { id: "arrivals", label: "Arrivées" },
                { id: "present", label: "Présents" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setMetric(opt.id)}
                className={cn(
                  "rounded-full px-2.5 py-0.5 font-medium",
                  metric === opt.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-full border p-0.5">
            {WEEK_OPTIONS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWeeks(w)}
                className={cn(
                  "rounded-full px-2.5 py-0.5 font-medium",
                  weeks === w
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {w} sem.
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryTile
                label="Visites totales"
                value={String(summary.totalVisits)}
                hint={`sur ${weeks} sem. · ≈ ${formatPeopleCount(summary.avgPerDay)} / jour`}
              />
              <SummaryTile
                label="Meilleur jour"
                value={
                  summary.bestWd != null
                    ? WEEKDAY_LABELS[summary.bestWd]
                    : "—"
                }
                hint={
                  summary.bestWd != null
                    ? `≈ ${formatPeopleCount(summary.bestAvg)} visites / jour`
                    : undefined
                }
              />
              <SummaryTile
                label="Jour le plus calme"
                value={
                  summary.worstWd != null
                    ? WEEKDAY_LABELS[summary.worstWd]
                    : "—"
                }
                hint={
                  summary.worstWd != null
                    ? `≈ ${formatPeopleCount(summary.worstAvg)} visites / jour`
                    : undefined
                }
              />
              <SummaryTile
                label="Créneau le plus fort"
                value={hourLabel(summary.peakHour)}
                hint={
                  metric === "arrivals"
                    ? "Heure où les gens arrivent le plus"
                    : "Heure où l'espace est le plus plein"
                }
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Légende :</span>
              {(["strong", "ok", "weak", "empty"] as const).map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5">
                  <span
                    className={cn(
                      "inline-block h-3.5 w-5 rounded-sm",
                      HOUR_STRENGTH_CLASS[s],
                    )}
                  />
                  {HOUR_STRENGTH_LABEL[s]}
                </span>
              ))}
              <span className="text-muted-foreground/80">
                · chiffres = personnes entières (pas de 0,3)
              </span>
            </div>

            {insights.length ? (
              <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Ce que vous pouvez faire
                </p>
                <ul className="space-y-1.5 text-sm">
                  {insights.map((i, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span
                        className={cn(
                          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                          insightDotClass(i.tone),
                        )}
                      />
                      <span>{i.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[640px] border-collapse text-xs">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="sticky left-0 z-10 bg-muted/40 px-3 py-2 text-left font-medium">
                      Jour
                    </th>
                    {hours.map((h) => (
                      <th
                        key={h}
                        className="px-0.5 py-2 text-center font-normal text-muted-foreground"
                      >
                        {h}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-right font-medium">Visites / j</th>
                  </tr>
                </thead>
                <tbody>
                  {WEEKDAYS_MON_FIRST.map((wd) => {
                    const day = days.find((d) => d.weekday === wd);
                    if (!day) return null;
                    const peak =
                      metric === "arrivals" ? day.peakArrivals : day.peakPresent;
                    const peakHour =
                      metric === "arrivals" ? day.peakHour : day.peakPresentHour;
                    const totalForWeekday = Math.round(
                      day.avgVisits * day.occurrences,
                    );
                    return (
                      <tr key={wd} className="border-b last:border-0">
                        <td className="sticky left-0 z-10 bg-card px-3 py-2">
                          <Link
                            href={`/finance?tab=jour&weekday=${wd}`}
                            className="group inline-flex items-center gap-1 font-semibold hover:underline"
                          >
                            {WEEKDAY_LABELS[wd]}
                            <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                          </Link>
                          <p className="text-[10px] text-muted-foreground">
                            {peak > 0
                              ? `Pic ${hourLabel(peakHour)} · ${formatPeopleDetail(
                                  peak,
                                  metric === "arrivals" ? "arrivée" : "présent",
                                )}`
                              : "Aucune donnée"}
                            {" · "}
                            {totalForWeekday} visites ({day.occurrences} j)
                          </p>
                        </td>
                        {hours.map((h) => {
                          const cell = day.hours.find((x) => x.hour === h);
                          const raw =
                            metric === "arrivals"
                              ? cell?.avgArrivals ?? 0
                              : cell?.avgPresent ?? 0;
                          const strength = hourStrength(raw, peak);
                          const shown = formatPeopleCount(raw);
                          return (
                            <td key={h} className="p-0.5">
                              <div
                                title={`${hourLabel(h)} · ${formatPeopleDetail(
                                  raw,
                                  metric === "arrivals" ? "arrivée" : "présent",
                                )} · ${HOUR_STRENGTH_LABEL[strength]}`}
                                className={cn(
                                  "flex h-9 min-w-[1.75rem] items-center justify-center rounded-sm font-semibold tabular-nums",
                                  HOUR_STRENGTH_CLASS[strength],
                                )}
                              >
                                {strength === "empty" ? "" : shown}
                              </div>
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">
                          {formatPeopleCount(day.avgVisits)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-lg font-bold tracking-tight">{value}</div>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
