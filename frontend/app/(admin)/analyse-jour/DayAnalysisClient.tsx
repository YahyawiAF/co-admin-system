"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, parseISO, startOfDay, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { analyticsApi } from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import type { DayTrafficCompare, DayTrafficSeries } from "@/lib/types";
import {
  WEEKDAY_LABELS,
  hourLabel,
  percentDelta,
} from "@/lib/traffic-utils";

type Metric = "arrivals" | "present";

const COMPARE_COLORS = [
  "hsl(215 20% 55%)",
  "hsl(215 20% 65%)",
  "hsl(215 20% 72%)",
  "hsl(215 20% 78%)",
  "hsl(215 20% 82%)",
  "hsl(215 20% 85%)",
  "hsl(215 20% 88%)",
  "hsl(215 20% 90%)",
];

function resolveDate(dateParam: string | null, weekdayParam: string | null) {
  if (dateParam) {
    const d = parseISO(dateParam);
    if (!Number.isNaN(d.getTime())) return startOfDay(d);
  }
  const today = startOfDay(new Date());
  const wd = weekdayParam != null ? Number(weekdayParam) : NaN;
  if (Number.isInteger(wd) && wd >= 0 && wd <= 6) {
    return subDays(today, (today.getDay() - wd + 7) % 7);
  }
  return today;
}

function dayLabel(date: string) {
  return format(parseISO(date), "EEE d MMM", { locale: fr });
}

export default function DayAnalysisClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const date = useMemo(
    () => resolveDate(searchParams.get("date"), searchParams.get("weekday")),
    [searchParams]
  );
  const dateKey = format(date, "yyyy-MM-dd");
  const compare: DayTrafficCompare =
    searchParams.get("compare") === "previous" ? "previous" : "weekday";
  const count = searchParams.get("count") === "8" ? 8 : 4;
  const [metric, setMetric] = useState<Metric>("present");

  const update = (next: {
    date?: string;
    compare?: DayTrafficCompare;
    count?: number;
  }) => {
    const q = new URLSearchParams({
      date: next.date ?? dateKey,
      compare: next.compare ?? compare,
      count: String(next.count ?? count),
    });
    router.replace(`/analyse-jour?${q.toString()}`);
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.analyticsTrafficDay(dateKey, compare, count),
    queryFn: () => analyticsApi.trafficDay({ date: dateKey, compare, count }),
  });

  const compareLabel =
    compare === "weekday"
      ? `${count} ${WEEKDAY_LABELS[date.getDay()].toLowerCase()}s précédents`
      : `${count} jours précédents`;

  const [firstHour, lastHour] = useMemo(() => {
    if (!data) return [8, 20];
    const all = [data.target, ...data.comparisons];
    const active: number[] = [];
    for (let h = 0; h < 24; h++) {
      if (all.some((d) => d.present[h] > 0)) active.push(h);
    }
    if (!active.length) return [8, 20];
    return [active[0], active[active.length - 1]];
  }, [data]);

  const chartData = useMemo(() => {
    if (!data) return [];
    const rows: Record<string, number | string>[] = [];
    for (let h = firstHour; h <= lastHour; h++) {
      const row: Record<string, number | string> = {
        hour: hourLabel(h),
        target: data.target[metric][h],
        average: data.average[metric][h],
      };
      for (const c of data.comparisons) row[c.date] = c[metric][h];
      rows.push(row);
    }
    return rows;
  }, [data, metric, firstHour, lastHour]);

  const kpis = data
    ? [
        {
          label: "Visites",
          value: data.target.totals.visits,
          avg: data.average.totals.visits,
          fmt: (v: number) => String(v),
        },
        {
          label: "Personnes uniques",
          value: data.target.totals.uniqueVisitors,
          avg: data.average.totals.uniqueVisitors,
          fmt: (v: number) => String(v),
        },
        {
          label: "Revenu du jour",
          value: data.target.totals.revenue,
          avg: data.average.totals.revenue,
          fmt: (v: number) => `${v.toFixed(1)} DT`,
          detail: `Visites ${(data.target.totals.revenueVisits ?? 0).toFixed(1)} · Abonnements ${(data.target.totals.revenueAbonnements ?? 0).toFixed(1)} DT`,
        },
        {
          label: "Durée moyenne",
          value: data.target.totals.avgDurationMin,
          avg: data.average.totals.avgDurationMin,
          fmt: (v: number) =>
            v >= 60 ? `${Math.floor(v / 60)} h ${String(Math.round(v % 60)).padStart(2, "0")}` : `${Math.round(v)} min`,
        },
        {
          label: "Pic de présence",
          value: data.target.totals.peakPresent,
          avg: data.average.totals.peakPresent,
          fmt: (v: number) => String(v),
          sub:
            data.target.totals.peakPresent > 0
              ? `à ${hourLabel(data.target.totals.peakHour)}`
              : undefined,
        },
        {
          label: "Partis sans payer",
          value: data.target.totals.leftUnpaid,
          avg: data.average.totals.leftUnpaid,
          fmt: (v: number) => String(v),
          inverse: true,
        },
      ]
    : [];

  const tableRows: { day: DayTrafficSeries; isTarget: boolean }[] = data
    ? [
        { day: data.target, isTarget: true },
        ...data.comparisons.map((day) => ({ day, isTarget: false })),
      ]
    : [];

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analyse du jour</h1>
          <p className="text-sm text-muted-foreground">
            {format(date, "EEEE d MMMM yyyy", { locale: fr })} comparé aux{" "}
            {compareLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border bg-card px-1 py-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => update({ date: format(subDays(date, 1), "yyyy-MM-dd") })}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="date"
              className="h-8 w-[150px] border-0 shadow-none"
              value={dateKey}
              onChange={(e) => e.target.value && update({ date: e.target.value })}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => update({ date: format(addDays(date, 1), "yyyy-MM-dd") })}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => update({ date: format(new Date(), "yyyy-MM-dd") })}
            >
              Aujourd&apos;hui
            </Button>
          </div>
          <Select
            value={compare}
            onValueChange={(v) => update({ compare: v as DayTrafficCompare })}
          >
            <SelectTrigger className="w-[210px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekday">Mêmes jours précédents</SelectItem>
              <SelectItem value="previous">Jours précédents</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={String(count)}
            onValueChange={(v) => update({ count: Number(v) })}
          >
            <SelectTrigger className="w-[90px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="4">4</SelectItem>
              <SelectItem value="8">8</SelectItem>
            </SelectContent>
          </Select>
          <Button asChild variant="outline" size="sm">
            <Link href={`/journal?date=${dateKey}`}>Voir le journal</Link>
          </Button>
        </div>
      </div>

      {isError ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="mb-2 text-sm text-destructive">
              Impossible de charger l&apos;analyse
            </p>
            <Button variant="outline" onClick={() => refetch()}>
              Réessayer
            </Button>
          </CardContent>
        </Card>
      ) : isLoading || !data ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="h-80 w-full" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {kpis.map((k) => {
              const delta = percentDelta(k.value, k.avg);
              const good = delta != null && (k.inverse ? delta < 0 : delta > 0);
              const bad = delta != null && (k.inverse ? delta > 0 : delta < 0);
              return (
                <Card key={k.label}>
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs font-medium text-muted-foreground">
                      {k.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-0.5">
                    <div className="text-2xl font-bold">
                      {k.fmt(k.value)}
                      {k.sub ? (
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          {k.sub}
                        </span>
                      ) : null}
                    </div>
                    {"detail" in k && k.detail ? (
                      <p className="text-xs text-muted-foreground">{k.detail}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      <span
                        className={cn(
                          "font-semibold",
                          good && "text-emerald-600",
                          bad && "text-red-600"
                        )}
                      >
                        {delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta}%`}
                      </span>{" "}
                      vs moy. {k.fmt(k.avg)}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
              <CardTitle className="text-base">Heure par heure</CardTitle>
              <div className="inline-flex rounded-full border p-0.5 text-xs">
                {(
                  [
                    { id: "present", label: "Présents" },
                    { id: "arrivals", label: "Arrivées" },
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
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {data.comparisons.map((c, i) => (
                      <Line
                        key={c.date}
                        type="monotone"
                        dataKey={c.date}
                        name={dayLabel(c.date)}
                        stroke={COMPARE_COLORS[i % COMPARE_COLORS.length]}
                        strokeWidth={1}
                        dot={false}
                      />
                    ))}
                    <Line
                      type="monotone"
                      dataKey="average"
                      name="Moyenne"
                      stroke="hsl(32 95% 50%)"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="target"
                      name={dayLabel(data.date)}
                      stroke="hsl(221 83% 45%)"
                      strokeWidth={3}
                      dot={{ r: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Jours comparés</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jour</TableHead>
                    <TableHead className="text-right">Visites</TableHead>
                    <TableHead className="text-right">Personnes</TableHead>
                    <TableHead className="text-right">Revenu visites</TableHead>
                    <TableHead className="text-right">Abonnements</TableHead>
                    <TableHead className="text-right">Revenu total</TableHead>
                    <TableHead className="text-right">Durée moy.</TableHead>
                    <TableHead className="text-right">Pic</TableHead>
                    <TableHead className="text-right">Partis sans payer</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableRows.map(({ day, isTarget }) => (
                    <TableRow
                      key={day.date}
                      className={cn(isTarget && "bg-primary/5 font-semibold")}
                    >
                      <TableCell>
                        <Link
                          href={`/analyse-jour?date=${day.date}&compare=${compare}&count=${count}`}
                          className="capitalize hover:underline"
                        >
                          {dayLabel(day.date)}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {day.totals.visits}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {day.totals.uniqueVisitors}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {(day.totals.revenueVisits ?? 0).toFixed(1)} DT
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {(day.totals.revenueAbonnements ?? 0).toFixed(1)} DT
                        {day.totals.abonnementsPaid ? (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({day.totals.abonnementsPaid})
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {day.totals.revenue.toFixed(1)} DT
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {day.totals.avgDurationMin} min
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {day.totals.peakPresent > 0
                          ? `${day.totals.peakPresent} à ${hourLabel(day.totals.peakHour)}`
                          : "—"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          day.totals.leftUnpaid > 0 && "text-orange-700"
                        )}
                      >
                        {day.totals.leftUnpaid}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
