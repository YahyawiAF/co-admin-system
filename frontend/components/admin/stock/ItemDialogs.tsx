"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Beaker, ClipboardCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { stockApi, type StockItemRow, type StockUnit } from "@/lib/api/resources";
import { GradientHeader, SectionTitle, buyUnit, countUnit, dt, gradientDialogClass, parseNum, qty } from "./stock-ui";

const UNITS: [StockUnit, string][] = [
  ["g", "Poids (g / kg)"],
  ["ml", "Liquide (ml / L)"],
  ["pc", "Pièces"],
];

/** New ingredient (with optional opening stock) or edit an existing one. */
export function ItemDialog({
  open,
  onOpenChange,
  item,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  item: StockItemRow | null;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<StockUnit>("g");
  const [startQty, setStartQty] = useState("");
  const [startValue, setStartValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(item?.name ?? "");
    setUnit(item?.unit ?? "g");
    setStartQty("");
    setStartValue("");
    setConfirmDelete(false);
  }, [open, item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const bu = buyUnit(unit);
  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Nom requis");
      if (item) {
        await stockApi.updateItem(item.id, { name: name.trim(), unit: item.hasLots ? undefined : unit });
        return;
      }
      const created = await stockApi.createItem({ name: name.trim(), unit });
      const q = parseNum(startQty);
      if (q > 0) {
        await stockApi.createPurchase({
          source: "NONE",
          date: format(new Date(), "yyyy-MM-dd"),
          note: "Stock de départ",
          lines: [{ stockItemId: created.id, quantity: q * bu.factor, price: parseNum(startValue) || 0 }],
        });
      }
    },
    onSuccess: () => {
      toast.success(item ? "Ingrédient mis à jour" : "Ingrédient ajouté");
      onDone();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: () => stockApi.removeItem(item!.id),
    onSuccess: () => {
      toast.success("Ingrédient supprimé");
      onDone();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(gradientDialogClass, "max-w-lg sm:max-w-lg")}>
        <GradientHeader
          eyebrow="Ingrédient / article"
          title={name.trim() || (item ? "Modifier" : "Nouvel ingrédient")}
          icon={Beaker}
          description="Ce que tu achètes : café grain, lait, gobelets, sucre…"
        />
        <div className="space-y-5 overflow-y-auto px-6 py-5">
          <label className="block text-[11px] font-semibold text-muted-foreground">
            Nom
            <Input autoFocus className="mt-0.5 h-10" value={name} onChange={(e) => setName(e.target.value)} placeholder="Café grain" />
          </label>
          <section>
            <SectionTitle aside={item?.hasLots ? "fixé après le premier achat" : undefined}>Unité</SectionTitle>
            <div className="inline-flex flex-wrap rounded-lg bg-muted p-1">
              {UNITS.map(([u, l]) => (
                <button
                  key={u}
                  type="button"
                  disabled={!!item?.hasLots}
                  onClick={() => setUnit(u)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-semibold transition-all duration-200 motion-reduce:transition-none",
                    unit === u ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </section>
          {!item ? (
            <section>
              <SectionTitle aside="optionnel">Stock de départ (déjà payé)</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-[11px] font-semibold text-muted-foreground">
                  Quantité qui reste ({bu.label})
                  <Input inputMode="decimal" className="mt-0.5 h-10 tabular-nums" value={startQty} onChange={(e) => setStartQty(e.target.value)} />
                </label>
                <label className="text-[11px] font-semibold text-muted-foreground">
                  Valeur (DT)
                  <Input inputMode="decimal" className="mt-0.5 h-10 tabular-nums" value={startValue} onChange={(e) => setStartValue(e.target.value)} />
                </label>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">Ce qu’il te reste aujourd’hui. Pas de dépense créée.</p>
            </section>
          ) : null}
        </div>
        <DialogFooter className="flex-row items-center justify-between gap-2 border-t px-6 py-3 sm:justify-between">
          {item ? (
            confirmDelete ? (
              <div className="flex animate-in fade-in-0 items-center gap-2 duration-150">
                <span className="text-sm text-rose-600">Supprimer avec ses lots ?</span>
                <Button size="sm" variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate()}>
                  Oui
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Non
                </Button>
              </div>
            ) : (
              <Button variant="ghost" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4" /> Supprimer
              </Button>
            )
          ) : (
            <span />
          )}
          <Button className="rounded-xl bg-indigo-600 px-5 font-bold text-white hover:bg-indigo-700" disabled={save.isPending} onClick={() => save.mutate()}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Inventory count: what is really left. The gap becomes a loss (or a correction up). */
export function CountDialog({
  open,
  onOpenChange,
  item,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  item: StockItemRow | null;
  onDone: () => void;
}) {
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const cu = countUnit(item?.unit ?? "pc");
  useEffect(() => {
    if (!open || !item) return;
    setValue(String(+(item.left / cu.factor).toFixed(3)).replace(".", ","));
    setNote("");
  }, [open, item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const real = parseNum(value) * cu.factor;
  const gap = item && Number.isFinite(real) ? item.left - real : 0;
  const save = useMutation({
    mutationFn: () => stockApi.count(item!.id, real, note.trim() || undefined),
    onSuccess: (r) => {
      toast.success(r.gap > 0 ? "Perte enregistrée, stock corrigé" : r.gap < 0 ? "Stock corrigé" : "Le compte est juste");
      onDone();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!item) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(gradientDialogClass, "max-w-md sm:max-w-md")}>
        <GradientHeader eyebrow="Inventaire" title={`Compter : ${item.name}`} icon={ClipboardCheck} />
        <div className="space-y-3 px-6 py-5">
          <p className="text-sm text-muted-foreground">
            D’après les ventes, il devrait rester <b className="text-foreground">{qty(item.left, item.unit)}</b>.
          </p>
          <label className="block text-[11px] font-semibold text-muted-foreground">
            Combien il reste vraiment ({cu.label})
            <Input autoFocus inputMode="decimal" className="mt-0.5 h-10 tabular-nums" value={value} onChange={(e) => setValue(e.target.value)} />
          </label>
          <label className="block text-[11px] font-semibold text-muted-foreground">
            Pourquoi (optionnel)
            <Input className="mt-0.5 h-10" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Offert, renversé, doses trop grosses…" />
          </label>
          <p
            key={Math.sign(Math.round(gap * 1000))}
            className={cn(
              "animate-in fade-in-0 rounded-xl p-3 text-[13px] duration-200 motion-reduce:animate-none",
              gap > 1e-6 ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" : "bg-muted text-muted-foreground"
            )}
          >
            {gap > 1e-6 ? (
              <>
                {qty(gap, item.unit)} en moins → <b>perte de {dt(gap * item.unitCost)}</b>
              </>
            ) : gap < -1e-6 ? (
              `${qty(-gap, item.unit)} en plus → le stock sera corrigé`
            ) : (
              "Le compte est juste."
            )}
          </p>
        </div>
        <DialogFooter className="gap-2 border-t px-6 py-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            className="rounded-xl bg-indigo-600 px-5 font-bold text-white hover:bg-indigo-700"
            disabled={save.isPending || !Number.isFinite(real) || real < 0}
            onClick={() => save.mutate()}
          >
            Corriger le stock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
