"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Coffee, FlaskConical, Hand, Package, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { cn } from "@/lib/utils";
import { productsApi, stockApi, type StockOverview, type StockProductRow, type StockUnit } from "@/lib/api/resources";
import { ChoiceCard, GlassChip, GradientHeader, SectionTitle, dt3, gradientDialogClass, parseNum, qty } from "./stock-ui";

type Mode = "RECIPE" | "UNIT" | "NONE";
type Line = { key: number; stockItemId: string; quantity: string };
let keySeq = 1;

function modeOf(p: StockProductRow | null): Mode {
  if (!p?.recipe.length) return p ? "NONE" : "RECIPE";
  return p.recipe.length === 1 && p.recipe[0].kind === "UNIT" ? "UNIT" : "RECIPE";
}

export function ProductDialog({
  open,
  onOpenChange,
  product,
  overview,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** null = new product */
  product: StockProductRow | null;
  overview: StockOverview;
  onDone: () => void;
}) {
  const ingredients = overview.items.filter((i) => i.kind === "INGREDIENT");
  const itemById = useMemo(() => new Map(overview.items.map((i) => [i.id, i])), [overview.items]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [img, setImg] = useState("");
  const [mode, setMode] = useState<Mode>("RECIPE");
  const [lines, setLines] = useState<Line[]>([]);
  const [manualStock, setManualStock] = useState("0");
  const [manualCost, setManualCost] = useState("0");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newItem, setNewItem] = useState<{ name: string; unit: StockUnit } | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(product?.name ?? "");
    setPrice(product ? String(product.sellingPrice).replace(".", ",") : "");
    setDescription(product?.description ?? "");
    setImg(product?.img ?? "");
    const m = modeOf(product);
    setMode(m);
    setLines(
      m === "RECIPE" && product?.recipe.length
        ? product.recipe.map((r) => ({ key: keySeq++, stockItemId: r.stockItemId, quantity: String(r.quantity).replace(".", ",") }))
        : ingredients[0]
          ? [{ key: keySeq++, stockItemId: ingredients[0].id, quantity: "" }]
          : []
    );
    setManualStock(String(product?.stock ?? 0));
    setManualCost(String(product?.purchasePrice ?? 0).replace(".", ","));
    setConfirmDelete(false);
    setNewItem(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product?.id]);

  const sell = parseNum(price) || 0;
  const recipeCost = lines.reduce((s, l) => s + (parseNum(l.quantity) || 0) * (itemById.get(l.stockItemId)?.unitCost ?? 0), 0);
  const unitItem = product?.recipe.find((r) => r.kind === "UNIT");
  const cost =
    mode === "RECIPE" ? recipeCost : mode === "UNIT" ? (unitItem ? itemById.get(unitItem.stockItemId)?.unitCost ?? 0 : 0) : parseNum(manualCost) || 0;
  const margin = sell - cost;
  const set = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const createItem = useMutation({
    mutationFn: (v: { name: string; unit: StockUnit }) => stockApi.createItem({ ...v, kind: "INGREDIENT" }),
    onSuccess: (r, v) => {
      toast.success(`${v.name} ajouté aux ingrédients`);
      setLines((ls) => [...ls, { key: keySeq++, stockItemId: r.id, quantity: "" }]);
      setNewItem(null);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Nom requis");
      const recipe = lines
        .map((l) => ({ stockItemId: l.stockItemId, quantity: parseNum(l.quantity) }))
        .filter((l) => l.stockItemId && l.quantity > 0);
      if (mode === "RECIPE" && !recipe.length) throw new Error("Ajoute au moins un ingrédient avec sa dose");
      const base = {
        name: name.trim(),
        sellingPrice: sell,
        description: description || undefined,
        img: img || undefined,
        purchasePrice: Math.round(cost * 1000) / 1000,
        ...(mode === "NONE" ? { stock: Math.max(0, Math.floor(Number(manualStock) || 0)) } : {}),
      };
      const saved = product
        ? await productsApi.update(product.id, base)
        : await productsApi.create({ ...base, stock: mode === "NONE" ? base.stock ?? 0 : 0 });
      await stockApi.setRecipe(saved.id, { mode, lines: mode === "RECIPE" ? recipe : undefined });
    },
    onSuccess: () => {
      toast.success(product ? "Produit mis à jour" : "Produit créé");
      onDone();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => productsApi.remove(product!.id),
    onSuccess: () => {
      toast.success("Produit supprimé");
      onDone();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(gradientDialogClass, "max-w-2xl sm:max-w-2xl")}>
        <GradientHeader
          eyebrow={mode === "RECIPE" ? "Produit préparé" : mode === "UNIT" ? "Produit acheté à l’unité" : "Produit"}
          title={name.trim() || (product ? "Modifier le produit" : "Nouveau produit")}
          icon={Coffee}
        >
          <div className="grid grid-cols-3 gap-2">
            <GlassChip label="Vente" value={dt3(sell)} />
            <GlassChip label="Coût" value={dt3(cost)} />
            <GlassChip label="Marge" value={dt3(margin)} hint={sell > 0 ? `${Math.round((margin / sell) * 100)} %` : undefined} />
          </div>
        </GradientHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <section className="grid gap-3 sm:grid-cols-[1fr_140px]">
            <label className="text-[11px] font-semibold text-muted-foreground">
              Nom
              <Input className="mt-0.5 h-10" value={name} onChange={(e) => setName(e.target.value)} placeholder="Express" />
            </label>
            <label className="text-[11px] font-semibold text-muted-foreground">
              Prix de vente (DT)
              <Input inputMode="decimal" className="mt-0.5 h-10 tabular-nums" value={price} onChange={(e) => setPrice(e.target.value)} />
            </label>
          </section>

          <section>
            <SectionTitle>Stock et coût</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-3">
              <ChoiceCard active={mode === "RECIPE"} onClick={() => setMode("RECIPE")} icon={FlaskConical} title="Recette" hint="Café, lait, gobelet…" />
              <ChoiceCard active={mode === "UNIT"} onClick={() => setMode("UNIT")} icon={Package} title="À l’unité" hint="Eau, canette, gâteau" />
              <ChoiceCard active={mode === "NONE"} onClick={() => setMode("NONE")} icon={Hand} title="À la main" hint="Sans suivi" />
            </div>
          </section>

          {mode === "RECIPE" ? (
            <section key="recipe" className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200 motion-reduce:animate-none">
              <SectionTitle aside="dose pour 1 vendu">Recette</SectionTitle>
              <div className="space-y-2">
                {lines.map((l) => {
                  const it = itemById.get(l.stockItemId);
                  const q = parseNum(l.quantity) || 0;
                  return (
                    <div key={l.key} className="flex animate-in fade-in-0 items-center gap-2 rounded-xl border p-2.5 duration-200 motion-reduce:animate-none">
                      <select
                        aria-label="Ingrédient"
                        className="h-9 min-w-0 flex-1 rounded-lg border bg-background px-2 text-sm font-semibold"
                        value={l.stockItemId}
                        onChange={(e) => set(l.key, { stockItemId: e.target.value })}
                      >
                        {ingredients.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name}
                          </option>
                        ))}
                      </select>
                      <Input
                        aria-label="Dose"
                        inputMode="decimal"
                        className="h-9 w-20 text-right tabular-nums"
                        value={l.quantity}
                        onChange={(e) => set(l.key, { quantity: e.target.value })}
                        placeholder="0"
                      />
                      <span className="w-6 text-xs text-muted-foreground">{it?.unit ?? ""}</span>
                      <span className="w-20 text-right text-sm font-bold tabular-nums">{dt3(q * (it?.unitCost ?? 0))}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:bg-rose-50 hover:text-rose-600"
                        aria-label="Retirer"
                        onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {ingredients.length ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-indigo-600 hover:bg-indigo-50"
                    onClick={() => setLines((ls) => [...ls, { key: keySeq++, stockItemId: ingredients[0].id, quantity: "" }])}
                  >
                    <Plus className="h-4 w-4" /> Ingrédient
                  </Button>
                ) : null}
                {newItem ? (
                  <div className="flex animate-in fade-in-0 flex-wrap items-center gap-2 rounded-xl bg-muted/50 p-2 duration-200 motion-reduce:animate-none">
                    <Input
                      autoFocus
                      className="h-8 w-40"
                      placeholder="Nom (ex. Lait)"
                      value={newItem.name}
                      onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    />
                    <select
                      aria-label="Unité"
                      className="h-8 rounded-lg border bg-background px-2 text-sm"
                      value={newItem.unit}
                      onChange={(e) => setNewItem({ ...newItem, unit: e.target.value as StockUnit })}
                    >
                      <option value="g">g / kg</option>
                      <option value="ml">ml / L</option>
                      <option value="pc">pièces</option>
                    </select>
                    <Button
                      size="sm"
                      className="h-8 bg-indigo-600 text-white hover:bg-indigo-700"
                      disabled={!newItem.name.trim() || createItem.isPending}
                      onClick={() => createItem.mutate({ name: newItem.name.trim(), unit: newItem.unit })}
                    >
                      Créer
                    </Button>
                  </div>
                ) : (
                  <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setNewItem({ name: "", unit: "g" })}>
                    <Plus className="h-4 w-4" /> Nouvel ingrédient
                  </Button>
                )}
              </div>
              {lines.some((l) => !itemById.get(l.stockItemId)?.hasLots) ? (
                <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  Un ingrédient n’a encore aucun achat : ajoute son stock de départ (Nouvel achat → Stock de départ), sinon ce produit sera en rupture.
                </p>
              ) : null}
            </section>
          ) : mode === "UNIT" ? (
            <p key="unit" className="animate-in fade-in-0 rounded-xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground duration-200 motion-reduce:animate-none">
              Le stock vient des achats de « {name.trim() || "ce produit"} » (par exemple un pack de 24 bouteilles).
              {unitItem ? ` Il en reste ${qty(itemById.get(unitItem.stockItemId)?.left ?? 0, "pc")}.` : " Il apparaîtra dans « Nouvel achat » après l’enregistrement."}
            </p>
          ) : (
            <section key="none" className="grid animate-in fade-in-0 grid-cols-2 gap-3 duration-200 motion-reduce:animate-none">
              <label className="text-[11px] font-semibold text-muted-foreground">
                Stock
                <Input type="number" className="mt-0.5 h-10" value={manualStock} onChange={(e) => setManualStock(e.target.value)} />
              </label>
              <label className="text-[11px] font-semibold text-muted-foreground">
                Prix d’achat (DT)
                <Input inputMode="decimal" className="mt-0.5 h-10" value={manualCost} onChange={(e) => setManualCost(e.target.value)} />
              </label>
            </section>
          )}

          <section className="space-y-3">
            <label className="block text-[11px] font-semibold text-muted-foreground">
              Description
              <Input className="mt-0.5 h-10" value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <ImageUpload label="Photo (café / boutique)" value={img} onChange={(url) => setImg(url || "")} />
          </section>
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 border-t px-6 py-3 sm:justify-between">
          {product ? (
            confirmDelete ? (
              <div className="flex animate-in fade-in-0 items-center gap-2 duration-150">
                <span className="text-sm text-rose-600">Supprimer ?</span>
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
          <Button
            className="rounded-xl bg-indigo-600 px-5 font-bold text-white transition-colors hover:bg-indigo-700"
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
