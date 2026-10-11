"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Hand,
  Landmark,
  Lock,
  Receipt,
  Trash2,
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
import { cn } from "@/lib/utils";
import { caisseApi } from "@/lib/api/resources";
import type { CoffreEntry } from "@/lib/types";
import { dt, invalidateMoney } from "@/lib/finance-queries";

const REASONS: Record<"IN" | "OUT", string[]> = {
  IN: ["Apport", "Remboursement", "Paiement reçu hors caisse"],
  OUT: ["Dépôt à la banque", "Retrait gérant", "Salaire", "Achat"],
};

const KIND_UI: Record<CoffreEntry["kind"], { icon: typeof Lock; label: string }> = {
  CLOTURE: { icon: Lock, label: "Clôture de caisse" },
  DEPENSE: { icon: Receipt, label: "Dépense payée du coffre" },
  CAISSE: { icon: ArrowLeftRight, label: "Avec la caisse" },
  MANUEL: { icon: Hand, label: "Manuel" },
};

function CoffreDialog({
  type,
  onClose,
  balance,
}: {
  type: "IN" | "OUT" | null;
  onClose: () => void;
  balance: number;
}) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  useEffect(() => {
    setAmount("");
    setLabel("");
    setDate(format(new Date(), "yyyy-MM-dd"));
  }, [type]);
  const value = Number(amount.replace(",", "."));
  const save = useMutation({
    mutationFn: () =>
      caisseApi.addCoffre({ type: type!, amount: value, label: label.trim() || undefined, date }),
    onSuccess: () => {
      toast.success(type === "IN" ? "Dépôt enregistré" : "Retrait enregistré");
      invalidateMoney(queryClient);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={!!type} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{type === "IN" ? "Déposer dans le coffre" : "Retirer du coffre"}</DialogTitle>
          <DialogDescription>
            {type === "OUT"
              ? `Solde actuel ${dt(balance, 2)}. Pour une dépense, utilisez plutôt « Dépense » avec « Coffre ».`
              : "Argent ajouté au coffre en dehors des clôtures de caisse."}
          </DialogDescription>
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
              {[10, 50, 100, 500].map((s) => (
                <Button
                  key={s}
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
            <Label>Motif</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. dépôt banque" />
            {type ? (
              <div className="flex flex-wrap gap-1.5">
                {REASONS[type].map((r) => (
                  <button
                    key={r}
                    type="button"
                    className="rounded-full bg-muted px-2.5 py-1 text-xs hover:bg-muted/70"
                    onClick={() => setLabel(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          {type === "OUT" && value > balance ? (
            <p className="text-sm text-amber-700">Attention : c&apos;est plus que le solde du coffre.</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button className="w-full" disabled={!(value > 0) || save.isPending} onClick={() => save.mutate()}>
            {type === "IN" ? "Déposer" : "Retirer"} {value > 0 ? dt(value, 2) : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FinanceCoffreTab() {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<"IN" | "OUT" | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["coffre"],
    queryFn: () => caisseApi.coffre(),
  });

  const remove = useMutation({
    mutationFn: (id: string) => caisseApi.removeCoffre(id),
    onSuccess: () => {
      toast.success("Supprimé");
      invalidateMoney(queryClient);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const months = useMemo(() => {
    const groups = new Map<string, { key: string; in: number; out: number; entries: CoffreEntry[] }>();
    for (const e of data?.entries ?? []) {
      const key = e.dateKey.slice(0, 7);
      const g = groups.get(key) ?? { key, in: 0, out: 0, entries: [] };
      if (e.type === "IN") g.in += e.amount;
      else g.out += e.amount;
      g.entries.push(e);
      groups.set(key, g);
    }
    return [...groups.values()];
  }, [data]);

  const thisMonth = months.find((m) => m.key === format(new Date(), "yyyy-MM"));
  const lastClosing = data?.entries.find((e) => e.kind === "CLOTURE");

  if (isLoading || !data) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      <Card className="shadow-none">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50">
              <Landmark className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Dans le coffre
              </div>
              <div className="text-4xl font-bold tabular-nums tracking-tight">{dt(data.balance, 2)}</div>
              <div className="text-xs text-muted-foreground">
                {lastClosing
                  ? `Dernier versement de caisse : ${format(new Date(`${lastClosing.dateKey}T12:00:00`), "EEEE d MMM", { locale: fr })} (${dt(lastClosing.amount, 2)})`
                  : "Les clôtures de caisse versent automatiquement ici."}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="lg" variant="outline" onClick={() => setDialog("OUT")}>
              <ArrowUpRight className="mr-2 h-4 w-4" />
              Retirer
            </Button>
            <Button size="lg" onClick={() => setDialog("IN")}>
              <ArrowDownLeft className="mr-2 h-4 w-4" />
              Déposer
            </Button>
          </div>
        </CardContent>
      </Card>

      {thisMonth ? (
        <div className="grid grid-cols-2 gap-3">
          <Card className="shadow-none">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Entré ce mois</div>
              <div className="text-xl font-semibold tabular-nums text-emerald-700">+{dt(thisMonth.in, 2)}</div>
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Sorti ce mois</div>
              <div className="text-xl font-semibold tabular-nums text-rose-600">−{dt(thisMonth.out, 2)}</div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Historique</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {!months.length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aucun mouvement. Clôturez une journée de caisse ou faites un dépôt.
            </p>
          ) : null}
          {months.map((m) => (
            <div key={m.key}>
              <div className="mb-1 flex items-baseline justify-between border-b pb-1">
                <span className="text-sm font-semibold capitalize">
                  {format(new Date(`${m.key}-01T12:00:00`), "MMMM yyyy", { locale: fr })}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  <span className="text-emerald-700">+{dt(m.in)}</span> ·{" "}
                  <span className="text-rose-600">−{dt(m.out)}</span>
                </span>
              </div>
              <ul>
                {m.entries.map((e) => {
                  const ui = KIND_UI[e.kind];
                  const Icon = ui.icon;
                  return (
                    <li key={e.id} className="flex items-center gap-3 py-2 text-sm">
                      <span className="w-16 shrink-0 text-xs capitalize text-muted-foreground">
                        {format(new Date(`${e.dateKey}T12:00:00`), "EEE d", { locale: fr })}
                      </span>
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{e.label || ui.label}</div>
                        <div className="text-[11px] text-muted-foreground">{ui.label}</div>
                      </div>
                      <span
                        className={cn(
                          "font-medium tabular-nums",
                          e.type === "IN" ? "text-emerald-700" : "text-rose-600",
                        )}
                      >
                        {e.type === "IN" ? "+" : "−"}
                        {dt(e.amount, 2)}
                      </span>
                      {e.kind === "MANUEL" ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => remove.mutate(e.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <span className="w-7" />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      <CoffreDialog type={dialog} onClose={() => setDialog(null)} balance={data.balance} />
    </div>
  );
}
