"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { analyticsApi } from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import {
  WEEKDAY_SHORT,
  decimalHourLabel,
  memberName,
} from "@/lib/traffic-utils";

const PERIODS = [30, 90] as const;

export function FinanceRegulars() {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const range = useMemo(() => {
    const to = new Date();
    return {
      from: format(subDays(to, days - 1), "yyyy-MM-dd"),
      to: format(to, "yyyy-MM-dd"),
    };
  }, [days]);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.analyticsRegulars(range.from, range.to),
    queryFn: () => analyticsApi.regulars({ ...range, limit: 10 }),
  });
  const regulars = data?.regulars ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base">Membres les plus réguliers</CardTitle>
        <div className="inline-flex rounded-full border p-0.5 text-xs">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setDays(p)}
              className={cn(
                "rounded-full px-2.5 py-0.5 font-medium",
                days === p
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p} j
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Membre</TableHead>
                <TableHead className="text-right">Jours</TableHead>
                <TableHead className="text-right">/ sem.</TableHead>
                <TableHead className="text-right">Heures</TableHead>
                <TableHead>Habitudes</TableHead>
                <TableHead className="text-right">Dernière visite</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {regulars.map((r, i) => (
                <TableRow key={r.member.id}>
                  <TableCell className="font-semibold text-muted-foreground">
                    {i + 1}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate font-medium">
                    {memberName(r.member)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.visitDays}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.daysPerWeek}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.totalHours} h
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.usualWeekdays.map((d) => WEEKDAY_SHORT[d]).join(", ")}
                    {" · vers "}
                    {decimalHourLabel(r.avgArrivalHour)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {format(new Date(r.lastVisit), "d MMM", { locale: fr })}
                  </TableCell>
                </TableRow>
              ))}
              {!regulars.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">
                    Aucune visite membre sur la période
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
