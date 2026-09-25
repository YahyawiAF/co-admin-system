"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { analyticsApi } from "@/lib/api/resources";
import type { MonthFinanceSummary } from "@/lib/types";

const MONTH_LABELS = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Juin",
  "Juil",
  "Aoû",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
];

function fmtDt(n: number) {
  return `${Number(n || 0).toFixed(1)} DT`;
}

type Props = {
  year: number;
  month: number;
  monthData?: MonthFinanceSummary | null;
};

export function FinanceMonthCharts({ year, month, monthData }: Props) {
  const { data: yearData } = useQuery({
    queryKey: ["analytics-finance-year", year],
    queryFn: () => analyticsApi.financeMonthly(year),
  });
  const { data: daysData } = useQuery({
    queryKey: ["analytics-finance-days", year, month],
    queryFn: () => analyticsApi.financeMonthDays(year, month),
  });

  const yearChart = useMemo(
    () =>
      (yearData?.months || []).map((m) => ({
        label: MONTH_LABELS[m.month - 1] || String(m.month),
        Journal: Math.round(m.revenueJournal * 10) / 10,
        Abonnements: Math.round(m.revenueAbonnements * 10) / 10,
        Produits: Math.round(m.revenueProducts * 10) / 10,
        Dépenses: Math.round(m.expenses * 10) / 10,
        Net: Math.round(m.net * 10) / 10,
      })),
    [yearData],
  );

  const dayChart = useMemo(
    () =>
      (daysData?.days || []).map((d) => ({
        label: d.date.slice(8, 10),
        Journal: Math.round(d.revenueJournal * 10) / 10,
        Abonnements: Math.round(d.revenueAbonnements * 10) / 10,
        Produits: Math.round(d.revenueProducts * 10) / 10,
        Dépenses: Math.round(d.expenses * 10) / 10,
        Total: Math.round(d.net * 10) / 10,
      })),
    [daysData],
  );

  const dayTotals = useMemo(() => {
    const days = daysData?.days || [];
    return days.reduce(
      (acc, d) => ({
        Journal: acc.Journal + (d.revenueJournal || 0),
        Abonnements: acc.Abonnements + (d.revenueAbonnements || 0),
        Produits: acc.Produits + (d.revenueProducts || 0),
        Dépenses: acc.Dépenses + (d.expenses || 0),
        Total: acc.Total + (d.net || 0),
      }),
      { Journal: 0, Abonnements: 0, Produits: 0, Dépenses: 0, Total: 0 },
    );
  }, [daysData]);

  const mixChart = useMemo(() => {
    if (!monthData) return [];
    return [
      { name: "Journal", value: monthData.revenueJournal },
      { name: "Abonnements", value: monthData.revenueAbonnements },
      { name: "Produits", value: monthData.revenueProducts },
      { name: "Dépenses", value: monthData.expenses },
      { name: "Total (net)", value: monthData.net },
    ].filter((r) => Math.abs(r.value) > 0);
  }, [monthData]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Année {year} — revenus, dépenses et net
          </CardTitle>
        </CardHeader>
        <CardContent className="h-72 pt-2">
          {yearChart.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={yearChart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} width={48} />
                <Tooltip formatter={(v: number) => fmtDt(v)} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="Net"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary) / 0.2)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="Dépenses"
                  stroke="hsl(var(--destructive))"
                  fill="hsl(var(--destructive) / 0.12)"
                  strokeWidth={1.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune donnée annuelle</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Jours du mois — mix revenus, dépenses et total
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          {dayChart.length ? (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={dayChart}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={40} />
                    <Tooltip formatter={(v: number) => fmtDt(v)} />
                    <Legend />
                    <Bar dataKey="Journal" stackId="a" fill="hsl(210 70% 50%)" />
                    <Bar
                      dataKey="Abonnements"
                      stackId="a"
                      fill="hsl(160 50% 40%)"
                    />
                    <Bar dataKey="Produits" stackId="a" fill="hsl(35 80% 50%)" />
                    <Bar
                      dataKey="Dépenses"
                      fill="hsl(var(--destructive))"
                      radius={[2, 2, 0, 0]}
                    />
                    <Line
                      type="monotone"
                      dataKey="Total"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t pt-2 text-xs text-muted-foreground">
                <span>Journal {fmtDt(dayTotals.Journal)}</span>
                <span>Abo {fmtDt(dayTotals.Abonnements)}</span>
                <span>Produits {fmtDt(dayTotals.Produits)}</span>
                <span className="text-destructive">
                  Dépenses {fmtDt(dayTotals.Dépenses)}
                </span>
                <span className="font-medium text-foreground">
                  Total {fmtDt(dayTotals.Total)}
                </span>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucune vente ce mois
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Répartition du mois</CardTitle>
        </CardHeader>
        <CardContent className="h-64 pt-2">
          {mixChart.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mixChart} layout="vertical" margin={{ left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip formatter={(v: number) => fmtDt(v)} />
                <Bar dataKey="value" name="Montant" fill="hsl(var(--primary))" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun CA ce mois</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
