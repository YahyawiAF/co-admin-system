"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarRange, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ListPager, usePaged } from "@/components/ui/list-pager";
import { cn } from "@/lib/utils";
import { dailyExpensesApi, type DailyExpense, type ExpenseMonthOverview } from "@/lib/api/resources";
import { EXPENSE_SOURCE_LABEL, dt, invalidateMoney } from "@/lib/finance-queries";
import { InfoButton, InfoCalc } from "./InfoModal";

const shiftMonth = (key: string, by: number) => format(new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1 + by, 1), "yyyy-MM");
const monthName = (key: string) => format(new Date(`${key}-15T12:00:00`), "MMMM yyyy", { locale: fr });
const monthShort = (key: string) => format(new Date(`${key}-15T12:00:00`), "MMM yy", { locale: fr });
const pill = "inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold";

type Row = DailyExpense & { group: "fixe" | "jour" };

/** Every expense that counts in the month, filterable, with « pour quel mois » editable on each line. */
export function ExpenseMonthList({ data, monthKey }: { data: ExpenseMonthOverview; monthKey: string }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");

  const rows = useMemo<Row[]>(() => {
    const fixed = [...data.recurring.flatMap((c) => c.payments), ...data.oneOff].map((r) => ({ ...r, group: "fixe" as const }));
    const daily = data.daily.rows.map((r) => ({ ...r, group: "jour" as const }));
    return [...fixed, ...daily].sort((a, b) => (b.date ?? b.createdAt).localeCompare(a.date ?? a.createdAt));
  }, [data]);
  const cats = useMemo(() => [...new Map(rows.map((r) => [r.category ?? "AUTRE", r.categoryLabel ?? "Autre"])).entries()], [rows]);
  const shown = rows.filter((r) => filter === "all" || r.group === filter || r.category === filter);
  const paged = usePaged(shown, 20, filter);

  const retag = useMutation({
    mutationFn: ({ id, forMonth, spreadMonths }: { id: string; forMonth: string; spreadMonths: number }) =>
      dailyExpensesApi.update(id, { forMonth, spreadMonths }),
    onSuccess: (_r, v) => {
      toast.success(v.spreadMonths > 1 ? `Réparti sur ${v.spreadMonths} mois` : `Compte maintenant pour ${monthName(v.forMonth)}`);
      invalidateMoney(qc);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => dailyExpensesApi.remove(id),
    onSuccess: () => {
      toast.success("Supprimé");
      invalidateMoney(qc);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const chip = (k: string, label: string) => (
    <button
      key={k}
      type="button"
      onClick={() => setFilter(k)}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-200",
        filter === k ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted/60",
      )}
    >
      {label}
    </button>
  );

  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Toutes les dépenses de {monthName(monthKey)}</CardTitle>
            <InfoButton title="Pour quel mois une dépense compte">
              <p>Chaque dépense compte dans <b>le mois pour lequel elle est</b>, pas le jour où elle est payée.</p>
              <InfoCalc>
                Loyer d’octobre payé le 4 novembre → bénéfice d’octobre −2 000
                <br />
                Novembre ne bouge pas, même si l’argent est sorti en novembre
              </InfoCalc>
              <p>« Répartir » divise une grosse dépense (matériel, réparation) sur plusieurs mois : 600 DT sur 6 mois = 100 DT par mois.</p>
              <p>L’argent, lui, sort le jour du paiement : la caisse, le coffre et la banque le voient ce jour-là (onglet Argent).</p>
            </InfoButton>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Mal classée ? « ⋯ » → changez son mois.</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {chip("all", "Tout")}
          {chip("fixe", "Charges fixes")}
          {chip("jour", "Achats du jour")}
          {cats.map(([k, label]) => chip(k, label))}
        </div>
        {shown.length ? (
          <div className="text-sm">
            {paged.pageItems.map((r) => {
              const paid = r.paidAmount ?? r.amount;
              const d = r.date ?? r.createdAt;
              return (
                <div key={`${r.id}-${r.group}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b py-2.5 animate-in fade-in-0 duration-200 motion-reduce:animate-none last:border-0">
                  <span className="w-14 shrink-0 tabular-nums text-muted-foreground">{format(new Date(d), "dd/MM")}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate font-medium">{r.label}</span>
                      {r.categoryLabel ? <span className={cn(pill, "bg-muted text-muted-foreground")}>{r.categoryLabel}</span> : null}
                      {r.otherMonth && r.months?.length ? (
                        <span className={cn(pill, "bg-sky-100 text-sky-800")}>
                          {r.months.length > 1 ? `${monthShort(r.months[0])} → ${monthShort(r.months[r.months.length - 1])}` : `pour ${monthName(r.months[0])}`}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.group === "fixe" ? "Charge" : "Achat du jour"} · {EXPENSE_SOURCE_LABEL[r.source]}
                    </div>
                  </div>
                  <span className="text-right font-semibold tabular-nums text-rose-600">
                    −{dt(r.amount, 2)}
                    {paid > r.amount + 0.01 ? <span className="block text-[11px] font-normal text-muted-foreground">sur {dt(paid, 2)} payés</span> : null}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Actions">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {[-1, 0, 1].map((by) => {
                        const k = shiftMonth(monthKey, by);
                        return (
                          <DropdownMenuItem key={k} onClick={() => retag.mutate({ id: r.id, forMonth: k, spreadMonths: 1 })}>
                            <CalendarRange className="mr-2 h-4 w-4" />
                            Pour {monthName(k)}
                          </DropdownMenuItem>
                        );
                      })}
                      {[6, 12].map((n) => (
                        <DropdownMenuItem key={n} onClick={() => retag.mutate({ id: r.id, forMonth: r.months?.[0] ?? monthKey, spreadMonths: n })}>
                          <CalendarRange className="mr-2 h-4 w-4" />
                          Répartir sur {n} mois
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => remove.mutate(r.id)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
            <ListPager page={paged.page} lastPage={paged.lastPage} total={paged.total} onPage={paged.setPage} className="px-0" />
          </div>
        ) : (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Aucune dépense ici.</p>
        )}

        {data.paidForOther?.length ? (
          <div className="rounded-xl bg-sky-50 p-3 text-sm dark:bg-sky-950/30">
            <div className="mb-1 font-semibold text-sky-900 dark:text-sky-200">
              Payé ce mois pour un autre mois · {dt(data.totals.paidForOtherMonths ?? 0)}
            </div>
            <p className="mb-2 text-xs text-sky-900/80 dark:text-sky-200/80">L’argent est sorti ce mois, mais ne compte pas dans son bénéfice.</p>
            {data.paidForOther.map((p) => (
              <div key={p.id} className="flex justify-between gap-2 py-0.5 tabular-nums">
                <span className="truncate">
                  {format(new Date(`${p.date}T12:00:00`), "dd/MM")} · {p.label} ·{" "}
                  {p.months.length > 1 ? `${p.months.length} mois` : `pour ${monthName(p.months[0])}`}
                </span>
                <span className="font-medium">{dt(p.amount, 2)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
