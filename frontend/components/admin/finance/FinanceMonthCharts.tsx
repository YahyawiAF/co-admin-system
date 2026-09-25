"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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
        Net: Math.round(d.net * 10) / 10,
      })),
    [daysData],
  );

  const mixChart = useMemo(() => {
    if (!monthData) return [];
    return [
      { name: "Journal", value: monthData.revenueJournal },
      { name: "Abonnements", value: monthData.revenueAbonnements },
      { name: "Produits", value: monthData.revenueProducts },
    ].filter((r) => r.value > 0);
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
            Jours du mois — mix revenus
          </CardTitle>
        </CardHeader>
        <CardContent className="h-64 pt-2">
          {dayChart.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dayChart}>
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
              </BarChart>
            </ResponsiveContainer>
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
                  width={90}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip formatter={(v: number) => fmtDt(v)} />
                <Bar dataKey="value" name="CA" fill="hsl(var(--primary))" radius={4} />
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
