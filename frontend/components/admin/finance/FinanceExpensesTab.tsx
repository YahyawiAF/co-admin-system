"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronDown,
  MoreHorizontal,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  dailyExpensesApi,
  expensesApi,
  type ExpenseMonthOverview,
  type ExpenseSource,
} from "@/lib/api/resources";
import { EXPENSE_SOURCE_LABEL, dt, invalidateMoney } from "@/lib/finance-queries";
import { QuickExpenseDialog } from "./QuickExpenseDialog";

type Charge = ExpenseMonthOverview["recurring"][number];

const todayKey = () => format(new Date(), "yyyy-MM-dd");
const dayLabel = (key: string) =>
  format(new Date(`${key}T12:00:00`), "EEEE d MMM", { locale: fr });

function SourcePicker({
  value,
  onChange,
}: {
  value: ExpenseSource;
  onChange: (v: ExpenseSource) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {(Object.keys(EXPENSE_SOURCE_LABEL) as ExpenseSource[]).map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={cn(
            "rounded-lg border px-2 py-2 text-sm font-medium transition-colors",
            value === s ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/60",
          )}
        >
          {EXPENSE_SOURCE_LABEL[s]}
        </button>
      ))}
    </div>
  );
}

/** Pay a recurring charge (amount editable: électricité varies) or record a one-off charge. */
function PayChargeDialog({
  open,
  onOpenChange,
  charge,
  monthKey,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** null = one-off charge of the month */
  charge: Charge | null;
  monthKey: string;
}) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [date, setDate] = useState(todayKey());
  const [source, setSource] = useState<ExpenseSource>("AUTRE");

  useEffect(() => {
    if (!open) return;
    setAmount(charge ? String(charge.amount) : "");
    setLabel(charge?.name ?? "");
    const today = todayKey();
    setDate(today.startsWith(monthKey) ? today : charge?.dueDate ?? `${monthKey}-01`);
    setSource("AUTRE");
  }, [open, charge, monthKey]);

  const value = Number(amount.replace(",", "."));
  const save = useMutation({
    mutationFn: () =>
      dailyExpensesApi.create({
        expenseId: charge?.id,
        amount: value,
        label: label.trim() || undefined,
        date,
        source,
        kind: "MENSUEL",
      }),
    onSuccess: () => {
      toast.success(charge ? `${charge.name} payé` : "Charge ajoutée");
      invalidateMoney(queryClient);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{charge ? `Payer · ${charge.name}` : "Charge ponctuelle du mois"}</DialogTitle>
          <DialogDescription>
            {charge
              ? "Corrigez le montant s'il change ce mois-ci (électricité, eau…)."
              : "Une grosse dépense qui ne revient pas chaque mois : réparation, matériel…"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {!charge ? (
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                autoFocus
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex. réparation climatiseur"
              />
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Montant (DT)</Label>
              <Input
                inputMode="decimal"
                autoFocus={!!charge}
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
                className="text-lg font-semibold"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Payé avec</Label>
            <SourcePicker value={source} onChange={setSource} />
          </div>
        </div>
        <DialogFooter>
          <Button
            className="w-full"
            disabled={!(value > 0) || (!charge && !label.trim()) || save.isPending}
            onClick={() => save.mutate()}
          >
            {charge ? `Marquer payé · ${dt(value || 0, 2)}` : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChargeTemplateDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Charge | null;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setAmount(editing ? String(editing.amount) : "");
    setDueDay(editing?.dueDay ? String(editing.dueDay) : "");
  }, [open, editing]);

  const save = useMutation({
    mutationFn: () => {
      const data = {
        name: name.trim(),
        amount: Number(amount.replace(",", ".")),
        type: "MENSUEL" as const,
        dueDay: dueDay ? Number(dueDay) : null,
      };
      return editing ? expensesApi.update(editing.id, data) : expensesApi.create(data);
    },
    onSuccess: () => {
      toast.success(editing ? "Charge modifiée" : "Charge ajoutée");
      invalidateMoney(queryClient);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const day = Number(dueDay);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? "Modifier la charge" : "Nouvelle charge mensuelle"}</DialogTitle>
          <DialogDescription>
            Ce qui revient chaque mois : loyer, internet, électricité, salaire… Elle apparaîtra
            chaque mois avec un bouton « Payer ».
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nom</Label>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Loyer" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Montant habituel (DT)</Label>
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>À payer le (jour)</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                placeholder="ex. 5"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            className="w-full"
            disabled={
              !name.trim() ||
              !(Number(amount.replace(",", ".")) > 0) ||
              (!!dueDay && !(day >= 1 && day <= 31)) ||
              save.isPending
            }
            onClick={() => save.mutate()}
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const STATUS_UI: Record<Charge["status"], { label: (c: Charge) => string; className: string }> = {
  paid: {
    label: (c) =>
      `Payé ${c.payments[0]?.date ? `le ${format(new Date(c.payments[0].date), "d MMM", { locale: fr })}` : ""}`,
    className: "bg-emerald-100 text-emerald-700",
  },
  late: {
    label: (c) => `En retard · échéance le ${c.dueDay}`,
    className: "bg-rose-100 text-rose-700",
  },
  soon: { label: (c) => `Bientôt · le ${c.dueDay}`, className: "bg-amber-100 text-amber-700" },
  todo: {
    label: (c) => (c.dueDay ? `À payer le ${c.dueDay}` : "À payer"),
    className: "bg-muted text-muted-foreground",
  },
};

export function FinanceExpensesTab({
  monthKey,
  onMonthChange,
}: {
  monthKey: string;
  onMonthChange: (key: string) => void;
}) {
  const queryClient = useQueryClient();
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  const [quickDate, setQuickDate] = useState<string | null>(null);
  const [paying, setPaying] = useState<{ charge: Charge | null } | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [editing, setEditing] = useState<Charge | null>(null);
  const [openDay, setOpenDay] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["expenses-month", year, month],
    queryFn: () => dailyExpensesApi.month(year, month),
  });

  const removeRow = useMutation({
    mutationFn: (id: string) => dailyExpensesApi.remove(id),
    onSuccess: () => {
      toast.success("Supprimé");
      invalidateMoney(queryClient);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeTemplate = useMutation({
    mutationFn: (id: string) => expensesApi.remove(id),
    onSuccess: () => {
      toast.success("Charge retirée (les paiements passés restent)");
      invalidateMoney(queryClient);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isCurrentMonth = todayKey().startsWith(monthKey);
  const late = data?.recurring.filter((c) => c.status === "late") ?? [];
  const toPay = data?.recurring.filter((c) => c.status !== "paid") ?? [];
  const maxLabel = Math.max(1, ...(data?.daily.byLabel.map((l) => l.total) ?? [1]));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label>Mois</Label>
          <Input
            type="month"
            className="w-auto"
            value={monthKey}
            onChange={(e) => e.target.value && onMonthChange(e.target.value)}
          />
        </div>
        <Button
          size="lg"
          className="gap-2"
          onClick={() => setQuickDate(isCurrentMonth ? todayKey() : `${monthKey}-01`)}
        >
          <Receipt className="h-4 w-4" />
          Dépense du jour
        </Button>
      </div>

      {isLoading || !data ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="shadow-none">
              <CardContent className="space-y-1 p-4">
                <div className="text-xs font-medium text-muted-foreground">Dépensé ce mois</div>
                <div className="text-2xl font-semibold tabular-nums">{dt(data.totals.spent)}</div>
                <div className="text-xs text-muted-foreground">
                  Petites dépenses {dt(data.totals.daily)} · Charges {dt(data.totals.chargesPaid)}
                </div>
              </CardContent>
            </Card>
            <Card className={cn("shadow-none", late.length && "border-rose-200 bg-rose-50/50")}>
              <CardContent className="space-y-1 p-4">
                <div className="text-xs font-medium text-muted-foreground">Charges à payer</div>
                <div className="text-2xl font-semibold tabular-nums">
                  {dt(data.totals.chargesRemaining)}
                </div>
                <div className={cn("text-xs", late.length ? "font-medium text-rose-700" : "text-muted-foreground")}>
                  {toPay.length
                    ? `${toPay.length} charge${toPay.length > 1 ? "s" : ""}${late.length ? ` · ${late.length} en retard` : ""}`
                    : data.recurring.length
                      ? "Tout est payé"
                      : "Aucune charge mensuelle"}
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardContent className="space-y-1 p-4">
                <div className="text-xs font-medium text-muted-foreground">Payé depuis</div>
                <div className="space-y-0.5 pt-1 text-sm">
                  {(Object.keys(EXPENSE_SOURCE_LABEL) as ExpenseSource[]).map((s) => (
                    <div key={s} className="flex justify-between tabular-nums">
                      <span className="text-muted-foreground">{EXPENSE_SOURCE_LABEL[s]}</span>
                      <span className="font-medium">{dt(data.totals.bySource[s] ?? 0)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-none">
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-3">
              <div>
                <CardTitle className="text-base">Charges du mois</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Loyer, internet, électricité… Cliquez « Payer » quand c&apos;est réglé.
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setPaying({ charge: null })}>
                  <Plus className="mr-1 h-4 w-4" />
                  Ponctuelle
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditing(null);
                    setTemplateOpen(true);
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Charge mensuelle
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {!data.recurring.length && !data.oneOff.length ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Ajoutez vos charges qui reviennent chaque mois (ex. Loyer 800 DT le 5). Vous verrez
                  chaque mois ce qui est payé et ce qui reste.
                </div>
              ) : null}
              {data.recurring.map((c) => {
                const ui = STATUS_UI[c.status];
                return (
                  <div
                    key={c.id}
                    className={cn(
                      "flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5",
                      c.status === "paid" && "bg-emerald-50/40",
                      c.status === "late" && "border-rose-200 bg-rose-50/40",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{c.name}</span>
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", ui.className)}>
                          {c.status === "late" ? <AlertTriangle className="mr-1 inline h-3 w-3" /> : null}
                          {ui.label(c)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {c.status === "paid"
                          ? `${dt(c.paid, 2)} · ${c.payments.map((p) => EXPENSE_SOURCE_LABEL[p.source]).join(", ")}`
                          : `Habituellement ${dt(c.amount, 2)}`}
                      </div>
                    </div>
                    {c.status === "paid" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1 text-muted-foreground"
                        disabled={removeRow.isPending}
                        onClick={() => c.payments.forEach((p) => removeRow.mutate(p.id))}
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                        Annuler
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => setPaying({ charge: c })}>
                        <Check className="mr-1 h-4 w-4" />
                        Payer
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditing(c);
                            setTemplateOpen(true);
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => removeTemplate.mutate(c.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Ne plus suivre
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
              {data.oneOff.length ? (
                <div className="pt-2">
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Ponctuelles ce mois
                  </div>
                  {data.oneOff.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 border-b px-1 py-2 text-sm last:border-0">
                      <CalendarClock className="h-4 w-4 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{r.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.date ? dayLabel(format(new Date(r.date), "yyyy-MM-dd")) : ""} ·{" "}
                          {EXPENSE_SOURCE_LABEL[r.source]}
                        </div>
                      </div>
                      <span className="font-medium tabular-nums text-rose-600">−{dt(r.amount, 2)}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeRow.mutate(r.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Où part l&apos;argent</CardTitle>
                <p className="text-sm text-muted-foreground">Petites dépenses du mois, par description.</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.daily.byLabel.length ? (
                  data.daily.byLabel.slice(0, 10).map((l) => (
                    <div key={l.label} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="truncate font-medium">{l.label}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {dt(l.total, 2)} · {l.count}×
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-rose-400"
                          style={{ width: `${(l.total / maxLabel) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Aucune petite dépense ce mois.</p>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Jour par jour</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {data.daily.count} dépense{data.daily.count > 1 ? "s" : ""} · cliquez un jour pour le détail.
                </p>
              </CardHeader>
              <CardContent className="space-y-1">
                {data.daily.byDay.length ? (
                  data.daily.byDay.map((d) => {
                    const expanded = openDay === d.date;
                    const rows = data.daily.rows.filter(
                      (r) => r.date && format(new Date(r.date), "yyyy-MM-dd") === d.date,
                    );
                    return (
                      <div key={d.date} className="rounded-lg border">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50"
                          onClick={() => setOpenDay(expanded ? null : d.date)}
                        >
                          <span className="flex-1 capitalize">{dayLabel(d.date)}</span>
                          <span className="text-xs text-muted-foreground">{d.count}×</span>
                          <span className="w-20 text-right font-medium tabular-nums text-rose-600">
                            −{dt(d.total)}
                          </span>
                          <ChevronDown
                            className={cn("h-4 w-4 text-muted-foreground transition-transform", expanded && "rotate-180")}
                          />
                        </button>
                        {expanded ? (
                          <div className="border-t bg-muted/20 px-3 py-1">
                            {rows.map((r) => (
                              <div key={r.id} className="flex items-center gap-2 py-1.5 text-sm">
                                <span className="min-w-0 flex-1 truncate">{r.label}</span>
                                <span className="text-xs text-muted-foreground">
                                  {EXPENSE_SOURCE_LABEL[r.source]}
                                </span>
                                <span className="w-16 text-right tabular-nums">{dt(r.amount, 2)}</span>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => removeRow.mutate(r.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ))}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="mb-1 h-7 gap-1 px-1 text-xs"
                              onClick={() => setQuickDate(d.date)}
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Ajouter à ce jour
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Rien pour l&apos;instant. Utilisez « Dépense du jour » ici ou dans le Journal.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <QuickExpenseDialog
        open={!!quickDate}
        onOpenChange={(o) => !o && setQuickDate(null)}
        date={quickDate ?? todayKey()}
      />
      <PayChargeDialog
        open={!!paying}
        onOpenChange={(o) => !o && setPaying(null)}
        charge={paying?.charge ?? null}
        monthKey={monthKey}
      />
      <ChargeTemplateDialog open={templateOpen} onOpenChange={setTemplateOpen} editing={editing} />
    </div>
  );
}
