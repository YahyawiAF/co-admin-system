"use client";

import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CircleAlert, Coffee, Hourglass, Plus, ShoppingBasket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { mobileApi, stockApi, type StockItemRow, type StockProductRow } from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import { GlassChip, dt, signedDt } from "@/components/admin/stock/stock-ui";
import { IngredientsTab, ProductsTab, PurchasesTab } from "@/components/admin/stock/StockTabs";
import { PurchaseDialog } from "@/components/admin/stock/PurchaseDialog";
import { ProductDialog } from "@/components/admin/stock/ProductDialog";
import { CountDialog, ItemDialog } from "@/components/admin/stock/ItemDialogs";

type Tab = "produits" | "ingredients" | "achats";
const TABS: { id: Tab; label: string }[] = [
  { id: "produits", label: "Produits" },
  { id: "ingredients", label: "Ingrédients" },
  { id: "achats", label: "Achats" },
];

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("produits");
  const [buyOpen, setBuyOpen] = useState(false);
  const [buyItem, setBuyItem] = useState<string | null>(null);
  const [product, setProduct] = useState<StockProductRow | null>(null);
  const [productOpen, setProductOpen] = useState(false);
  const [item, setItem] = useState<StockItemRow | null>(null);
  const [itemOpen, setItemOpen] = useState(false);
  const [countItem, setCountItem] = useState<StockItemRow | null>(null);

  const { data: overview, isLoading } = useQuery({
    queryKey: ["stock-overview"],
    queryFn: () => stockApi.overview(),
    refetchInterval: 30_000,
  });
  const { data: pending = [] } = useQuery({
    queryKey: queryKeys.productOrdersPending,
    queryFn: () => mobileApi.pendingOrders(),
    refetchInterval: 8_000,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["stock-overview"] });
    queryClient.invalidateQueries({ queryKey: ["products"] });
  };

  const confirmOrder = useMutation({
    mutationFn: (id: string) => mobileApi.confirmOrder(id),
    onSuccess: () => {
      toast.success("Commande confirmée");
      queryClient.invalidateQueries({ queryKey: queryKeys.productOrdersPending });
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const rejectOrder = useMutation({
    mutationFn: (id: string) => mobileApi.rejectOrder(id),
    onSuccess: () => {
      toast.message("Commande refusée");
      queryClient.invalidateQueries({ queryKey: queryKeys.productOrdersPending });
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const t = overview?.totals;
  const counts: Record<Tab, number> = {
    produits: overview?.products.length ?? 0,
    ingredients: overview?.items.length ?? 0,
    achats: overview?.purchases.length ?? 0,
  };
  type Alert = { id: string; tone: "bad" | "warn"; text: string };
  const alerts = (overview?.items ?? []).flatMap((i): Alert[] => {
    if (!i.hasLots) return [];
    if (i.left <= 0) return [{ id: i.id, tone: "bad", text: `${i.name} : rupture, à racheter` }];
    if (i.daysLeft != null && i.daysLeft < 7)
      return [{ id: i.id, tone: "warn", text: `${i.name} : fini dans ~${Math.max(1, Math.round(i.daysLeft))} j` }];
    return [];
  });
  const notSetUp = overview && !overview.items.length;

  return (
    <div className="space-y-4">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 px-5 py-5 text-white shadow-sm sm:px-6">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10" />
          <div className="absolute -bottom-16 left-1/3 h-36 w-36 rounded-full bg-white/10" />
        </div>
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-100">
              Café
              {t?.firstPurchaseDate
                ? ` · depuis le premier achat (${format(new Date(t.firstPurchaseDate), "d MMM yyyy", { locale: fr })})`
                : ""}
            </p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold">
              <Coffee className="h-6 w-6" />
              Produits &amp; stock
            </h1>
            <p className="mt-1 text-[13px] text-indigo-100">Ce que tu as investi, ce que les ventes ont rapporté, et ce qu’il reste.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              className="rounded-xl bg-white/15 font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/25"
              onClick={() => {
                if (tab === "ingredients") {
                  setItem(null);
                  setItemOpen(true);
                } else {
                  setProduct(null);
                  setProductOpen(true);
                }
              }}
            >
              <Plus className="h-4 w-4" />
              {tab === "ingredients" ? "Ingrédient" : "Produit"}
            </Button>
            <Button
              className="rounded-xl bg-white font-bold text-indigo-700 shadow-lg transition-transform duration-150 hover:-translate-y-0.5 hover:bg-white motion-reduce:hover:translate-y-0"
              disabled={!overview}
              onClick={() => {
                setBuyItem(null);
                setBuyOpen(true);
              }}
            >
              <ShoppingBasket className="h-4 w-4" />
              Nouvel achat
            </Button>
          </div>
        </div>
        <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {t ? (
            <>
              <GlassChip label="Investi" value={dt(t.invested)} hint={`${t.purchases} achat${t.purchases > 1 ? "s" : ""}`} />
              <GlassChip label="Ventes" value={dt(t.recovered)} hint="part des ventes qui rembourse le stock" />
              <GlassChip
                label="Résultat"
                value={<span className={t.result >= 0 ? "text-emerald-200" : "text-rose-200"}>{signedDt(t.result)}</span>}
                hint="ventes − investi"
              />
              <GlassChip label="Stock restant" value={dt(t.stockValue)} hint={t.losses ? `pertes ${dt(t.losses)}` : "encore à vendre"} />
            </>
          ) : (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[70px] rounded-2xl bg-white/15" />)
          )}
        </div>
      </section>

      {notSetUp ? (
        <div className="animate-in fade-in-0 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900 duration-300 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200">
          <p className="font-bold">Pour commencer</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5">
            <li>Onglet Ingrédients → « + Ingrédient » : café grain, lait, gobelets… avec ce qu’il te reste aujourd’hui.</li>
            <li>Clique sur chaque produit → « Recette » (Express = 8 g café + 1 gobelet) ou « À l’unité » (eau, canette).</li>
            <li>À chaque réassort : « Nouvel achat ». La dépense va dans Finance toute seule.</li>
          </ol>
        </div>
      ) : null}

      {alerts.length ? (
        <div className="flex flex-wrap gap-2">
          {alerts.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                setBuyItem(a.id);
                setBuyOpen(true);
              }}
              className={cn(
                "inline-flex animate-in fade-in-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors duration-200",
                a.tone === "bad"
                  ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
                  : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
              )}
            >
              {a.tone === "bad" ? <CircleAlert className="h-3.5 w-3.5" /> : <Hourglass className="h-3.5 w-3.5" />}
              {a.text}
            </button>
          ))}
        </div>
      ) : null}

      {pending.length ? (
        <div className="animate-in fade-in-0 slide-in-from-top-1 rounded-2xl border bg-card p-4 duration-300">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Commandes en attente</p>
            <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-bold text-white">{pending.length}</span>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {pending.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {o.memberName || "Visiteur"}
                    {o.visitorNumber ? ` #${o.visitorNumber}` : ""}
                  </p>
                  <p className="text-muted-foreground">
                    {o.quantity}× {o.productName} · {o.amount.toFixed(2)} DT
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={rejectOrder.isPending} onClick={() => rejectOrder.mutate(o.id)}>
                    Refuser
                  </Button>
                  <Button size="sm" disabled={confirmOrder.isPending} onClick={() => confirmOrder.mutate(o.id)}>
                    Confirmer
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2" role="tablist">
        {TABS.map((x) => {
          const on = tab === x.id;
          return (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(x.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-all duration-200 motion-reduce:transition-none",
                on ? "border-indigo-600 bg-indigo-600 text-white shadow-md" : "bg-card text-muted-foreground hover:border-indigo-300"
              )}
            >
              {x.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] tabular-nums transition-colors duration-200",
                  on ? "bg-white/20" : "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                )}
              >
                {counts[x.id]}
              </span>
            </button>
          );
        })}
      </div>

      {isLoading || !overview ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div key={tab} className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300 motion-reduce:animate-none">
          {tab === "produits" ? (
            <ProductsTab
              overview={overview}
              onOpen={(p) => {
                setProduct(p);
                setProductOpen(true);
              }}
            />
          ) : tab === "ingredients" ? (
            <IngredientsTab
              overview={overview}
              onCount={setCountItem}
              onBuy={(i) => {
                setBuyItem(i.id);
                setBuyOpen(true);
              }}
              onEdit={(i) => {
                setItem(i);
                setItemOpen(true);
              }}
            />
          ) : (
            <PurchasesTab overview={overview} onChanged={refresh} />
          )}
        </div>
      )}

      {overview ? (
        <>
          <PurchaseDialog open={buyOpen} onOpenChange={setBuyOpen} overview={overview} preselect={buyItem} onDone={refresh} />
          <ProductDialog open={productOpen} onOpenChange={setProductOpen} product={product} overview={overview} onDone={refresh} />
        </>
      ) : null}
      <ItemDialog open={itemOpen} onOpenChange={setItemOpen} item={item} onDone={refresh} />
      <CountDialog open={!!countItem} onOpenChange={(o) => !o && setCountItem(null)} item={countItem} onDone={refresh} />
    </div>
  );
}
