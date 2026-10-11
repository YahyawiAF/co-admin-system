"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { Coffee, Lightbulb } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { analyticsApi } from "@/lib/api/resources";
import { cn } from "@/lib/utils";

type Props = {
  year: number;
  month: number;
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function FinanceProductsInsight({ year, month }: Props) {
  const range = useMemo(() => {
    const start = startOfMonth(new Date(year, month - 1, 1));
    return {
      from: format(start, "yyyy-MM-dd"),
      to: format(endOfMonth(start), "yyyy-MM-dd"),
    };
  }, [year, month]);

  const { data } = useQuery({
    queryKey: ["analytics-products", range.from, range.to],
    queryFn: () => analyticsApi.productsPerformance(range.from, range.to),
  });

  const hourChart = useMemo(() => {
    const rows = data?.revenueByHour || [];
    const active = rows.filter((r) => r.revenue > 0);
    if (!active.length) return [];
    const first = Math.min(...active.map((r) => r.hour));
    const last = Math.max(...active.map((r) => r.hour));
    return rows
      .filter((r) => r.hour >= first && r.hour <= last)
      .map((r) => ({ name: `${r.hour}h`, revenue: r.revenue }));
  }, [data?.revenueByHour]);

  if (!data) return null;
  const t = data.totals;
  const top = data.products.slice(0, 10);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Coffee className="h-4 w-4 text-primary" />
          Café &amp; produits : marge
        </CardTitle>
        <Link href="/products" className="text-xs text-primary hover:underline">
          Gérer les produits
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Stat label="Ventes" value={`${t.revenue.toFixed(1)} DT`} hint={`${t.quantity} articles`} />
          <Stat
            label="Marge brute"
            value={`${t.margin.toFixed(1)} DT`}
            hint={t.marginPct != null ? `${t.marginPct} % des ventes` : undefined}
          />
          <Stat
            label="Visites avec achat"
            value={t.attachRate != null ? `${t.attachRate} %` : "—"}
            hint={`${t.visits} visites suivies`}
          />
          <Stat
            label="Panier moyen"
            value={t.avgBasket != null ? `${t.avgBasket.toFixed(1)} DT` : "—"}
            hint="par visite avec achat"
          />
        </div>

        {data.tips.length ? (
          <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
            {data.tips.map((tip) => (
              <p key={tip} className="flex gap-2 text-sm text-amber-900">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
                {tip}
              </p>
            ))}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,320px)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead className="text-right">Qté</TableHead>
                <TableHead className="text-right">Ventes</TableHead>
                <TableHead className="text-right">Marge</TableHead>
                <TableHead className="text-right">Stock</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {top.map((p) => (
                <TableRow key={p.productId}>
                  <TableCell className="max-w-[160px] truncate font-medium">{p.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.quantity}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.revenue.toFixed(1)} DT</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.margin.toFixed(1)} DT
                    {p.marginPct != null ? (
                      <Badge
                        variant="secondary"
                        className={cn(
                          "ml-1.5 text-[10px]",
                          p.marginPct < 30
                            ? "bg-red-100 text-red-700"
                            : p.marginPct >= 60
                              ? "bg-emerald-100 text-emerald-700"
                              : ""
                        )}
                      >
                        {p.marginPct} %
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      p.stock != null && p.stock <= 5 && "font-medium text-red-600"
                    )}
                  >
                    {p.stock ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
              {!top.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    Aucune vente ce mois
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Ventes par heure</p>
            <div className="h-48">
              {hourChart.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourChart}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} width={32} />
                    <Tooltip formatter={(v: number) => `${v} DT`} />
                    <Bar dataKey="revenue" name="Ventes" fill="hsl(28 80% 52%)" radius={3} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground">Pas encore de ventes</p>
              )}
            </div>
            {data.dormant.length ? (
              <p className="text-[11px] text-muted-foreground">
                Sans vente ce mois :{" "}
                {data.dormant
                  .slice(0, 5)
                  .map((d) => `${d.name} (${d.stock})`)
                  .join(", ")}
                {data.dormant.length > 5 ? "…" : ""}
              </p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
