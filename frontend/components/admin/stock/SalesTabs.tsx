"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Info } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ListPager, usePaged } from "@/components/ui/list-pager";
import { cn } from "@/lib/utils";
import type { StockLotRow, StockOverview, StockProductMonth, StockPurchaseRow, StockSales } from "@/lib/api/resources";
import { StatusPill, dt, qty, signedDt } from "./stock-ui";

const monthLabel = (k: string, short = false) => format(new Date(`${k}-15T12:00:00`), short ? "MMM yy" : "MMMM yyyy", { locale: fr });
const day = (d: string) => format(new Date(d), "d MMM", { locale: fr });
/** Validated categorical order (amber, sky, rose, violet); 5th product and more fold into « autres ». */
const PALETTE = ["#d97706", "#0284c7", "#e11d48", "#7c3aed"];
const chip = (on: boolean) =>
  cn(
    "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-200",
    on ? "border-indigo-600 bg-indigo-600 text-white" : "hover:bg-muted/60",
  );

function Info2({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={title}
        title={title}
        onClick={() => setOpen(true)}
        className="-m-1.5 inline-grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
      >
        <Info className="h-4 w-4" aria-hidden />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm leading-relaxed">{children}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}

const sumMonths = (months: Record<string, StockProductMonth>, keys: string[]) =>
  keys.reduce(
    (a, k) => {
      const m = months[k];
      if (!m) return a;
      return { qty: a.qty + m.qty, revenue: a.revenue + m.revenue, cost: a.cost + m.cost, estimated: a.estimated || m.estimated };
    },
    { qty: 0, revenue: 0, cost: 0, estimated: false },
  );

// ---------- Revenus & coûts ----------

/** Sales, cost and margin of each product, for a month or 12 months, and month by month. */
export function RevenueTab({ overview }: { overview: StockOverview }) {
  const sales: StockSales = overview.sales ?? { months: [], products: [], purchasesByMonth: {} };
  const months = sales.months;
  const current = months[months.length - 1];
  const [period, setPeriod] = useState<string>(current ?? "all");
  const [view, setView] = useState<"produit" | "mois">("produit");
  const [sort, setSort] = useState<"margin" | "revenue" | "qty">("margin");
  const [open, setOpen] = useState<string | null>(null);
  const keys = period === "all" ? months : [period];

  const rows = useMemo(
    () =>
      sales.products
        .map((p) => ({ p, t: sumMonths(p.months, keys) }))
        .filter((r) => r.t.qty > 0)
        .sort((a, b) =>
          sort === "qty" ? b.t.qty - a.t.qty : sort === "revenue" ? b.t.revenue - a.t.revenue : b.t.revenue - b.t.cost - (a.t.revenue - a.t.cost),
        ),
    [sales.products, keys, sort], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const paged = usePaged(rows, 20, `${period}-${sort}`);
  const tot = rows.reduce((a, r) => ({ qty: a.qty + r.t.qty, revenue: a.revenue + r.t.revenue, cost: a.cost + r.t.cost }), { qty: 0, revenue: 0, cost: 0 });
  const bought = keys.reduce((a, k) => a + (sales.purchasesByMonth[k] ?? 0), 0);
  const maxMargin = Math.max(1, ...rows.map((r) => r.t.revenue - r.t.cost));
  const shown = months.slice(-6);
  const sel = sales.products.find((p) => p.id === open);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {[...months.slice(-3)].map((k) => (
            <button key={k} type="button" className={chip(period === k)} onClick={() => setPeriod(k)}>
              <span className="capitalize">{monthLabel(k)}</span>
            </button>
          ))}
          <button type="button" className={chip(period === "all")} onClick={() => setPeriod("all")}>
            12 mois
          </button>
        </div>
        <div className="inline-flex rounded-xl bg-muted p-1 text-sm">
          {(
            [
              ["produit", "Par produit"],
              ["mois", "Mois par mois"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setView(k)}
              className={cn("rounded-lg px-3 py-1.5 font-semibold transition-[background-color,color] duration-200", view === k ? "bg-background shadow-sm" : "text-muted-foreground")}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <Kpi label="Ventes" value={dt(tot.revenue)} hint={`${tot.qty} articles`} />
        <Kpi label="Achats payés" value={dt(bought)} hint="dans Dépenses" tone="bad" />
        <Kpi
          label="Coût de ce qui est vendu"
          value={dt(tot.cost)}
          hint="recettes × prix des paquets"
          info={
            <Info2 title="Comment le coût est calculé">
              <p><b>Achats payés</b> = l’argent sorti pour acheter (1 kg de café, un pack d’eau…). C’est une dépense du jour de l’achat.</p>
              <p><b>Coût de ce qui est vendu</b> = pour chaque article vendu, sa recette × le prix du paquet utilisé (le plus ancien d’abord).</p>
              <div className="rounded-xl bg-muted/60 px-4 py-3 tabular-nums">1 kg de café à 42 DT → 0,042 DT le gramme<br />Express = 8 g (0,34) + gobelet + sucre</div>
              <p>Ce qui est acheté mais pas encore vendu n’est pas une perte : c’est le stock restant.</p>
              <p>Produits sans recette (à l’unité, non suivis) : coût = prix d’achat × quantité, marqué « estimé ».</p>
            </Info2>
          }
        />
        <Kpi label="Marge" value={dt(tot.revenue - tot.cost)} hint={tot.revenue ? `${Math.round(((tot.revenue - tot.cost) / tot.revenue) * 100)} % des ventes` : "—"} tone="good" />
        <Kpi label="Stock restant" value={dt(overview.totals.stockValue)} hint="acheté, pas encore vendu" />
      </div>

      {view === "produit" ? (
        <div key="p" className="animate-in fade-in-0 rounded-2xl border bg-card p-3 duration-300 motion-reduce:animate-none">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-2">
            <span className="text-sm text-muted-foreground">Cliquez un produit pour sa recette et ses mois.</span>
            <div className="flex gap-1.5">
              {(
                [
                  ["margin", "Marge"],
                  ["revenue", "Ventes"],
                  ["qty", "Vendus"],
                ] as const
              ).map(([k, l]) => (
                <button key={k} type="button" className={chip(sort === k)} onClick={() => setSort(k)}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="hidden grid-cols-[minmax(0,2fr)_70px_110px_110px_110px_minmax(0,1.4fr)] gap-3 border-b px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid">
            <span>Produit</span>
            <span>Vendus</span>
            <span>Ventes</span>
            <span>Coût</span>
            <span>Marge</span>
            <span>Part de la marge</span>
          </div>
          {paged.pageItems.map(({ p, t }) => {
            const margin = t.revenue - t.cost;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setOpen(p.id)}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-xl border-b px-2 py-2.5 text-left text-sm tabular-nums transition-colors duration-200 last:border-0 hover:bg-muted/50 md:grid-cols-[minmax(0,2fr)_70px_110px_110px_110px_minmax(0,1.4fr)]"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{p.name}</span>
                  <span className="text-xs text-muted-foreground">
                    vendu {dt(p.sellingPrice)} · coûte {dt(p.unitCost)}
                    {t.estimated ? " · coût estimé" : ""}
                  </span>
                </span>
                <span className="text-right md:text-left">{t.qty}</span>
                <span className="hidden md:block">{dt(t.revenue)}</span>
                <span className="hidden text-rose-700 md:block">{dt(t.cost)}</span>
                <span className="font-bold text-emerald-700">{dt(margin)}</span>
                <span className="flex items-center gap-2">
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-indigo-600 transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${Math.max(0, (margin / maxMargin) * 100)}%` }} />
                  </span>
                  <span className="w-12 text-right text-xs text-muted-foreground">{t.revenue ? `${Math.round((margin / t.revenue) * 100)} %` : "—"}</span>
                </span>
              </button>
            );
          })}
          {!rows.length ? <p className="p-6 text-center text-sm text-muted-foreground">Aucune vente sur cette période.</p> : null}
          <ListPager page={paged.page} lastPage={paged.lastPage} total={paged.total} onPage={paged.setPage} className="px-1" />
        </div>
      ) : (
        <div key="m" className="animate-in fade-in-0 space-y-4 duration-300 motion-reduce:animate-none">
          <MonthBars sales={sales} keys={shown} />
          <div className="overflow-x-auto rounded-2xl border bg-card p-3">
            <table className="w-full min-w-[640px] text-sm tabular-nums">
              <thead>
                <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-2">Produit · ventes / coût</th>
                  {shown.map((k) => (
                    <th key={k} className="py-2 pr-2 capitalize">{monthLabel(k, true)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sales.products.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2 pr-2 font-semibold">{p.name}</td>
                    {shown.map((k) => {
                      const m = p.months[k];
                      return (
                        <td key={k} className="py-2 pr-2">
                          {m ? (
                            <>
                              <div>{dt(m.revenue)}</div>
                              <div className="text-xs text-rose-700">− {dt(m.cost)}</div>
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="font-bold">
                  <td className="py-2 pr-2">Marge</td>
                  {shown.map((k) => {
                    const t = sales.products.reduce((a, p) => a + (p.months[k] ? p.months[k].revenue - p.months[k].cost : 0), 0);
                    return (
                      <td key={k} className="py-2 pr-2 text-emerald-700">{dt(t)}</td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={!!sel} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          {sel ? (
            <>
              <DialogHeader>
                <DialogTitle>{sel.name}</DialogTitle>
              </DialogHeader>
              <ProductDetail p={sel} overview={overview} months={months} />
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductDetail({ p, overview, months }: { p: StockSales["products"][number]; overview: StockOverview; months: string[] }) {
  const row = overview.products.find((x) => x.id === p.id);
  const keys = months.filter((k) => p.months[k]);
  const max = Math.max(1, ...keys.map((k) => p.months[k].qty));
  const margin = p.sellingPrice - p.unitCost;
  // Paquets this product is taking from right now
  const from = (row?.recipe ?? [])
    .map((r) => overview.items.find((i) => i.id === r.stockItemId))
    .filter((i): i is NonNullable<typeof i> => !!i?.currentLot);
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="space-y-2 text-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{row?.recipe.length ? "Recette (1 article)" : "Acheté à l’unité"}</div>
        {(row?.recipe ?? []).map((r) => (
          <div key={r.stockItemId} className="flex justify-between gap-2 border-b py-1.5 tabular-nums">
            <span>{r.itemName}</span>
            <span className="text-muted-foreground">{qty(r.quantity, r.unit)}</span>
            <span className="font-semibold">{dt(r.cost)}</span>
          </div>
        ))}
        <div className="grid grid-cols-[1fr_auto] gap-1 pt-1 font-semibold tabular-nums">
          <span>Coût d’un article</span>
          <span>{dt(p.unitCost)}</span>
          <span>Prix de vente</span>
          <span>{dt(p.sellingPrice)}</span>
          <span className="text-emerald-700">Marge par article</span>
          <span className="text-emerald-700">
            {dt(margin)} · {p.sellingPrice ? Math.round((margin / p.sellingPrice) * 100) : 0} %
          </span>
        </div>
        {from.length ? (
          <>
            <div className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pris en ce moment dans</div>
            {from.map((i) => (
              <div key={i.id} className="rounded-lg bg-muted/60 px-3 py-1.5 text-xs">
                {i.name} · paquet du {day(i.currentLot!.purchaseDate)} · reste {qty(i.currentLot!.left, i.unit)}
              </div>
            ))}
          </>
        ) : null}
      </div>
      <div className="space-y-2 text-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mois par mois</div>
        <div className="grid grid-cols-[1.2fr_0.6fr_1fr_1fr_1fr] gap-x-2 gap-y-1 tabular-nums">
          <span className="text-xs text-muted-foreground">Mois</span>
          <span className="text-xs text-muted-foreground">Vendus</span>
          <span className="text-xs text-muted-foreground">Ventes</span>
          <span className="text-xs text-muted-foreground">Coût</span>
          <span className="text-xs text-muted-foreground">Marge</span>
          {keys.map((k) => {
            const m = p.months[k];
            return (
              <div key={k} className="contents">
                <span className="font-medium capitalize">{monthLabel(k, true)}</span>
                <span>{m.qty}</span>
                <span>{dt(m.revenue)}</span>
                <span className="text-rose-700">{dt(m.cost)}</span>
                <span className="font-semibold text-emerald-700">{dt(m.revenue - m.cost)}</span>
              </div>
            );
          })}
        </div>
        <div className="flex h-24 items-end gap-2 pt-2">
          {keys.map((k) => (
            <div key={k} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[11px] font-semibold">{p.months[k].qty}</span>
              <div className="w-full max-w-10 rounded-t bg-indigo-600 transition-[height] duration-500 motion-reduce:transition-none" style={{ height: `${(p.months[k].qty / max) * 64}px` }} />
              <span className="text-[10px] capitalize text-muted-foreground">{monthLabel(k, true)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MonthBars({ sales, keys }: { sales: StockSales; keys: string[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const rev = (k: string) => sales.products.reduce((a, p) => a + (p.months[k]?.revenue ?? 0), 0);
  const buy = (k: string) => sales.purchasesByMonth[k] ?? 0;
  const max = Math.max(1, ...keys.map((k) => Math.max(rev(k), buy(k))));
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="mb-2 min-h-5 text-sm" aria-live="polite">
        {hover ? (
          <>
            <b className="capitalize">{monthLabel(hover)}</b> · ventes {dt(rev(hover))} · achats {dt(buy(hover))}
          </>
        ) : (
          <span className="text-muted-foreground">Ventes et achats chaque mois. Survolez un mois.</span>
        )}
      </div>
      <div className="flex h-40 items-end gap-4" onMouseLeave={() => setHover(null)}>
        {keys.map((k) => (
          <button key={k} type="button" onMouseEnter={() => setHover(k)} onFocus={() => setHover(k)} className="flex h-full flex-1 flex-col justify-end">
            <div className="flex items-end justify-center gap-[2px]">
              <div className="w-1/3 max-w-8 rounded-t-[4px] bg-indigo-600 transition-[height] duration-500 motion-reduce:transition-none" style={{ height: `${(rev(k) / max) * 140}px` }} />
              <div className="w-1/3 max-w-8 rounded-t-[4px] bg-amber-500 transition-[height] duration-500 motion-reduce:transition-none" style={{ height: `${(buy(k) / max) * 140}px` }} />
            </div>
            <span className="mt-1 text-center text-[11px] capitalize text-muted-foreground">{monthLabel(k, true)}</span>
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-indigo-600" />Ventes</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />Achats payés</span>
      </div>
    </div>
  );
}

function Kpi({ label, value, hint, tone, info }: { label: string; value: string; hint?: string; tone?: "good" | "bad"; info?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-3">
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {info}
      </div>
      <div className={cn("text-lg font-bold tabular-nums", tone === "good" && "text-emerald-700", tone === "bad" && "text-rose-700")}>{value}</div>
      {hint ? <div className="text-[11px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

// ---------- Par paquet ----------

type LotWithPurchase = StockLotRow & { purchaseDate: string };

/** Every purchase is a paquet: what it made until it ran out, what it brought back, the result. */
export function LotsTab({ overview }: { overview: StockOverview }) {
  const withLots = overview.items.filter((i) => i.hasLots);
  const [itemId, setItemId] = useState<string | null>(withLots[0]?.id ?? null);
  const item = overview.items.find((i) => i.id === itemId) ?? withLots[0];
  const lots: LotWithPurchase[] = useMemo(
    () =>
      overview.purchases
        .flatMap((p: StockPurchaseRow) => p.lots.filter((l) => l.stockItemId === item?.id).map((l) => ({ ...l, purchaseDate: p.date })))
        .sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate)),
    [overview.purchases, item?.id],
  );
  const paged = usePaged(lots, 20, item?.id);
  if (!item) return <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">Aucun achat encore. « Nouvel achat » crée le premier paquet.</p>;
  const paid = lots.reduce((a, l) => a + l.price, 0);
  const rec = lots.reduce((a, l) => a + l.recovered, 0);
  const n = lots.length;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Comment un achat devient des produits</h2>
          <Info2 title="Comment un paquet est suivi">
            <p><b>Utilisé</b> = recette × articles vendus. 62 boissons × 8 g = ~500 g : le paquet de 500 g est fini.</p>
            <p><b>Le plus ancien d’abord</b> : si vous achetez avant la fin, le nouveau paquet attend que l’ancien soit vide.</p>
            <p><b>Récupéré</b> = la part du prix de vente qui revient à cet ingrédient, selon son poids dans le coût de la recette.</p>
            <div className="rounded-xl bg-muted/60 px-4 py-3 tabular-nums">Capucin 2,50 DT · coût 0,60 = café 0,34 (56 %) + lait 0,19 (32 %) + gobelet et sucre<br />→ 1,40 DT va au paquet de café, 0,80 DT au paquet de lait</div>
            <p><b>Résultat</b> = récupéré − payé. Un paquet en cours montre « récupéré jusqu’ici ».</p>
            <p><b>Perte</b> : « Compter » (onglet Ingrédients) compare ce qui devrait rester à ce qui reste vraiment. L’écart est une perte.</p>
          </Info2>
        </div>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
          {[
            ["1 · Achat", "1 kg de café à 42 DT = un paquet. La dépense va dans Finance."],
            ["2 · Recette", "Express prend 8 g de café · Capucin 8 g + 120 ml de lait."],
            ["3 · Vente", "Chaque article vendu prend sa dose dans le paquet en cours."],
            ["4 · Paquet fini", "Le suivant commence. On voit ce que le paquet a donné et rapporté."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-xl bg-muted/60 px-3 py-2.5">
              <div className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{t}</div>
              {d}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {withLots.map((i) => (
          <button key={i.id} type="button" className={chip(i.id === item.id)} onClick={() => setItemId(i.id)}>
            {i.name}
          </button>
        ))}
        <span className="ml-2 text-sm text-muted-foreground">
          {n} paquet{n > 1 ? "s" : ""} · payé {dt(paid)} · récupéré {dt(rec)} · résultat {signedDt(rec - paid)}
        </span>
      </div>

      {paged.pageItems.map((l, i) => {
        const index = n - ((paged.page - 1) * 20 + i);
        const open = l.status !== "DONE";
        const started = l.used > 1e-6;
        const res = l.recovered - l.price;
        const gave = l.gave ?? [];
        const top = gave.slice(0, 4);
        const rest = gave.slice(4);
        const totalUnits = gave.reduce((a, g) => a + g.units, 0);
        const lost = l.lost ?? 0;
        return (
          <div
            key={l.id}
            className="animate-in fade-in-0 slide-in-from-bottom-1 space-y-3 rounded-2xl border bg-card p-4 fill-mode-both duration-300 motion-reduce:animate-none"
            style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold">
                  Paquet {index} · {qty(l.quantity, l.unit)} · {dt(l.price)}
                </div>
                <div className="text-xs text-muted-foreground">
                  acheté le {day(l.purchaseDate)}
                  {l.status === "DONE" && l.finishedAt ? ` · fini le ${day(l.finishedAt)} · a duré ${l.days ?? "?"} jours` : started ? ` · ouvert depuis ${l.days ?? "?"} jours` : ""}
                </div>
              </div>
              <StatusPill tone={l.status === "DONE" ? "muted" : l.status === "OPEN" ? "ok" : "info"}>
                {l.status === "DONE" ? "fini" : l.status === "OPEN" ? (l.endsAround ? `en cours · fini vers le ${day(l.endsAround)}` : "en cours") : "pas encore ouvert"}
              </StatusPill>
            </div>
            <div>
              <div className="flex h-3 gap-[2px] overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-indigo-600 transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${((l.sold ?? l.used) / (l.quantity || 1)) * 100}%` }} />
                {lost > 0 ? <div className="h-full bg-rose-600" style={{ width: `${(lost / (l.quantity || 1)) * 100}%` }} /> : null}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-indigo-600" />vendu {qty(l.sold ?? l.used, l.unit)}</span>
                {lost > 0 ? <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-rose-600" />perdu {qty(lost, l.unit)}</span> : null}
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border bg-muted" />reste {qty(l.left, l.unit)}</span>
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-xs font-semibold text-muted-foreground">Ce paquet a donné · {Math.round(totalUnits)} article{Math.round(totalUnits) > 1 ? "s" : ""}</div>
              {gave.length ? (
                <>
                  <div className="mb-2 flex h-2 gap-[2px] overflow-hidden rounded-full">
                    {top.map((g, k) => (
                      <div key={g.productId} className="h-full" style={{ width: `${(g.units / totalUnits) * 100}%`, background: PALETTE[k] }} title={g.name} />
                    ))}
                    {rest.length ? <div className="h-full bg-muted-foreground/40" style={{ width: `${(rest.reduce((a, g) => a + g.units, 0) / totalUnits) * 100}%` }} /> : null}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {top.map((g, k) => (
                      <span key={g.productId} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs tabular-nums">
                        <span className="h-2 w-2 rounded-sm" style={{ background: PALETTE[k] }} />
                        <b>{Math.round(g.units)}</b> {g.name} <span className="text-muted-foreground">· {qty(g.quantity, l.unit)}</span>
                      </span>
                    ))}
                    {rest.length ? (
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs">+ {rest.length} autre{rest.length > 1 ? "s" : ""} : {rest.map((g) => `${Math.round(g.units)} ${g.name}`).join(", ")}</span>
                    ) : null}
                  </div>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">rien encore</span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 border-t pt-3 text-sm tabular-nums">
              <div>
                <div className="text-xs text-muted-foreground">Payé</div>
                <div className="font-bold text-rose-700">{dt(l.price)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{open ? "Récupéré jusqu’ici" : "Récupéré"}</div>
                <div className="font-bold">{dt(l.recovered)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Résultat</div>
                <div className={cn("font-bold", res >= 0 ? "text-emerald-700" : open ? "text-amber-700" : "text-rose-700")}>
                  {open && res < 0 ? `il manque ${dt(-res)}` : `${signedDt(res)}${open ? " · remboursé" : ""}`}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <ListPager page={paged.page} lastPage={paged.lastPage} total={paged.total} onPage={paged.setPage} className="px-0" />
    </div>
  );
}
