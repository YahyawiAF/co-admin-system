"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { caisseApi } from "@/lib/api/resources";
import { dt } from "@/lib/finance-queries";
import { FinanceMonthCharts } from "@/components/admin/finance/FinanceMonthCharts";
import { FinanceServicesInsight } from "@/components/admin/finance/FinanceServicesInsight";
import { FinanceProductsInsight } from "@/components/admin/finance/FinanceProductsInsight";
import { FinanceWeeklyTraffic } from "@/components/admin/finance/FinanceWeeklyTraffic";
import { FinanceRegulars } from "@/components/admin/finance/FinanceRegulars";
import { FinanceTopPoints } from "@/components/admin/finance/FinanceTopPoints";
import { FinanceOverview } from "@/components/admin/finance/FinanceOverview";
import { FinanceDayAnalysis } from "@/components/admin/finance/FinanceDayAnalysis";
import { FinanceCaisseTab } from "@/components/admin/finance/FinanceCaisseTab";
import { FinanceExpensesTab } from "@/components/admin/finance/FinanceExpensesTab";
import { FinanceCoffreTab } from "@/components/admin/finance/FinanceCoffreTab";

const FINANCE_TABS = [
  "apercu",
  "caisse",
  "depenses",
  "coffre",
  "jour",
  "mois",
  "frequentation",
] as const;
type FinanceTab = (typeof FINANCE_TABS)[number];

export default function FinancePage() {
  return (
    <Suspense fallback={<div className="text-muted-foreground">Chargement…</div>}>
      <FinanceInner />
    </Suspense>
  );
}

function FinanceInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: FinanceTab = FINANCE_TABS.includes(tabParam as FinanceTab)
    ? (tabParam as FinanceTab)
    : "apercu";
  const setTab = (next: string, query = "") => {
    router.replace(
      next === "apercu" && !query ? "/finance" : `/finance?tab=${next}${query}`,
      { scroll: false },
    );
  };
  const [monthKey, setMonthKey] = useState(format(new Date(), "yyyy-MM"));
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));

  const { data: monthData } = useQuery({
    queryKey: ["caisse-month", year, month],
    queryFn: () => caisseApi.month(year, month),
    enabled: tab === "mois",
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
        <p className="text-muted-foreground">
          Performance de l&apos;espace, caisse du jour, dépenses et coffre
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v)}>
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="apercu">Vue d&apos;ensemble</TabsTrigger>
          <TabsTrigger value="caisse">Caisse</TabsTrigger>
          <TabsTrigger value="depenses">Dépenses</TabsTrigger>
          <TabsTrigger value="coffre">Coffre</TabsTrigger>
          <TabsTrigger value="jour">Jour</TabsTrigger>
          <TabsTrigger value="mois">Mois</TabsTrigger>
          <TabsTrigger value="frequentation">Fréquentation</TabsTrigger>
        </TabsList>

        <TabsContent value="apercu" className="mt-4">
          <FinanceOverview monthKey={monthKey} onMonthChange={setMonthKey} />
        </TabsContent>

        <TabsContent value="caisse" className="mt-4">
          {tab === "caisse" ? (
            <FinanceCaisseTab initialDate={searchParams.get("date")} />
          ) : null}
        </TabsContent>

        <TabsContent value="depenses" className="mt-4">
          {tab === "depenses" ? (
            <FinanceExpensesTab monthKey={monthKey} onMonthChange={setMonthKey} />
          ) : null}
        </TabsContent>

        <TabsContent value="coffre" className="mt-4">
          {tab === "coffre" ? <FinanceCoffreTab /> : null}
        </TabsContent>

        <TabsContent value="jour" className="mt-4">
          {tab === "jour" ? <FinanceDayAnalysis /> : null}
        </TabsContent>

        <TabsContent value="mois" className="mt-4 space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Label>Période</Label>
            <Input
              type="month"
              className="w-auto"
              value={monthKey}
              onChange={(e) => e.target.value && setMonthKey(e.target.value)}
            />
          </div>

          {monthData ? (
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
              {[
                {
                  label: "Brut (CA)",
                  value:
                    monthData.revenueJournal +
                    monthData.revenueAbonnements +
                    monthData.revenueProducts,
                  hint: "Tout l'encaissé du mois",
                },
                { label: "Journal", value: monthData.revenueJournal },
                { label: "Abonnements", value: monthData.revenueAbonnements },
                { label: "Produits", value: monthData.revenueProducts },
                {
                  label: "Dépenses",
                  value: monthData.expenses,
                  hint: "Ce que vous avez dépensé",
                },
                {
                  label: "Net",
                  value: monthData.net,
                  hint: "Brut − dépenses",
                },
              ].map((k) => (
                <Card key={k.label} className="shadow-none">
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-xs font-medium text-muted-foreground">
                      {k.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div
                      className={cn(
                        "text-lg font-semibold",
                        k.label === "Net" &&
                          Number(k.value) < 0 &&
                          "text-rose-600",
                        k.label === "Brut (CA)" && "text-emerald-700",
                      )}
                    >
                      {Number(k.value).toFixed(1)} DT
                    </div>
                    {"hint" in k && k.hint ? (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {k.hint}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}

          <FinanceMonthCharts year={year} month={month} monthData={monthData} />
          <FinanceServicesInsight year={year} month={month} />
          <FinanceProductsInsight year={year} month={month} />

          {monthData ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Clôtures de caisse du mois</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Jour</TableHead>
                      <TableHead>État</TableHead>
                      <TableHead>Attendu</TableHead>
                      <TableHead>Compté</TableHead>
                      <TableHead>Écart</TableHead>
                      <TableHead>Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthData.sessions.map((s) => (
                      <TableRow
                        key={s.dateKey}
                        className="cursor-pointer"
                        onClick={() => setTab("caisse", `&date=${s.dateKey}`)}
                      >
                        <TableCell className="capitalize">
                          {format(new Date(`${s.dateKey}T12:00:00`), "EEE d MMM", {
                            locale: fr,
                          })}
                        </TableCell>
                        <TableCell>
                          {s.closedAt ? (
                            "Clôturée"
                          ) : (
                            <span className="font-medium text-amber-700">À clôturer</span>
                          )}
                        </TableCell>
                        <TableCell>{s.expectedClose != null ? dt(s.expectedClose) : "—"}</TableCell>
                        <TableCell>{s.countedClose != null ? dt(s.countedClose) : "—"}</TableCell>
                        <TableCell
                          className={cn(
                            s.difference != null &&
                              Math.abs(s.difference) >= 0.5 &&
                              (s.difference < 0 ? "text-rose-600" : "text-amber-600"),
                          )}
                        >
                          {s.difference != null ? dt(s.difference) : "—"}
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate text-muted-foreground">
                          {s.notes || ""}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!monthData.sessions.length ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-muted-foreground">
                          Aucune journée de caisse ce mois
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          )}
        </TabsContent>

        <TabsContent value="frequentation" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setTab("jour")}>
              Analyser un jour en détail
            </Button>
          </div>
          <FinanceWeeklyTraffic />
          <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
            <FinanceRegulars />
            <FinanceTopPoints />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
