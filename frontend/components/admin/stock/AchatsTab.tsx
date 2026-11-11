"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { HandCoins, Info, Pencil, ShoppingBasket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListPager, usePaged } from "@/components/ui/list-pager";
import { cn } from "@/lib/utils";
import type { StockOverview } from "@/lib/api/resources";
import { allBuys, average, itemBuys, payLabel, perBuyUnit } from "./buys";
import type { BuyTarget } from "./BuyDialogs";
import { StatusPill, dt, qty } from "./stock-ui";

const day = (d: string) => format(new Date(d), "d MMM", { locale: fr });
type Filter = "all" | "due" | "paid";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "due", label: "À payer" },
  { id: "paid", label: "Payés" },
];
const enter = (i: number) => ({
  className: "animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both duration-300 motion-reduce:animate-none",
  style: { animationDelay: `${Math.min(i, 8) * 35}ms` },
});

export function AchatsTab({
  overview,
  onBuy,
  onEdit,
  onPay,
  onWhy,
}: {
  overview: StockOverview;
  onBuy: (itemId: string | null) => void;
  onEdit: (t: BuyTarget) => void;
  onPay: (purchaseId: string) => void;
  onWhy: (itemId: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const buys = useMemo(() => allBuys(overview).sort((a, b) => b.date.localeCompare(a.date)), [overview]);
  const due = overview.purchases.filter((p) => p.paid === false);
  const list = buys.filter((b) => filter === "all" || (filter === "due" ? !b.paid : b.paid));
  const paged = usePaged(list, 20, filter);
  const cards = usePaged(overview.items, 12);

  return (
    <div className="space-y-4">
      {due.length ? (
        <section className="animate-in fade-in-0 space-y-2 rounded-2xl border border-orange-200 bg-orange-50 p-4 duration-300 dark:border-orange-900 dark:bg-orange-950/30">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-base font-extrabold text-orange-800 dark:text-orange-300">À payer · {dt(overview.totals.due ?? 0)}</h2>
            <p className="text-xs text-orange-800/80 dark:text-orange-300/80">
              Déjà comptés en dépense pour le mois de l’achat. « Payer » = dire quand et d’où sort l’argent.
            </p>
          </div>
          {due.map((p, i) => {
            const { className, style } = enter(i);
            return (
              <div
                key={p.id}
                style={style}
                className={cn(className, "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-orange-100 bg-card px-3 py-2.5 text-sm dark:border-orange-900/60")}
              >
                <b>{p.lots.map((l) => l.itemName).join(", ")}</b>
                <span className="text-[13px] text-muted-foreground">
                  {p.lots.map((l) => qty(l.quantity, l.unit)).join(" + ")} · acheté le {day(p.date)}
                  {p.supplier ? ` · ${p.supplier}` : ""}
                </span>
                <span className="flex-1" />
                <b className="tabular-nums">{dt(p.invested)}</b>
                <Button size="sm" className="rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-700" onClick={() => onPay(p.id)}>
                  <HandCoins className="h-3.5 w-3.5" /> Payer
                </Button>
              </div>
            );
          })}
        </section>
      ) : null}

      <section className="rounded-2xl border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-base font-extrabold">Dernier achat de chaque article</h2>
          <p className="text-[13px] text-muted-foreground">Avant de racheter : ce que tu as payé la dernière fois.</p>
        </div>
        {!overview.items.length ? (
          <p className="text-sm text-muted-foreground">Aucun article. Ajoute-les dans l’onglet Stock.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {cards.pageItems.map((it, i) => {
              const hist = itemBuys(overview, it.id);
              const last = hist[hist.length - 1];
              const avg = average(hist);
              const { className, style } = enter(i);
              return (
                <div
                  key={it.id}
                  style={style}
                  className={cn(
                    className,
                    "flex flex-col gap-1.5 rounded-2xl border p-3.5 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate font-bold">{it.name}</p>
                    <StatusPill tone="muted">{it.kind === "UNIT" ? "Vendu tel quel" : "Ingrédient"}</StatusPill>
                  </div>
                  {last ? (
                    <>
                      <Row label="Dernier achat">{day(last.date)}</Row>
                      <Row label="Quantité · prix">
                        {qty(last.quantity, last.unit)} · {dt(last.price)}
                      </Row>
                      <Row label="Prix unitaire">{perBuyUnit(last.price / last.quantity, last.unit)}</Row>
                      <Row label="Fournisseur">{last.supplier || "—"}</Row>
                      <Row label="Paiement">
                        <StatusPill tone={last.paid ? "ok" : "warn"}>{payLabel(last)}</StatusPill>
                      </Row>
                    </>
                  ) : (
                    <p className="py-2 text-[13px] text-muted-foreground">Jamais acheté.</p>
                  )}
                  <div className="mt-1 border-t pt-1.5">
                    <Row
                      label={
                        <span className="inline-flex items-center gap-1">
                          Coût moyen
                          <button
                            type="button"
                            aria-label={`Calcul du coût moyen de ${it.name}`}
                            onClick={() => onWhy(it.id)}
                            className="rounded-full p-0.5 text-indigo-600 transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      }
                    >
                      <span className="text-indigo-700 dark:text-indigo-300">{hist.length ? perBuyUnit(avg.perBase, it.unit) : "—"}</span>
                    </Row>
                    <Row label="En stock">{qty(it.left, it.unit)}</Row>
                  </div>
                  <Button size="sm" className="mt-1 rounded-xl bg-indigo-600 font-bold text-white hover:bg-indigo-700" onClick={() => onBuy(it.id)}>
                    <ShoppingBasket className="h-3.5 w-3.5" /> Racheter
                  </Button>
                </div>
              );
            })}
          </div>
        )}
        <ListPager className="-mx-4 -mb-4 mt-3" page={cards.page} lastPage={cards.lastPage} total={cards.total} onPage={cards.setPage} />
      </section>

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex flex-wrap items-center gap-2 p-4 pb-3">
          <h2 className="text-base font-extrabold">Tous les achats</h2>
          <span className="flex-1" />
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filtrer les achats">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "min-h-8 rounded-full border px-3.5 text-[13px] font-semibold transition-colors duration-200 motion-reduce:transition-none",
                  filter === f.id ? "border-foreground bg-foreground text-background" : "bg-background text-muted-foreground hover:border-indigo-300"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-[13px]">
            <thead className="border-y bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Article</th>
                <th className="px-3 py-2 text-right">Quantité</th>
                <th className="px-3 py-2 text-right">Prix payé</th>
                <th className="px-3 py-2 text-right">Prix unitaire</th>
                <th className="px-3 py-2 text-left">Fournisseur</th>
                <th className="px-3 py-2 text-left">Paiement</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody key={`${filter}-${paged.page}`}>
              {paged.pageItems.map((b, i) => {
                const { className, style } = enter(i);
                return (
                  <tr key={b.lotId} style={style} className={cn(className, "border-b transition-colors last:border-0 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20")}>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{day(b.date)}</td>
                    <td className="px-3 py-2.5 font-bold">{b.itemName}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{qty(b.quantity, b.unit)}</td>
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums">{dt(b.price)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{perBuyUnit(b.price / b.quantity, b.unit)}</td>
                    <td className="px-3 py-2.5">{b.supplier || "—"}</td>
                    <td className="px-3 py-2.5">
                      <StatusPill tone={b.paid ? "ok" : "warn"}>{payLabel(b)}</StatusPill>
                      {b.paidAt ? <span className="ml-1.5 text-[11px] text-muted-foreground">le {day(b.paidAt)}</span> : null}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        {!b.paid ? (
                          <Button size="sm" className="h-8 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => onPay(b.purchaseId)}>
                            Payer
                          </Button>
                        ) : null}
                        <Button size="sm" variant="outline" className="h-8 rounded-lg" onClick={() => onEdit({ purchaseId: b.purchaseId, lotId: b.lotId })}>
                          <Pencil className="h-3.5 w-3.5" /> Corriger
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!list.length ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    {filter === "due" ? "Rien à payer." : "Aucun achat. Clique sur « Nouvel achat »."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <ListPager page={paged.page} lastPage={paged.lastPage} total={paged.total} onPage={paged.setPage} />
      </section>
    </div>
  );
}

function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-bold tabular-nums">{children}</span>
    </div>
  );
}
