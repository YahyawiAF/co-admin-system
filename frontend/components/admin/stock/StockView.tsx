"use client";

import { useState } from "react";
import { ClipboardCheck, Info, LayoutGrid, Pencil, Plus, ShoppingBasket, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListPager, usePaged } from "@/components/ui/list-pager";
import { cn } from "@/lib/utils";
import type { StockItemRow, StockOverview, StockProductRow } from "@/lib/api/resources";
import { perBuyUnit } from "./buys";
import { IngredientsTab, Losses, ProductsTab } from "./StockTabs";
import { LotsTab, RevenueTab } from "./SalesTabs";
import { StatusPill, dt, qty } from "./stock-ui";

export type StockSub = "stock" | "produits" | "revenus" | "paquets";
const SUBS: { id: StockSub; label: string }[] = [
  { id: "stock", label: "Ingrédients & stock" },
  { id: "produits", label: "Produits & recettes" },
  { id: "revenus", label: "Revenus & coûts" },
  { id: "paquets", label: "Par paquet" },
];
const enter = (i: number) => ({
  className: "animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both duration-300 motion-reduce:animate-none",
  style: { animationDelay: `${Math.min(i, 8) * 30}ms` },
});

/** The product sold as this article (eau, canette…), if any */
function soldAs(overview: StockOverview, item: StockItemRow): StockProductRow | null {
  return overview.products.find((p) => p.recipe.length === 1 && p.recipe[0].stockItemId === item.id && p.recipe[0].kind === "UNIT") ?? null;
}

export function StockView({
  overview,
  sub,
  onSub,
  onCount,
  onBuy,
  onEditItem,
  onNewItem,
  onWhy,
  onOpenProduct,
  onNewProduct,
  onChanged,
}: {
  overview: StockOverview;
  sub: StockSub;
  onSub: (s: StockSub) => void;
  onCount: (i: StockItemRow) => void;
  onBuy: (itemId: string) => void;
  onEditItem: (i: StockItemRow) => void;
  onNewItem: () => void;
  onWhy: (itemId: string) => void;
  onOpenProduct: (p: StockProductRow) => void;
  onNewProduct: () => void;
  onChanged: () => void;
}) {
  const [view, setView] = useState<"cards" | "table">("cards");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5 border-b pb-3" role="tablist" aria-label="Vues du stock">
        {SUBS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={sub === s.id}
            onClick={() => onSub(s.id)}
            className={cn(
              "min-h-9 rounded-full border px-4 text-[13px] font-semibold transition-colors duration-200 motion-reduce:transition-none",
              sub === s.id ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground hover:border-indigo-300"
            )}
          >
            {s.label}
          </button>
        ))}
        <span className="flex-1" />
        {sub === "stock" ? (
          <>
            <ViewSwitch view={view} onView={setView} />
            <Button size="sm" className="rounded-xl bg-indigo-600 font-bold text-white hover:bg-indigo-700" onClick={onNewItem}>
              <Plus className="h-3.5 w-3.5" /> Ingrédient
            </Button>
          </>
        ) : sub === "produits" ? (
          <Button size="sm" className="rounded-xl bg-indigo-600 font-bold text-white hover:bg-indigo-700" onClick={onNewProduct}>
            <Plus className="h-3.5 w-3.5" /> Produit
          </Button>
        ) : null}
      </div>
      <div key={sub} className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300 motion-reduce:animate-none">
        {sub === "stock" ? (
          view === "cards" ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0">
                <IngredientsTab overview={overview} onCount={onCount} onBuy={(i) => onBuy(i.id)} onEdit={onEditItem} onWhy={onWhy} />
              </div>
              <aside className="space-y-3">
                <Losses losses={overview.losses} total={overview.totals.losses} onChanged={onChanged} />
              </aside>
            </div>
          ) : (
            <StockTable overview={overview} onCount={onCount} onBuy={onBuy} onEdit={onEditItem} onWhy={onWhy} onChanged={onChanged} />
          )
        ) : sub === "produits" ? (
          <ProductsTab overview={overview} onOpen={onOpenProduct} />
        ) : sub === "revenus" ? (
          <RevenueTab overview={overview} />
        ) : (
          <LotsTab overview={overview} />
        )}
      </div>
    </div>
  );
}

function StockTable({
  overview,
  onCount,
  onBuy,
  onEdit,
  onWhy,
  onChanged,
}: {
  overview: StockOverview;
  onCount: (i: StockItemRow) => void;
  onBuy: (itemId: string) => void;
  onEdit: (i: StockItemRow) => void;
  onWhy: (itemId: string) => void;
  onChanged: () => void;
}) {
  const paged = usePaged(overview.items, 20);
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="min-w-0 overflow-hidden rounded-2xl border bg-card">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 p-4 pb-3">
          <h2 className="text-base font-extrabold">Ce qu’il reste</h2>
          <p className="text-[13px] text-muted-foreground">Le stock baisse à chaque vente. Si le compte réel est différent, clique « Compter ».</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-[13px]">
            <thead className="border-y bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Article</th>
                <th className="px-3 py-2 text-right">En stock</th>
                <th className="px-3 py-2 text-right">Coût moyen</th>
                <th className="px-3 py-2 text-right">Prix de vente</th>
                <th className="px-3 py-2 text-right">Marge / unité</th>
                <th className="px-3 py-2 text-right">Valeur du stock</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {paged.pageItems.map((it, i) => {
                const p = soldAs(overview, it);
                const { className, style } = enter(i);
                return (
                  <tr key={it.id} style={style} className={cn(className, "border-b transition-colors last:border-0 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20")}>
                    <td className="px-4 py-2.5">
                      <b>{it.name}</b>
                      <p className="max-w-[260px] truncate text-xs text-muted-foreground">
                        {it.kind === "UNIT" ? "Vendu tel quel" : it.usedBy.length ? `Ingrédient · ${it.usedBy.join(", ")}` : "Ingrédient · dans aucune recette"}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <b key={it.left} className="animate-in fade-in-0 tabular-nums duration-200 motion-reduce:animate-none">
                        {qty(it.left, it.unit)}
                      </b>
                      {it.daysLeft != null && it.left > 0 ? (
                        <p className={cn("text-xs text-muted-foreground", it.daysLeft < 7 && "font-bold text-amber-700")}>~{Math.max(1, Math.round(it.daysLeft))} j</p>
                      ) : it.hasLots && it.left <= 0 ? (
                        <StatusPill tone="bad">rupture</StatusPill>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        {it.hasLots ? perBuyUnit(it.unitCost, it.unit) : "pas d’achat"}
                        {it.hasLots ? (
                          <button
                            type="button"
                            aria-label={`Calcul du coût moyen de ${it.name}`}
                            onClick={() => onWhy(it.id)}
                            className="rounded-full p-0.5 text-indigo-600 transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{p ? (
                        dt(p.sellingPrice)
                      ) : (
                        <span className="text-muted-foreground">{it.kind === "UNIT" ? "aucun produit lié" : "dans les recettes"}</span>
                      )}</td>
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums">
                      {p && it.hasLots ? (
                        <span className={p.sellingPrice - it.unitCost >= 0 ? "text-emerald-600" : "text-rose-600"}>{dt(p.sellingPrice - it.unitCost)}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{dt(it.left * it.unitCost)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="outline" className="h-8 rounded-lg" disabled={!it.hasLots} onClick={() => onCount(it)}>
                          <ClipboardCheck className="h-3.5 w-3.5" /> Compter
                        </Button>
                        <Button size="sm" className="h-8 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => onBuy(it.id)}>
                          <ShoppingBasket className="h-3.5 w-3.5" /> Acheter
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Modifier ${it.name}`} onClick={() => onEdit(it)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!overview.items.length ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Aucun article. Clique sur « + Article » : café grain, lait, gobelets, eau…
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <ListPager page={paged.page} lastPage={paged.lastPage} total={paged.total} onPage={paged.setPage} />
      </section>
      <aside className="space-y-3">
        <Losses losses={overview.losses} total={overview.totals.losses} onChanged={onChanged} />
      </aside>
    </div>
  );
}

/** Cards (with progress bars) or one table */
export function ViewSwitch({ view, onView }: { view: "cards" | "table"; onView: (v: "cards" | "table") => void }) {
  return (
    <div className="inline-flex rounded-xl border bg-card p-0.5" role="group" aria-label="Affichage">
      {(
        [
          ["cards", "Cartes", LayoutGrid],
          ["table", "Tableau", Table2],
        ] as const
      ).map(([id, label, Icon]) => (
        <button
          key={id}
          type="button"
          aria-pressed={view === id}
          onClick={() => onView(id)}
          className={cn(
            "inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors duration-200 motion-reduce:transition-none",
            view === id ? "bg-indigo-600 text-white" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}
