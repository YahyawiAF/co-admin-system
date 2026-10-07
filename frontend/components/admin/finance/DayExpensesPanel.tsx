"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  caisseApi,
  dailyExpensesApi,
  expensesApi,
} from "@/lib/api/resources";

/** Expenses of one day: pick catalogue lines, add, remove. Works for past / closed days too. */
export function DayExpensesPanel({
  date,
  className,
}: {
  /** yyyy-MM-dd */
  date: string;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [note, setNote] = useState("");

  const { data: summary } = useQuery({
    queryKey: ["caisse-summary", date],
    queryFn: () => caisseApi.summary(date),
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => expensesApi.list(),
  });

  const expenseList = Array.isArray(expenses) ? expenses : [];
  const dailyCatalog = expenseList.filter((e) => e.type === "JOURNALIER");
  const monthlyCatalog = expenseList.filter((e) => e.type === "MENSUEL");
  const dayExpenses = summary?.dailyExpenses || [];
  const dayExpenseTotal = dayExpenses.reduce(
    (s, de) => s + (de.expense?.amount || 0),
    0,
  );
  const isClosed = !!summary?.session?.closedAt;
  const drift = summary?.driftSinceClose ?? 0;
  const selectedTotal = useMemo(
    () =>
      selectedIds.reduce((s, id) => {
        const e = expenseList.find((x) => x.id === id);
        return s + (e?.amount || 0);
      }, 0),
    [selectedIds, expenseList],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["caisse-summary"] });
    queryClient.invalidateQueries({ queryKey: ["caisse-month"] });
    queryClient.invalidateQueries({ queryKey: ["analytics-finance-days"] });
    queryClient.invalidateQueries({ queryKey: ["analytics-finance-year"] });
  };

  const add = useMutation({
    mutationFn: async () => {
      if (!selectedIds.length) throw new Error("Choisissez au moins une dépense");
      const summaryNote = note.trim() || undefined;
      await Promise.all(
        selectedIds.map((id) =>
          dailyExpensesApi.create({ expenseId: id, date, Summary: summaryNote }),
        ),
      );
      return selectedIds.length;
    },
    onSuccess: (n) => {
      toast.success(
        n === 1 ? "Dépense enregistrée" : `${n} dépenses enregistrées pour ce jour`,
      );
      setSelectedIds([]);
      setNote("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => dailyExpensesApi.remove(id),
    onSuccess: () => {
      toast.success("Dépense retirée du jour");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">Dépenses du jour</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {format(new Date(date + "T12:00:00"), "EEEE d MMMM yyyy", {
                locale: fr,
              })}{" "}
              — cochez une ou plusieurs lignes du catalogue, puis ajoutez.
            </p>
          </div>
          <Badge variant="secondary" className="text-sm">
            Total jour {dayExpenseTotal.toFixed(1)} DT
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isClosed ? (
          <Alert>
            <AlertDescription className="text-sm">
              Caisse clôturée pour ce jour.
              {Math.abs(drift) > 0.009 ? (
                <span className="font-semibold text-amber-700">
                  {" "}
                  L&apos;attendu a changé de {drift > 0 ? "+" : ""}
                  {drift.toFixed(1)} DT depuis la clôture.
                </span>
              ) : (
                " Les ajouts modifient l'attendu par rapport à la clôture."
              )}
            </AlertDescription>
          </Alert>
        ) : null}

        {!expenseList.length ? (
          <Alert>
            <AlertDescription>
              Aucun modèle de dépense. Créez-en dans Finance, onglet{" "}
              <strong>Dépenses</strong> (ex. Café, Loyer, Eau).
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  { title: "Journalières", list: dailyCatalog },
                  { title: "Mensuelles", list: monthlyCatalog },
                ] as const
              ).map((group) => (
                <div key={group.title} className="rounded-lg border bg-muted/20 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.title}
                  </p>
                  {group.list.length ? (
                    <ul className="space-y-1.5">
                      {group.list.map((e) => {
                        const checked = selectedIds.includes(e.id);
                        return (
                          <li key={e.id}>
                            <label
                              className={cn(
                                "flex cursor-pointer items-center gap-2.5 rounded-md border px-2.5 py-2 text-sm transition-colors",
                                checked
                                  ? "border-primary/40 bg-primary/5"
                                  : "border-transparent bg-background hover:bg-muted/60",
                              )}
                            >
                              <Checkbox checked={checked} onCheckedChange={() => toggle(e.id)} />
                              <span className="min-w-0 flex-1 font-medium">{e.name}</span>
                              <span className="shrink-0 tabular-nums text-muted-foreground">
                                {e.amount} DT
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">Aucune</p>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`expense-note-${date}`}>Note (optionnel)</Label>
              <Input
                id={`expense-note-${date}`}
                placeholder="Ex. facture électricité, courses…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed p-3">
              <p className="text-sm text-muted-foreground">
                {selectedIds.length === 0
                  ? "Aucune sélection"
                  : selectedIds.length === 1
                    ? "1 dépense · "
                    : `${selectedIds.length} dépenses · `}
                {selectedIds.length > 0 ? (
                  <span className="font-semibold text-foreground">
                    {selectedTotal.toFixed(1)} DT
                  </span>
                ) : null}
              </p>
              <Button
                disabled={!selectedIds.length || add.isPending}
                onClick={() => add.mutate()}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Ajouter au jour
              </Button>
            </div>
          </>
        )}

        <div className="space-y-2 border-t pt-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Enregistrées ce jour</p>
            <span className="text-xs text-muted-foreground">
              {dayExpenses.length} ligne{dayExpenses.length !== 1 ? "s" : ""}
            </span>
          </div>
          {dayExpenses.length ? (
            <ul className="divide-y rounded-lg border">
              {dayExpenses.map((de) => (
                <li key={de.id} className="flex items-center gap-2 px-3 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{de.expense?.name || "Dépense"}</p>
                    <p className="text-xs text-muted-foreground">
                      {de.expense?.type === "MENSUEL" ? "Mensuel" : "Journalier"}
                      {de.Summary ? ` · ${de.Summary}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 tabular-nums font-medium text-destructive">
                    −{(de.expense?.amount || 0).toFixed(1)} DT
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 text-destructive"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(de.id)}
                    title="Retirer du jour"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              Aucune dépense sur cette date. Cochez ci-dessus pour en ajouter
              plusieurs d&apos;un coup.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
