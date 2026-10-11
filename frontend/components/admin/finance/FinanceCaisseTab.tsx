"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format, isToday, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Landmark,
  Lock,
  LockOpen,
  Pencil,
  Receipt,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { caisseApi } from "@/lib/api/resources";
import type { DayFinanceSummary } from "@/lib/types";
import { EXPENSE_SOURCE_LABEL, dt, invalidateMoney } from "@/lib/finance-queries";
import { QuickExpenseDialog } from "./QuickExpenseDialog";

const GAP_NEEDS_NOTE = 0.5;
const GAP_REASONS = ["Erreur de monnaie", "Vente non saisie", "Dépense oubliée", "Client a payé plus tard"];
const parseAmount = (s: string) => Number(s.replace(",", "."));
const shortDay = (key: string) =>
  format(new Date(`${key}T12:00:00`), "EEE d MMM", { locale: fr });

type MoveKind = "to-coffre" | "from-coffre" | "out" | "in";
const MOVES: Record<MoveKind, { title: string; hint: string; type: "IN" | "OUT"; coffre: boolean }> = {
  "to-coffre": {
    title: "Verser au coffre",
    hint: "Trop d'espèces dans le tiroir ? Mettez-en au coffre.",
    type: "OUT",
    coffre: true,
  },
  "from-coffre": {
    title: "Prendre de la monnaie au coffre",
    hint: "Ajoute des espèces dans le tiroir depuis le coffre.",
    type: "IN",
    coffre: true,
  },
  out: {
    title: "Sortie d'espèces",
    hint: "Argent retiré du tiroir qui n'est pas une dépense (ex. remboursement).",
    type: "OUT",
    coffre: false,
  },
  in: {
    title: "Entrée d'espèces",
    hint: "Argent ajouté dans le tiroir hors ventes (ex. apport).",
    type: "IN",
    coffre: false,
  },
};

function MovementDialog({
  kind,
  onClose,
  date,
}: {
  kind: MoveKind | null;
  onClose: () => void;
  date: string;
}) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  useEffect(() => {
    setAmount("");
    setLabel("");
  }, [kind]);
  const cfg = kind ? MOVES[kind] : null;
  const value = parseAmount(amount);
  const save = useMutation({
    mutationFn: () =>
      caisseApi.addMovement({
        date,
        type: cfg!.type,
        amount: value,
        label: label.trim() || undefined,
        coffre: cfg!.coffre,
      }),
    onSuccess: () => {
      toast.success("Enregistré");
      invalidateMoney(queryClient);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={!!kind} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{cfg?.title}</DialogTitle>
          <DialogDescription>{cfg?.hint}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Montant (DT)</Label>
            <Input
              autoFocus
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
              className="h-12 text-2xl font-semibold"
            />
            <div className="flex flex-wrap gap-1.5">
              {[10, 20, 50, 100, 200].map((s) => (
                <Button
                  key={s}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => setAmount(String((Number.isFinite(value) ? value : 0) + s))}
                >
                  +{s}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Motif (optionnel)</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button className="w-full" disabled={!(value > 0) || save.isPending} onClick={() => save.mutate()}>
            Valider {value > 0 ? dt(value, 2) : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CloseDialog({
  open,
  onOpenChange,
  summary,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  summary: DayFinanceSummary;
}) {
  const queryClient = useQueryClient();
  const [counted, setCounted] = useState("");
  const [kept, setKept] = useState("");
  const [notes, setNotes] = useState("");
  useEffect(() => {
    if (!open) return;
    setCounted("");
    setKept(String(summary.openingFloat || 0));
    setNotes("");
  }, [open, summary.openingFloat]);

  const countedValue = parseAmount(counted);
  const hasCount = counted !== "" && Number.isFinite(countedValue);
  const gap = hasCount ? Math.round((countedValue - summary.expectedClose) * 100) / 100 : 0;
  const needsNote = hasCount && Math.abs(gap) >= GAP_NEEDS_NOTE;
  const keptValue = Math.min(hasCount ? countedValue : 0, Math.max(0, parseAmount(kept) || 0));
  const toCoffre = hasCount ? Math.max(0, countedValue - keptValue) : 0;

  const close = useMutation({
    mutationFn: () =>
      caisseApi.close(summary.dateKey, {
        countedClose: countedValue,
        keptFloat: keptValue,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success(
        toCoffre > 0 ? `Journée clôturée · ${dt(toCoffre, 2)} versés au coffre` : "Journée clôturée",
      );
      invalidateMoney(queryClient);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Clôturer la journée</DialogTitle>
          <DialogDescription className="capitalize">
            {format(new Date(`${summary.dateKey}T12:00:00`), "EEEE d MMMM", { locale: fr })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label className="text-sm">1. Comptez les espèces dans le tiroir</Label>
            <Input
              autoFocus
              inputMode="decimal"
              placeholder="Montant compté"
              value={counted}
              onChange={(e) => setCounted(e.target.value.replace(/[^\d.,]/g, ""))}
              className="h-14 text-3xl font-semibold tabular-nums"
            />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Attendu {dt(summary.expectedClose, 2)}</span>
              {hasCount ? (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-semibold",
                    Math.abs(gap) < GAP_NEEDS_NOTE
                      ? "bg-emerald-100 text-emerald-700"
                      : gap < 0
                        ? "bg-rose-100 text-rose-700"
                        : "bg-amber-100 text-amber-700",
                  )}
                >
                  {Math.abs(gap) < GAP_NEEDS_NOTE
                    ? "Juste ✓"
                    : gap < 0
                      ? `Il manque ${dt(-gap, 2)}`
                      : `${dt(gap, 2)} en trop`}
                </span>
              ) : null}
            </div>
          </div>

          {needsNote ? (
            <div className="space-y-1.5">
              <Label className="text-sm">Expliquez l&apos;écart</Label>
              <div className="flex flex-wrap gap-1.5">
                {GAP_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className="rounded-full bg-muted px-2.5 py-1 text-xs hover:bg-muted/70"
                    onClick={() => setNotes((n) => (n ? `${n} · ${r}` : r))}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label className="text-sm">2. Monnaie à garder dans le tiroir pour demain</Label>
            <Input
              inputMode="decimal"
              value={kept}
              onChange={(e) => setKept(e.target.value.replace(/[^\d.,]/g, ""))}
            />
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <div className="flex justify-between">
              <span>Va au coffre</span>
              <span className="font-semibold tabular-nums">{dt(toCoffre, 2)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Reste dans le tiroir (fond de demain)</span>
              <span className="tabular-nums">{dt(keptValue, 2)}</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            className="w-full"
            size="lg"
            disabled={!hasCount || (needsNote && !notes.trim()) || close.isPending}
            onClick={() => close.mutate()}
          >
            <Lock className="mr-2 h-4 w-4" />
            Clôturer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Line({
  label,
  sub,
  amount,
  sign,
  muted,
  action,
}: {
  label: string;
  sub?: string;
  amount: number;
  sign: "+" | "−";
  muted?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className={cn("flex items-center gap-2 py-1.5 text-sm", muted && amount === 0 && "opacity-50")}>
      <div className="min-w-0 flex-1">
        <span>{label}</span>
        {sub ? <span className="ml-1.5 text-xs text-muted-foreground">{sub}</span> : null}
      </div>
      {action}
      <span
        className={cn(
          "w-24 text-right font-medium tabular-nums",
          sign === "−" && amount > 0 ? "text-rose-600" : sign === "+" && amount > 0 ? "text-emerald-700" : "",
        )}
      >
        {sign}
        {dt(amount, 2)}
      </span>
    </div>
  );
}

export function FinanceCaisseTab({ initialDate }: { initialDate?: string | null }) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(initialDate || format(new Date(), "yyyy-MM-dd"));
  const [closeOpen, setCloseOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [move, setMove] = useState<MoveKind | null>(null);
  const [floatEdit, setFloatEdit] = useState<string | null>(null);

  useEffect(() => {
    if (initialDate) setDate(initialDate);
  }, [initialDate]);

  const { data: s, isLoading } = useQuery({
    queryKey: ["caisse-summary", date],
    queryFn: () => caisseApi.summary(date),
  });

  const day = new Date(`${date}T12:00:00`);
  const shift = (n: number) => setDate(format(n > 0 ? addDays(day, n) : subDays(day, -n), "yyyy-MM-dd"));

  const session = s?.session;
  const isClosed = !!session?.closedAt;

  const removeMovement = useMutation({
    mutationFn: (id: string) => caisseApi.removeMovement(id),
    onSuccess: () => invalidateMoney(queryClient),
    onError: (e: Error) => toast.error(e.message),
  });
  const reopen = useMutation({
    mutationFn: () => caisseApi.reopen(date),
    onSuccess: () => {
      toast.success("Journée rouverte · le versement au coffre a été annulé");
      invalidateMoney(queryClient);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const saveFloat = useMutation({
    mutationFn: (v: number) => caisseApi.setOpeningFloat(date, v),
    onSuccess: () => {
      setFloatEdit(null);
      invalidateMoney(queryClient);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const erpPreview = useMutation({
    mutationFn: () => caisseApi.erpPayloadPreview(date),
    onSuccess: async (payload) => {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2)).catch(() => undefined);
      toast.success("Données ERP copiées");
    },
  });

  const timeline = useMemo(() => {
    if (!s) return [];
    const items: Array<{
      id: string;
      at: string;
      label: string;
      sub: string;
      amount: number;
      sign: "+" | "−";
      icon: typeof Receipt;
      onDelete?: () => void;
    }> = [];
    for (const e of s.dailyExpenses ?? []) {
      items.push({
        id: `e-${e.id}`,
        at: e.createdAt,
        label: e.label,
        sub: `Dépense · ${EXPENSE_SOURCE_LABEL[e.source]}`,
        amount: e.amount,
        sign: "−",
        icon: Receipt,
      });
    }
    for (const m of session?.movements ?? []) {
      items.push({
        id: `m-${m.id}`,
        at: m.createdAt ?? "",
        label: m.label || (m.type === "IN" ? "Entrée" : "Sortie"),
        sub: m.coffreEntry ? "Avec le coffre" : m.type === "IN" ? "Entrée d'espèces" : "Sortie d'espèces",
        amount: m.amount,
        sign: m.type === "IN" ? "+" : "−",
        icon: m.coffreEntry ? Landmark : m.type === "IN" ? ArrowDownLeft : ArrowUpRight,
        onDelete: isClosed ? undefined : () => removeMovement.mutate(m.id),
      });
    }
    return items.sort((a, b) => b.at.localeCompare(a.at));
  }, [s, session, isClosed, removeMovement]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => shift(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            type="date"
            className="h-8 w-auto border-0 shadow-none"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => shift(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isToday(day) ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => setDate(format(new Date(), "yyyy-MM-dd"))}
            >
              Aujourd&apos;hui
            </Button>
          ) : null}
        </div>
        {s ? (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium",
              isClosed ? "bg-slate-100 text-slate-700" : "bg-emerald-100 text-emerald-700",
            )}
          >
            {isClosed ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
            {isClosed
              ? `Clôturée à ${format(new Date(session!.closedAt!), "HH:mm")}`
              : session
                ? "Journée en cours"
                : "Pas encore ouverte"}
          </span>
        ) : null}
      </div>

      {s?.unclosedDays.length ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          <span>
            {s.unclosedDays.length} journée{s.unclosedDays.length > 1 ? "s" : ""} avant celle-ci pas
            encore clôturée{s.unclosedDays.length > 1 ? "s" : ""} :
          </span>
          {s.unclosedDays.slice(0, 5).map((d) => (
            <button
              key={d}
              type="button"
              className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium capitalize shadow-sm hover:bg-amber-100"
              onClick={() => setDate(d)}
            >
              {shortDay(d)}
            </button>
          ))}
        </div>
      ) : null}

      {isLoading || !s ? (
        <Skeleton className="h-80" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
          <Card className="shadow-none">
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {isClosed ? "Compté à la clôture" : "Espèces qui devraient être dans le tiroir"}
                  </div>
                  <div className="text-4xl font-bold tabular-nums tracking-tight">
                    {dt(isClosed ? session!.countedClose ?? 0 : s.expectedClose, 2)}
                  </div>
                </div>
                {!isClosed ? (
                  <Button size="lg" onClick={() => setCloseOpen(true)}>
                    <Lock className="mr-2 h-4 w-4" />
                    Clôturer la journée
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => setReopenOpen(true)}>
                    <LockOpen className="mr-2 h-4 w-4" />
                    Rouvrir
                  </Button>
                )}
              </div>

              {isClosed ? (
                <div className="grid gap-2 rounded-lg bg-muted/40 p-3 text-sm sm:grid-cols-4">
                  <div>
                    <div className="text-xs text-muted-foreground">Attendu</div>
                    <div className="font-medium">{dt(session!.expectedClose ?? 0, 2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Écart</div>
                    <div
                      className={cn(
                        "font-medium",
                        Math.abs(session!.difference ?? 0) >= GAP_NEEDS_NOTE &&
                          ((session!.difference ?? 0) < 0 ? "text-rose-600" : "text-amber-600"),
                      )}
                    >
                      {(session!.difference ?? 0) > 0 ? "+" : ""}
                      {dt(session!.difference ?? 0, 2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Gardé pour demain</div>
                    <div className="font-medium">{dt(session!.keptFloat ?? 0, 2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Versé au coffre</div>
                    <div className="font-medium">
                      {dt((session!.countedClose ?? 0) - (session!.keptFloat ?? 0), 2)}
                    </div>
                  </div>
                  {session!.notes ? (
                    <div className="text-muted-foreground sm:col-span-4">Note : {session!.notes}</div>
                  ) : null}
                  {s.driftSinceClose && Math.abs(s.driftSinceClose) > 0.009 ? (
                    <div className="font-medium text-amber-700 sm:col-span-4">
                      Des opérations ont changé ce jour après la clôture ({s.driftSinceClose > 0 ? "+" : ""}
                      {dt(s.driftSinceClose, 2)}). Rouvrez et recomptez.
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="divide-y">
                <Line
                  label="Fond de caisse"
                  sub="espèces au début de la journée"
                  amount={s.openingFloat}
                  sign="+"
                  action={
                    !isClosed ? (
                      floatEdit != null ? (
                        <div className="flex items-center gap-1">
                          <Input
                            autoFocus
                            inputMode="decimal"
                            className="h-7 w-20"
                            value={floatEdit}
                            onChange={(e) => setFloatEdit(e.target.value.replace(/[^\d.,]/g, ""))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveFloat.mutate(parseAmount(floatEdit) || 0);
                              if (e.key === "Escape") setFloatEdit(null);
                            }}
                          />
                          <Button size="sm" className="h-7" onClick={() => saveFloat.mutate(parseAmount(floatEdit) || 0)}>
                            OK
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Modifier le fond de caisse"
                          onClick={() => setFloatEdit(String(s.openingFloat))}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )
                    ) : null
                  }
                />
                <Line label="Visites payées" sub={`${s.counts.paidVisits}`} amount={s.revenueJournal} sign="+" muted />
                <Line
                  label="Abonnements encaissés"
                  sub={`${s.counts.abonnementPayments}`}
                  amount={s.revenueAbonnements}
                  sign="+"
                  muted
                />
                <Line label="Produits vendus" sub={`${s.counts.products}`} amount={s.revenueProducts} sign="+" muted />
                <Line label="Entrées d'espèces" amount={s.movementsIn} sign="+" muted />
                <Line label="Dépenses payées en espèces" amount={s.expensesCash} sign="−" muted />
                <Line label="Sorties / versements au coffre" amount={s.movementsOut} sign="−" muted />
                <div className="flex items-center justify-between pt-2 text-sm font-semibold">
                  <span>= Attendu dans le tiroir</span>
                  <span className="tabular-nums">{dt(s.expectedClose, 2)}</span>
                </div>
              </div>
              {s.expensesOther > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {dt(s.expensesOther, 2)} de dépenses payées par le coffre ou la banque ne sont pas
                  comptées dans le tiroir.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="h-auto flex-col gap-1 py-3" onClick={() => setExpenseOpen(true)}>
                  <Receipt className="h-5 w-5 text-rose-500" />
                  <span className="text-sm">Dépense</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto flex-col gap-1 py-3"
                  disabled={isClosed}
                  onClick={() => setMove("to-coffre")}
                >
                  <Landmark className="h-5 w-5 text-indigo-500" />
                  <span className="text-sm">Verser au coffre</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto flex-col gap-1 py-3"
                  disabled={isClosed}
                  onClick={() => setMove("from-coffre")}
                >
                  <ArrowDownLeft className="h-5 w-5 text-emerald-600" />
                  <span className="text-sm">Monnaie du coffre</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto flex-col gap-1 py-3"
                  disabled={isClosed}
                  onClick={() => setMove("out")}
                >
                  <ArrowUpRight className="h-5 w-5 text-amber-600" />
                  <span className="text-sm">Autre sortie</span>
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Mouvements du jour</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Dépenses et mouvements d&apos;espèces. Les ventes sont dans le Journal.
                </p>
              </CardHeader>
              <CardContent>
                {timeline.length ? (
                  <ul className="divide-y">
                    {timeline.map((t) => {
                      const Icon = t.icon;
                      return (
                        <li key={t.id} className="flex items-center gap-2 py-2 text-sm">
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{t.label}</div>
                            <div className="text-xs text-muted-foreground">
                              {t.sub}
                              {t.at ? ` · ${format(new Date(t.at), "HH:mm")}` : ""}
                            </div>
                          </div>
                          <span
                            className={cn(
                              "font-medium tabular-nums",
                              t.sign === "−" ? "text-rose-600" : "text-emerald-700",
                            )}
                          >
                            {t.sign}
                            {dt(t.amount, 2)}
                          </span>
                          {t.onDelete ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={t.onDelete}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="py-4 text-center text-sm text-muted-foreground">Aucun mouvement.</p>
                )}
              </CardContent>
            </Card>
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => erpPreview.mutate()}
            >
              Copier les données ERP du jour
            </button>
          </div>
        </div>
      )}

      {s ? <CloseDialog open={closeOpen} onOpenChange={setCloseOpen} summary={s} /> : null}
      <MovementDialog kind={move} onClose={() => setMove(null)} date={date} />
      <QuickExpenseDialog open={expenseOpen} onOpenChange={setExpenseOpen} date={date} />
      <AlertDialog open={reopenOpen} onOpenChange={setReopenOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rouvrir la journée ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le versement au coffre de cette clôture sera annulé. Vous pourrez corriger puis
              recompter.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => reopen.mutate()}>Rouvrir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
