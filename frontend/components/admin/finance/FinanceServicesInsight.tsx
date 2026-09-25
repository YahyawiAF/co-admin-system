"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { endOfMonth, format, startOfMonth } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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

type Props = {
  year: number;
  month: number;
};

export function FinanceServicesInsight({ year, month }: Props) {
  const range = useMemo(() => {
    const start = startOfMonth(new Date(year, month - 1, 1));
    const end = endOfMonth(start);
    return {
      from: format(start, "yyyy-MM-dd"),
      to: format(end, "yyyy-MM-dd"),
    };
  }, [year, month]);

  const { data: servicesData } = useQuery({
    queryKey: ["analytics-services", range.from, range.to],
    queryFn: () => analyticsApi.servicesDemand(range.from, range.to),
  });
  const { data: spacesData } = useQuery({
    queryKey: ["analytics-spaces", range.from, range.to],
    queryFn: () => analyticsApi.spacesUsage(range.from, range.to),
  });

  const topServices = (servicesData?.services || []).slice(0, 8);
  const topSpaces = (spacesData?.spaces || []).slice(0, 8);

  const serviceChart = topServices.map((s) => ({
    name: s.name.length > 18 ? `${s.name.slice(0, 16)}…` : s.name,
    full: s.name,
    count: s.count,
    revenue: Math.round(s.revenue * 10) / 10,
  }));

  const spaceChart = topSpaces.map((s) => ({
    name: s.name.length > 18 ? `${s.name.slice(0, 16)}…` : s.name,
    full: s.name,
    count: s.count,
    hours: s.hours,
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Services les plus demandés</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-52">
            {serviceChart.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serviceChart} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(v: number, name: string) =>
                      name === "revenue" ? `${v} DT` : v
                    }
                    labelFormatter={(_, payload) =>
                      (payload?.[0]?.payload as { full?: string })?.full || ""
                    }
                  />
                  <Bar dataKey="count" name="Usages" fill="hsl(210 70% 48%)" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun usage ce mois</p>
            )}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead className="text-right">Usages</TableHead>
                <TableHead className="text-right">CA</TableHead>
                <TableHead className="text-right">Clients</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topServices.map((s) => (
                <TableRow key={s.priceId || s.name}>
                  <TableCell className="max-w-[140px] truncate font-medium">
                    {s.name}
                  </TableCell>
                  <TableCell className="text-right">{s.count}</TableCell>
                  <TableCell className="text-right">
                    {s.revenue.toFixed(1)} DT
                  </TableCell>
                  <TableCell className="text-right">{s.uniqueClients}</TableCell>
                </TableRow>
              ))}
              {!topServices.length ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    Aucun service
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Espaces les plus fréquentés</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-52">
            {spaceChart.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={spaceChart} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    labelFormatter={(_, payload) =>
                      (payload?.[0]?.payload as { full?: string })?.full || ""
                    }
                  />
                  <Bar dataKey="count" name="Visites" fill="hsl(160 45% 40%)" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aucun espace renseigné — les nouvelles visites enregistrent
                l&apos;espace automatiquement.
              </p>
            )}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Espace</TableHead>
                <TableHead className="text-right">Usages</TableHead>
                <TableHead className="text-right">Heures</TableHead>
                <TableHead className="text-right">Clients</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topSpaces.map((s) => (
                <TableRow key={s.spaceId || s.name}>
                  <TableCell className="max-w-[140px] truncate font-medium">
                    {s.name}
                  </TableCell>
                  <TableCell className="text-right">{s.count}</TableCell>
                  <TableCell className="text-right">{s.hours} h</TableCell>
                  <TableCell className="text-right">{s.uniqueClients}</TableCell>
                </TableRow>
              ))}
              {!topSpaces.length ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    Aucun espace
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
