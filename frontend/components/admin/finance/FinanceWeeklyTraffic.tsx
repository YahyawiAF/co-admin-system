"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { analyticsApi } from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import {
  WEEKDAY_LABELS,
  WEEKDAYS_MON_FIRST,
  hourLabel,
} from "@/lib/traffic-utils";

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

  /** Opening window: hours with any presence across the week (fallback 8h-20h). */
  const [firstHour, lastHour] = useMemo(() => {
    const active = new Set<number>();
    for (const d of days) {
      for (const h of d.hours) if (h.avgPresent > 0) active.add(h.hour);
    }
    if (!active.size) return [8, 20];
    return [Math.min(...active), Math.max(...active)];
  }, [days]);

  const yMax = useMemo(() => {
    let max = 0;
    for (const d of days) {
      for (const h of d.hours) {
        max = Math.max(max, metric === "arrivals" ? h.avgArrivals : h.avgPresent);
      }
    }
    return Math.max(1, Math.ceil(max));
  }, [days, metric]);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <div>
          <CardTitle className="text-base">Affluence par jour et par heure</CardTitle>
          <p className="text-xs text-muted-foreground">
            Moyenne sur les {weeks} dernières semaines · barre foncée = heure de pointe
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="inline-flex rounded-full border p-0.5">
            {(
              [
                { id: "arrivals", label: "Arrivées" },
                { id: "present", label: "Présence moyenne" },
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
                    : "text-muted-foreground hover:text-foreground"
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
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {w} sem.
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {WEEKDAYS_MON_FIRST.map((wd) => {
              const day = days.find((d) => d.weekday === wd);
              if (!day) return null;
              const peakHour =
                metric === "arrivals" ? day.peakHour : day.peakPresentHour;
              const peakValue =
                metric === "arrivals" ? day.peakArrivals : day.peakPresent;
              const chart = day.hours
                .filter((h) => h.hour >= firstHour && h.hour <= lastHour)
                .map((h) => ({
                  hour: hourLabel(h.hour),
                  rawHour: h.hour,
                  value: metric === "arrivals" ? h.avgArrivals : h.avgPresent,
                }));
              return (
                <div key={wd} className="rounded-lg border p-3">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <div>
                      <Link
                        href={`/analyse-jour?weekday=${wd}`}
                        className="group inline-flex items-center gap-1 text-sm font-semibold hover:underline"
                      >
                        {WEEKDAY_LABELS[wd]}
                        <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {peakValue > 0
                          ? `Pic à ${hourLabel(peakHour)} (${peakValue} ${
                              metric === "arrivals" ? "arrivées" : "présents"
                            })`
                          : "Aucune donnée"}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      ~{day.avgVisits} visites / jour
                    </span>
                  </div>
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chart} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                        <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={1} />
                        <YAxis domain={[0, yMax]} tick={{ fontSize: 10 }} allowDecimals={false} />
                        <Tooltip
                          formatter={(v: number) => [
                            v,
                            metric === "arrivals" ? "Arrivées moy." : "Présents moy.",
                          ]}
                        />
                        <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                          {chart.map((c) => (
                            <Cell
                              key={c.rawHour}
                              fill={
                                c.rawHour === peakHour && peakValue > 0
                                  ? "hsl(221 83% 45%)"
                                  : "hsl(213 80% 75%)"
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
