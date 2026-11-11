"use client";

import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { ListPager, usePaged } from "@/components/ui/list-pager";
import { cn } from "@/lib/utils";
import {
  stockApi,
  type StockLossRow,
  type StockOverview,
  type StockProductRow,
} from "@/lib/api/resources";
import { StatusPill, dt, dt3, qty } from "./stock-ui";

const NO_CATEGORY = "__none__";

const day = (d: string) => format(new Date(d), "d MMM", { locale: fr });
const grid = "grid gap-3 sm:grid-cols-2 xl:grid-cols-3";
/** Light stagger on cards that mount */
const enter = (i: number) => ({
  className: "animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both duration-300 motion-reduce:animate-none",
  style: { animationDelay: `${Math.min(i, 8) * 35}ms` },
});

// ---------- Produits ----------

export function ProductsTab({ overview, onOpen }: { overview: StockOverview; onOpen: (p: StockProductRow) => void }) {
  const [cat, setCat] = useState<string | null>(null);
  // Categories actually used, with how many products each
  const cats = new Map<string, { label: string; n: number }>();
  for (const p of overview.products) {
    const label = p.category?.trim() || "";
    const key = label ? label.toLowerCase() : NO_CATEGORY;
    const c = cats.get(key) ?? { label: label || "Sans catégorie", n: 0 };
    c.n++;
    cats.set(key, c);
  }
  const filtered = cat
    ? overview.products.filter((p) => (p.category?.trim().toLowerCase() || NO_CATEGORY) === cat)
    : overview.products;
  const paged = usePaged(filtered, undefined, cat);
  if (!overview.products.length) {
    return <Empty>Aucun produit. Clique sur « + Produit » pour créer ton premier.</Empty>;
  }
  const chips: { key: string | null; label: string; n: number }[] = [
    { key: null, label: "Tous", n: overview.products.length },
    ...[...cats.entries()]
      .sort(([a], [b]) => (a === NO_CATEGORY ? 1 : b === NO_CATEGORY ? -1 : a.localeCompare(b)))
      .map(([key, c]) => ({ key, ...c })),
  ];
  return (
    <div>
      {cats.size > 1 || !cats.has(NO_CATEGORY) ? (
        <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Catégories">
          {chips.map((c) => {
            const on = cat === c.key;
            return (
              <button
                key={c.key ?? "all"}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setCat(c.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-200 motion-reduce:transition-none",
                  on ? "border-violet-600 bg-violet-600 text-white shadow-sm" : "bg-card text-muted-foreground hover:border-violet-300"
                )}
              >
                {c.label}
                <span className={cn("rounded-full px-1.5 tabular-nums transition-colors duration-200", on ? "bg-white/20" : "bg-muted")}>{c.n}</span>
              </button>
            );
          })}
        </div>
      ) : null}
      <div key={cat ?? "all"} className={grid}>
        {paged.pageItems.map((p, i) => {
          const margin = p.sellingPrice - p.unitCost;
          const pct = p.sellingPrice > 0 ? Math.round((margin / p.sellingPrice) * 100) : 0;
          const n = p.tracked ? p.possible : p.stock;
          const unit = p.recipe.length === 1 && p.recipe[0].kind === "UNIT";
          const { className, style } = enter(i);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onOpen(p)}
              style={style}
              className={cn(
                className,
                "group rounded-2xl border bg-card p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-500/10 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              )}
            >
              <div className="flex items-start gap-3">
                {p.img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.img} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm font-black text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                    {p.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-base font-bold">{p.name}</span>
                    {p.category ? (
                      <span className="shrink-0 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                        {p.category}
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {!p.tracked ? "Stock à la main" : unit ? "Acheté à l’unité" : p.recipe.map((r) => r.itemName).join(" · ")}
                  </p>
                </div>
                {n <= 0 ? (
                  <StatusPill tone="bad">Rupture</StatusPill>
                ) : n < 20 ? (
                  <StatusPill tone="warn">Bientôt fini</StatusPill>
                ) : (
                  <StatusPill tone="ok">OK</StatusPill>
                )}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Stat label="Vente" value={dt3(p.sellingPrice).replace(" DT", "")} />
                <Stat label="Coût" value={dt3(p.unitCost).replace(" DT", "")} />
                <Stat label="Marge" value={`${dt3(margin).replace(" DT", "")}`} hint={`${pct} %`} tone={margin >= 0 ? "good" : "bad"} />
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{p.tracked ? "Encore possible" : "En stock"}</span>
                <span className="font-black tabular-nums">{n}</span>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {!p.tracked
                  ? "Ajoute une recette pour suivre le coût réel"
                  : p.limitedBy && !unit
                    ? <>Limité par : <b className="text-foreground">{p.limitedBy}</b></>
                    : " "}
              </p>
            </button>
          );
        })}
      </div>
      <ListPager className="mt-3 rounded-xl border bg-card" page={paged.page} lastPage={paged.lastPage} total={paged.total} onPage={paged.setPage} />
      <p className="mt-3 text-xs text-muted-foreground">
        Le coût vient du coût moyen de chaque ingrédient (tous ses achats ÷ la quantité achetée). « Encore possible » se recalcule à chaque vente et chaque achat.
      </p>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "bad" }) {
  return (
    <div
      className={cn(
        "rounded-xl py-2",
        tone === "good" ? "bg-emerald-50 dark:bg-emerald-950/40" : tone === "bad" ? "bg-rose-50 dark:bg-rose-950/40" : "bg-muted/60"
      )}
    >
      <p
        className={cn(
          "text-[10px] font-bold uppercase",
          tone === "good" ? "text-emerald-700 dark:text-emerald-300" : tone === "bad" ? "text-rose-700" : "text-muted-foreground"
        )}
      >
        {label}
      </p>
      <p className={cn("text-sm font-black tabular-nums", tone === "good" && "text-emerald-700 dark:text-emerald-300", tone === "bad" && "text-rose-700")}>
        {value} {hint ? <span className="text-[11px]">{hint}</span> : null}
      </p>
    </div>
  );
}

// ---------- Corrections ----------

const REASON_LABEL: Record<string, string> = {
  CASSE: "Casse / perte",
  VENTE_OUBLIEE: "Vente oubliée",
  ERREUR: "Erreur de saisie",
  AUTRE: "Autre",
};

/** Inventory count corrections, kept (never erased) with their reason. */
export function Losses({ losses, total, onChanged }: { losses: StockLossRow[]; total: number; onChanged: () => void }) {
  const paged = usePaged(losses, 8);
  const remove = useMutation({
    mutationFn: (id: string) => stockApi.removeAdjustment(id),
    onSuccess: () => {
      toast.success("Correction annulée");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Corrections de stock</p>
        <p className="font-black tabular-nums text-rose-600">{dt(total)}</p>
      </div>
      {!losses.length ? (
        <p className="mt-2 text-[13px] text-muted-foreground">Rien pour l’instant. « Compter » un ingrédient pour vérifier.</p>
      ) : (
        <ul className="mt-2 space-y-2 text-[13px]">
          {paged.pageItems.map((l) => (
            <li key={l.id} className="group flex items-center justify-between gap-2">
              <span className="min-w-0">
                <b className="block truncate">
                  {l.itemName} · {l.quantity > 0 ? "−" : "+"}
                  {qty(Math.abs(l.quantity), l.unit)}
                </b>
                <span className="block truncate text-xs text-muted-foreground">
                  {day(l.date)}
                  {l.reason ? ` · ${REASON_LABEL[l.reason] ?? l.reason}` : ""}
                  {l.note ? ` · ${l.note}` : ""}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <span className="tabular-nums text-rose-600">{l.amount ? dt(l.amount) : "—"}</span>
                <button
                  type="button"
                  aria-label="Annuler la correction"
                  className="rounded p-1 text-muted-foreground opacity-0 transition-opacity duration-150 hover:text-rose-600 focus-visible:opacity-100 group-hover:opacity-100"
                  onClick={() => remove.mutate(l.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <ListPager className="-mx-4 -mb-4 mt-3 px-4" page={paged.page} lastPage={paged.lastPage} total={paged.total} onPage={paged.setPage} />
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="animate-in fade-in-0 rounded-2xl border border-dashed bg-card px-4 py-10 text-center text-sm text-muted-foreground duration-300">
      {children}
    </p>
  );
}
