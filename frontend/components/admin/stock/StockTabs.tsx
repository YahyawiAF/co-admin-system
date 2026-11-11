"use client";

import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ClipboardCheck, HandCoins, Info, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListPager, usePaged } from "@/components/ui/list-pager";
import { cn } from "@/lib/utils";
import {
  stockApi,
  type StockItemRow,
  type StockLossRow,
  type StockPurchaseRow,
  type StockOverview,
  type StockProductRow,
} from "@/lib/api/resources";
import { Bar, SOURCE_LABEL, StatusPill, buyUnit, dt, dt3, qty, signedDt } from "./stock-ui";

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
              <span className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-indigo-200 py-1.5 text-xs font-semibold text-indigo-700 transition-colors duration-200 group-hover:border-indigo-400 group-hover:bg-indigo-50 dark:border-indigo-900 dark:text-indigo-300 dark:group-hover:bg-indigo-950/40">
                <Pencil className="h-3 w-3" />
                {p.recipe.length && !unit ? "Modifier le produit et sa recette" : "Modifier le produit / ajouter une recette"}
              </span>
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

// ---------- Ingrédients ----------

export function IngredientsTab({
  overview,
  onCount,
  onBuy,
  onEdit,
  onWhy,
}: {
  overview: StockOverview;
  onCount: (i: StockItemRow) => void;
  onBuy: (i: StockItemRow) => void;
  onEdit: (i: StockItemRow) => void;
  /** ⓘ how the average cost is computed */
  onWhy: (itemId: string) => void;
}) {
  const paged = usePaged(overview.items);
  if (!overview.items.length) {
    return <Empty>Aucun ingrédient. Clique sur « + Ingrédient » en haut : café grain, lait, gobelets, sucre…</Empty>;
  }
  return (
    <div>
      <div className={grid}>
        {paged.pageItems.map((it, i) => {
          const lot = it.currentLot;
          const pct = lot ? (lot.left / lot.quantity) * 100 : 0;
          const bu = buyUnit(it.unit);
          const { className, style } = enter(i);
          return (
            <div key={it.id} style={style} className={cn(className, "rounded-2xl border bg-card p-4")}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-bold">{it.name}</p>
                    {it.kind === "UNIT" ? <StatusPill tone="muted">à l’unité</StatusPill> : null}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {it.usedBy.length ? `Sert à : ${it.usedBy.join(", ")}` : "Dans aucune recette"}
                  </p>
                </div>
                <div className="text-right">
                  <p key={it.left} className="animate-in fade-in-0 text-lg font-black tabular-nums duration-200 motion-reduce:animate-none">
                    {qty(it.left, it.unit)}
                  </p>
                  <p className="flex items-center justify-end gap-0.5 text-[11px] text-muted-foreground">
                    {it.hasLots ? `moy. ${dt3(it.unitCost * bu.factor)} / ${bu.label}` : "pas d’achat"}
                    {it.hasLots ? (
                      <button
                        type="button"
                        aria-label={`Calcul du coût moyen de ${it.name}`}
                        onClick={() => onWhy(it.id)}
                        className="rounded-full p-0.5 text-indigo-600 transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                      >
                        <Info className="h-3 w-3" />
                      </button>
                    ) : null}
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <Bar pct={pct} className={pct <= 0 ? "bg-rose-500" : pct < 35 ? "bg-amber-500" : "bg-emerald-500"} />
              </div>
              <div className="mt-1.5 flex justify-between gap-2 text-xs text-muted-foreground">
                <span className="truncate">
                  {lot ? `Lot du ${day(lot.purchaseDate)} : ${qty(lot.left, it.unit)} / ${qty(lot.quantity, it.unit)}` : it.hasLots ? "Tout est utilisé" : "Aucun lot"}
                </span>
                <span className={cn("shrink-0", it.daysLeft != null && it.daysLeft < 7 && "font-bold text-amber-700")}>
                  {it.daysLeft != null && it.left > 0 ? `~${Math.max(1, Math.round(it.daysLeft))} j` : ""}
                </span>
              </div>
              {it.hasLots && it.left > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Valeur en stock : <b className="tabular-nums text-foreground">{dt(it.left * it.unitCost)}</b>
                </p>
              ) : null}
              {it.reserve > 0 ? (
                <p className="mt-1 text-xs font-semibold text-indigo-600">+ {qty(it.reserve, it.unit)} en réserve (lot suivant)</p>
              ) : null}
              {it.uncovered > 0 ? (
                <p className="mt-1 text-xs font-semibold text-rose-600">{qty(it.uncovered, it.unit)} vendus sans stock enregistré</p>
              ) : null}
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 rounded-xl" disabled={!it.hasLots} onClick={() => onCount(it)}>
                  <ClipboardCheck className="h-3.5 w-3.5" /> Compter
                </Button>
                <Button size="sm" className="flex-1 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => onBuy(it)}>
                  <Plus className="h-3.5 w-3.5" /> Acheter
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Modifier" onClick={() => onEdit(it)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      <ListPager className="mt-3 rounded-xl border bg-card" page={paged.page} lastPage={paged.lastPage} total={paged.total} onPage={paged.setPage} />
    </div>
  );
}

// ---------- Achats ----------

export function PurchasesTab({
  overview,
  purchases,
  resetKey,
  onChanged,
  onPay,
  onEdit,
}: {
  overview: StockOverview;
  /** Purchases to show (filtered), newest first */
  purchases: StockPurchaseRow[];
  resetKey?: unknown;
  onChanged: () => void;
  onPay: (purchaseId: string) => void;
  onEdit: (t: { purchaseId: string; lotId: string }) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(purchases[0]?.id ?? null);
  const paged = usePaged(purchases, 20, resetKey);
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-3">
        {!purchases.length ? (
          <Empty>Aucun achat ici. Clique sur « Nouvel achat » pour enregistrer un réassort.</Empty>
        ) : (
          paged.pageItems.map((p, i) => (
            <PurchaseCard
              key={p.id}
              p={p}
              index={i}
              first={p.id === overview.purchases[overview.purchases.length - 1]?.id}
              open={openId === p.id}
              onToggle={() => setOpenId(openId === p.id ? null : p.id)}
              onChanged={onChanged}
              onPay={() => onPay(p.id)}
              onEdit={(lotId) => onEdit({ purchaseId: p.id, lotId })}
            />
          ))
        )}
        <ListPager className="rounded-xl border bg-card" page={paged.page} lastPage={paged.lastPage} total={paged.total} onPage={paged.setPage} />
      </div>
      <aside className="space-y-3">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Comment c’est calculé</p>
          <ul className="mt-2 space-y-1.5 text-[13px] text-muted-foreground">
            <li>Chaque article acheté est un <b className="text-foreground">paquet</b>. Les ventes vident le plus ancien d’abord.</li>
            <li>
              Le <b className="text-foreground">coût</b> d’un article = tous ses achats additionnés ÷ la quantité achetée (coût moyen).
            </li>
            <li>Récupéré = la part des ventes qui revient à ce paquet. Récupéré − prix = résultat.</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-[13px] text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200">
          <p className="font-bold">Dans Finance</p>
          <p className="mt-1">
            Chaque achat est une dépense « Achat stock », même pas encore payé (« À payer »). Payer plus tard la déplace au jour du paiement,
            pour le même mois. Supprimer un achat supprime aussi sa dépense.
          </p>
        </div>
      </aside>
    </div>
  );
}

function PurchaseCard({
  p,
  index,
  first,
  open,
  onToggle,
  onChanged,
  onPay,
  onEdit,
}: {
  p: StockPurchaseRow;
  index: number;
  first: boolean;
  open: boolean;
  onToggle: () => void;
  onChanged: () => void;
  onPay: () => void;
  onEdit: (lotId: string) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const back = p.invested > 0 ? Math.round((p.recovered / p.invested) * 100) : 100;
  const remove = useMutation({
    mutationFn: () => stockApi.removePurchase(p.id),
    onSuccess: () => {
      toast.success(p.dailyExpenseId ? "Achat et dépense supprimés" : "Achat supprimé");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const { className, style } = enter(index);
  return (
    <div style={style} className={cn(className, "rounded-2xl border bg-card")}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 p-4 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold">Achat du {day(p.date)}</p>
            {p.done ? (
              <StatusPill tone="muted">Terminé</StatusPill>
            ) : p.lots.every((l) => l.status === "RESERVE") ? (
              <StatusPill tone="warn">En réserve</StatusPill>
            ) : (
              <StatusPill tone="info">En cours</StatusPill>
            )}
            {first ? <StatusPill tone="violet">Premier investissement</StatusPill> : null}
            {p.paid === false ? <StatusPill tone="warn">À payer</StatusPill> : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {p.lots.map((l) => `${l.itemName} ${qty(l.quantity, l.unit)}`).join(" · ")}
            {p.supplier ? ` · ${p.supplier}` : ""}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4 text-right">
          <Money label="Investi" value={dt(p.invested)} />
          <Money label="Récupéré" value={dt(p.recovered)} />
          <Money label="Résultat" value={signedDt(p.result)} tone={p.result >= 0 ? "good" : "bad"} />
        </div>
        <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform duration-300 motion-reduce:transition-none", open && "rotate-180")} />
        <div className="w-full">
          <Bar pct={back} className={p.result >= 0 ? "bg-emerald-500" : "bg-amber-500"} />
          <p className="mt-1 text-[11px] text-muted-foreground">
            {p.result >= 0 ? `Rentabilisé · ${back} % de l’investissement revenu` : `Pas encore rentabilisé · ${back} % revenu`} ·{" "}
            {p.source === "NONE"
              ? "stock de départ, pas de dépense"
              : p.paid === false
                ? "dépense comptée, pas encore payé"
                : `dépense ${SOURCE_LABEL[p.source]} ✓${p.paidAt ? ` (payé le ${day(p.paidAt)})` : ""}`}
          </p>
        </div>
      </button>
      <div className={cn("grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden" inert={!open}>
          <div className="overflow-x-auto border-t px-4 pb-3">
            <table className="mt-2 w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase text-muted-foreground">
                  <th className="py-2 font-bold">Article</th>
                  <th className="font-bold">Prix</th>
                  <th className="w-40 font-bold">Utilisé</th>
                  <th className="text-right font-bold">Récupéré</th>
                  <th className="text-right font-bold">Résultat</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {p.lots.map((l) => {
                  const used = l.quantity > 0 ? (l.used / l.quantity) * 100 : 0;
                  const note =
                    l.status === "DONE"
                      ? `Fini${l.finishedAt ? ` le ${day(l.finishedAt)}` : ""}`
                      : l.status === "RESERVE"
                        ? "En réserve, démarre après le lot actuel"
                        : `Reste ${qty(l.left, l.unit)}`;
                  return (
                    <tr key={l.id} className="border-t">
                      <td className="py-2">
                        <p className="font-semibold">
                          {l.itemName} · {qty(l.quantity, l.unit)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{note}</p>
                      </td>
                      <td className="tabular-nums">{dt(l.price)}</td>
                      <td>
                        <div className="pr-4">
                          <Bar pct={used} className={l.status === "DONE" ? "bg-slate-400" : "bg-indigo-500"} />
                        </div>
                        <p className="text-[11px] tabular-nums text-muted-foreground">{Math.round(used)} %</p>
                      </td>
                      <td className="text-right tabular-nums">{dt(l.recovered)}</td>
                      <td className={cn("text-right font-bold tabular-nums", l.result >= 0 ? "text-emerald-600" : "text-rose-600")}>{signedDt(l.result)}</td>
                      <td className="pl-2 text-right">
                        <Button size="sm" variant="outline" className="h-7 rounded-lg px-2 text-xs" onClick={() => onEdit(l.id)}>
                          <Pencil className="h-3 w-3" /> Corriger
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">{p.note ?? ""}</p>
              <span className="flex-1" />
              {p.paid === false ? (
                <Button size="sm" className="rounded-lg bg-emerald-600 font-bold text-white hover:bg-emerald-700" onClick={onPay}>
                  <HandCoins className="h-3.5 w-3.5" /> Payer
                </Button>
              ) : null}
              {confirm ? (
                <div className="flex animate-in fade-in-0 items-center gap-2 duration-150">
                  <span className="text-xs text-rose-600">{p.dailyExpenseId ? "Supprimer l’achat et sa dépense ?" : "Supprimer l’achat ?"}</span>
                  <Button size="sm" variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate()}>
                    Oui
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
                    Non
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => setConfirm(true)}>
                  <Trash2 className="h-3.5 w-3.5" /> Supprimer
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Money({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase text-muted-foreground">{label}</p>
      <p className={cn("font-black tabular-nums", tone === "good" && "text-emerald-600", tone === "bad" && "text-rose-600")}>{value}</p>
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
