"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isToday } from "date-fns";
import { fr } from "date-fns/locale";
import { Receipt, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  dailyExpensesApi,
  type ExpenseSource,
} from "@/lib/api/resources";
import { EXPENSE_SOURCE_LABEL, dt, invalidateMoney } from "@/lib/finance-queries";

const STEPS = [0.5, 1, 2, 5, 10, 20, 50];

const SOURCES: Array<{ id: ExpenseSource; label: string; hint: string }> = [
  { id: "CAISSE", label: "Caisse", hint: "espèces du tiroir" },
  { id: "COFFRE", label: "Coffre", hint: "sort du coffre" },
  { id: "AUTRE", label: "Banque / autre", hint: "carte, virement…" },
];

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Add one-off expenses for a day: build the amount with +1/+2/+5…, write what it was, done. */
export function QuickExpenseDialog({
  open,
  onOpenChange,
  date,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** yyyy-MM-dd */
  date: string;
}) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [source, setSource] = useState<ExpenseSource>("CAISSE");
  const labelRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setLabel("");
    setSource("CAISSE");
  }, [open]);

  const { data: dayRows = [] } = useQuery({
    queryKey: ["expenses-day", date],
    queryFn: () => dailyExpensesApi.list(date),
    enabled: open,
  });
  const { data: suggestions = [] } = useQuery({
    queryKey: ["expense-suggestions"],
    queryFn: () => dailyExpensesApi.suggestions(),
    enabled: open,
    staleTime: 60_000,
  });

  const value = Number(amount.replace(",", "."));
  const valid = Number.isFinite(value) && value > 0 && label.trim().length > 0;
  const dayTotal = dayRows.reduce((a, r) => a + r.amount, 0);
  const day = new Date(`${date}T12:00:00`);

  const add = useMutation({
    mutationFn: () =>
      dailyExpensesApi.create({
        amount: round2(value),
        label: label.trim(),
        date,
        source,
        kind: "JOURNALIER",
      }),
    onSuccess: (row) => {
      toast.success(`${row.label} · −${dt(row.amount)}`);
      setAmount("");
      setLabel("");
      invalidateMoney(queryClient);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => dailyExpensesApi.remove(id),
    onSuccess: () => invalidateMoney(queryClient),
    onError: (e: Error) => toast.error(e.message),
  });

  const bump = (step: number) => {
    const base = Number.isFinite(value) ? value : 0;
    setAmount(String(round2(base + step)));
  };

  const submit = () => {
    if (!valid) {
      if (!(value > 0)) toast.error("Indiquez le montant");
      else labelRef.current?.focus();
      return;
    }
    add.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-rose-500" />
            Nouvelle dépense
          </DialogTitle>
          <DialogDescription className="capitalize">
            {isToday(day) ? "Aujourd'hui · " : ""}
            {format(day, "EEEE d MMMM", { locale: fr })}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="quick-expense-amount">Montant</Label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  id="quick-expense-amount"
                  inputMode="decimal"
                  autoFocus
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
                  className="h-14 pr-12 text-3xl font-semibold tabular-nums"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  DT
                </span>
              </div>
              {amount ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-14 w-10"
                  title="Remettre à zéro"
                  onClick={() => setAmount("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STEPS.map((s) => (
                <Button
                  key={s}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 min-w-12 rounded-full tabular-nums"
                  onClick={() => bump(s)}
                >
                  +{String(s).replace(".", ",")}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quick-expense-label">C&apos;était pour quoi ?</Label>
            <Input
              id="quick-expense-label"
              ref={labelRef}
              placeholder="Ex. café, eau, produits ménage, réparation…"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={120}
            />
            {suggestions.length ? (
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                    onClick={() => {
                      setLabel(s.label);
                      if (!(value > 0)) setAmount(String(s.lastAmount));
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Payé avec</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {SOURCES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSource(s.id)}
                  className={cn(
                    "rounded-lg border px-2 py-2 text-left transition-colors",
                    source === s.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "hover:bg-muted/60",
                  )}
                >
                  <div className="text-sm font-medium">{s.label}</div>
                  <div className="text-[11px] text-muted-foreground">{s.hint}</div>
                </button>
              ))}
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={add.isPending}>
            {value > 0 ? `Ajouter −${dt(value, 2)}` : "Ajouter la dépense"}
          </Button>
        </form>

        <div className="space-y-2 border-t pt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Dépenses de ce jour</span>
            <span className="tabular-nums text-muted-foreground">
              {dayRows.length ? `Total −${dt(dayTotal, 2)}` : "aucune"}
            </span>
          </div>
          {dayRows.length ? (
            <ul className="divide-y rounded-lg border">
              {dayRows.map((r) => (
                <li key={r.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{r.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.kind === "MENSUEL" ? "Charge du mois · " : ""}
                      {EXPENSE_SOURCE_LABEL[r.source]} · {format(new Date(r.createdAt), "HH:mm")}
                    </div>
                  </div>
                  <span className="shrink-0 font-medium tabular-nums text-rose-600">
                    −{dt(r.amount, 2)}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(r.id)}
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            Terminé
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
