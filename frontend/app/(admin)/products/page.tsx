"use client";

import { useEffect, useState } from "react";
import { useConseilDraft } from "@/lib/hooks/use-conseil-draft";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CircleAlert, Coffee, Hourglass, Plus, ShoppingBasket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { mobileApi, salesApi, stockApi, type SaleFilter, type StockItemRow, type StockProductRow } from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import { GlassChip, dt } from "@/components/admin/stock/stock-ui";
import { ProductDialog } from "@/components/admin/stock/ProductDialog";
import { CountDialog, ItemDialog } from "@/components/admin/stock/ItemDialogs";
import { AchatsTab } from "@/components/admin/stock/AchatsTab";
import { AvgCostDialog, BuyDialog, PayDialog, type BuyTarget } from "@/components/admin/stock/BuyDialogs";
import { SaleDialog, VentesTab, salesKey, type SaleTarget } from "@/components/admin/stock/VentesTab";
import { StockView, type StockSub } from "@/components/admin/stock/StockView";

type Tab = "achats" | "ventes" | "stock";
const TABS: { id: Tab; label: string }[] = [
  { id: "achats", label: "Achats" },
  { id: "ventes", label: "Ventes" },
  { id: "stock", label: "Stock" },
];
const monthKey = () => format(new Date(), "yyyy-MM");

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("achats");
  const [stockSub, setStockSub] = useState<StockSub>("stock");
  const [saleFilter, setSaleFilter] = useState<SaleFilter>("all");
  const [buyOpen, setBuyOpen] = useState(false);
  const [buyItem, setBuyItem] = useState<string | null>(null);
  const [buyEdit, setBuyEdit] = useState<BuyTarget | null>(null);
  const [payId, setPayId] = useState<string | null>(null);
  const [whyItem, setWhyItem] = useState<string | null>(null);
  const [saleTarget, setSaleTarget] = useState<SaleTarget | null>(null);
  const [product, setProduct] = useState<StockProductRow | null>(null);
  const [productOpen, setProductOpen] = useState(false);
  const [item, setItem] = useState<StockItemRow | null>(null);
  const [itemOpen, setItemOpen] = useState(false);
  const [countItem, setCountItem] = useState<StockItemRow | null>(null);
  // Opened from Conseil IA (« Préparer le produit »): name and price ready to check
  const conseil = useConseilDraft("PRODUCT");
  const conseilDraft = conseil.draft as { name?: string; price?: number } | null;
  useEffect(() => {
    if (!conseilDraft) return;
    setProduct(null);
    setProductOpen(true);
  }, [conseilDraft]);

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

  // Unpaid sales total for the hero (same cache as Ventes › Non payées, page 1)
  const { data: unpaidSales } = useQuery({
    queryKey: [...salesKey, "unpaid", 1],
    queryFn: () => salesApi.list("unpaid", 1, 20),
    refetchInterval: 30_000,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["stock-overview"] });
    queryClient.invalidateQueries({ queryKey: ["products"] });
    queryClient.invalidateQueries({ queryKey: salesKey });
  };
  const openBuy = (itemId: string | null) => {
    setBuyEdit(null);
    setBuyItem(itemId);
    setBuyOpen(true);
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
  const mk = monthKey();
  const monthBuys = (overview?.purchases ?? []).filter((p) => format(new Date(p.date), "yyyy-MM") === mk);
  const monthSales = (overview?.sales?.products ?? []).reduce((s, p) => s + (p.months[mk]?.revenue ?? 0), 0);
  const hints: Record<Tab, string> = {
    achats: t?.dueCount ? `${t.dueCount} à payer` : `${overview?.purchases.length ?? 0} achats`,
    ventes: unpaidSales ? `${unpaidSales.totals.unpaidCount} non payées` : "",
    stock: `${overview?.items.length ?? 0} articles`,
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
      <section className="relative overflow-clip rounded-2xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 px-5 py-5 text-white shadow-sm sm:px-6">
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
            <p className="mt-1 text-[13px] text-indigo-100">Ce que tu achètes, ce que tu vends, ce qu’il reste.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              className="rounded-xl bg-white/15 font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/25"
              disabled={!overview}
              onClick={() => setSaleTarget({ productId: null })}
            >
              <Plus className="h-4 w-4" />
              Vente oubliée
            </Button>
            <Button
              className="rounded-xl bg-white font-bold text-indigo-700 shadow-lg transition-transform duration-150 hover:-translate-y-0.5 hover:bg-white motion-reduce:hover:translate-y-0"
              disabled={!overview}
              onClick={() => openBuy(null)}
            >
              <ShoppingBasket className="h-4 w-4" />
              Nouvel achat
            </Button>
          </div>
        </div>
        <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {t ? (
            <>
              <HeroChip onClick={() => setTab("achats")}>
                <GlassChip
                  label={`Achats de ${format(new Date(), "MMMM", { locale: fr })}`}
                  value={dt(monthBuys.reduce((s, p) => s + p.invested, 0))}
                  hint={`${monthBuys.length} achat${monthBuys.length > 1 ? "s" : ""}, payés ou non`}
                />
              </HeroChip>
              <HeroChip onClick={() => setTab("achats")}>
                <GlassChip
                  label="À payer aux fournisseurs"
                  value={<span className={t.due ? "text-orange-200" : undefined}>{dt(t.due ?? 0)}</span>}
                  hint={t.dueCount ? `${t.dueCount} achat${t.dueCount > 1 ? "s" : ""} pas encore payé${t.dueCount > 1 ? "s" : ""}` : "rien à payer"}
                />
              </HeroChip>
              <HeroChip
                onClick={() => {
                  setSaleFilter("all");
                  setTab("ventes");
                }}
              >
                <GlassChip label={`Ventes de ${format(new Date(), "MMMM", { locale: fr })}`} value={dt(monthSales)} hint="produits vendus ce mois" />
              </HeroChip>
              <HeroChip
                onClick={() => {
                  setSaleFilter("unpaid");
                  setTab("ventes");
                }}
              >
                <GlassChip
                  label="Ventes non payées"
                  value={unpaidSales ? dt(unpaidSales.totals.unpaidAmount) : "…"}
                  hint={unpaidSales ? `${unpaidSales.totals.unpaidCount} à encaisser` : ""}
                />
              </HeroChip>
              <HeroChip
                onClick={() => {
                  setStockSub("stock");
                  setTab("stock");
                }}
              >
                <GlassChip label="Valeur du stock" value={dt(t.stockValue)} hint="au coût moyen" />
              </HeroChip>
            </>
          ) : (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[70px] rounded-2xl bg-white/15" />)
          )}
        </div>
      </section>

      {notSetUp ? (
        <div className="animate-in fade-in-0 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900 duration-300 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200">
          <p className="font-bold">Pour commencer</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5">
            <li>Onglet Stock → « + Article » : café grain, lait, gobelets… avec ce qu’il te reste aujourd’hui.</li>
            <li>Stock › Produits &amp; recettes : clique sur chaque produit → « Recette » (Express = 8 g café + 1 gobelet) ou « À l’unité » (eau, canette).</li>
            <li>À chaque réassort : « Nouvel achat ». La dépense va dans Finance toute seule, même si tu paies plus tard.</li>
          </ol>
        </div>
      ) : null}

      {alerts.length ? (
        <div className="flex flex-wrap gap-2">
          {alerts.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => openBuy(a.id)}
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
                "inline-flex min-h-11 items-center gap-2.5 rounded-2xl border px-5 text-[15px] font-bold transition-all duration-200 motion-reduce:transition-none",
                on ? "border-indigo-600 bg-indigo-600 text-white shadow-md" : "bg-card text-foreground hover:border-indigo-300"
              )}
            >
              {x.label}
              {hints[x.id] ? (
                <span className={cn("text-xs font-semibold transition-colors duration-200", on ? "text-indigo-100" : "text-muted-foreground")}>
                  {hints[x.id]}
                </span>
              ) : null}
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
          {tab === "achats" ? (
            <AchatsTab
              overview={overview}
              onBuy={openBuy}
              onEdit={(target) => {
                setBuyEdit(target);
                setBuyOpen(true);
              }}
              onPay={setPayId}
              onWhy={setWhyItem}
            />
          ) : tab === "ventes" ? (
            <VentesTab filter={saleFilter} onFilter={setSaleFilter} onSale={setSaleTarget} onChanged={refresh} />
          ) : (
            <StockView
              overview={overview}
              sub={stockSub}
              onSub={setStockSub}
              onCount={setCountItem}
              onBuy={openBuy}
              onEditItem={(i) => {
                setItem(i);
                setItemOpen(true);
              }}
              onNewItem={() => {
                setItem(null);
                setItemOpen(true);
              }}
              onWhy={setWhyItem}
              onOpenProduct={(p) => {
                setProduct(p);
                setProductOpen(true);
              }}
              onNewProduct={() => {
                setProduct(null);
                setProductOpen(true);
              }}
              onChanged={refresh}
            />
          )}
        </div>
      )}

      {overview ? (
        <>
          <BuyDialog open={buyOpen} onOpenChange={setBuyOpen} overview={overview} preselect={buyItem} edit={buyEdit} onDone={refresh} />
          <PayDialog purchaseId={payId} overview={overview} onOpenChange={(o) => !o && setPayId(null)} onDone={refresh} />
          <AvgCostDialog itemId={whyItem} overview={overview} onOpenChange={(o) => !o && setWhyItem(null)} />
          <SaleDialog target={saleTarget} overview={overview} onOpenChange={(o) => !o && setSaleTarget(null)} onDone={refresh} />
          <ProductDialog
            open={productOpen}
            onOpenChange={(o) => {
              setProductOpen(o);
              if (!o && conseil.active) conseil.dismiss();
            }}
            product={product}
            overview={overview}
            onDone={refresh}
            draft={product ? null : conseilDraft}
            onCreated={(id) => conseil.active && void conseil.linked(id)}
          />
        </>
      ) : null}
      <ItemDialog open={itemOpen} onOpenChange={setItemOpen} item={item} onDone={refresh} />
      <CountDialog
        open={!!countItem}
        onOpenChange={(o) => !o && setCountItem(null)}
        item={countItem}
        onDone={refresh}
        onForgottenSale={() => {
          const p = overview?.products.find((x) => x.recipe.length === 1 && x.recipe[0].stockItemId === countItem?.id);
          setTab("ventes");
          setSaleTarget({ productId: p?.id ?? null });
        }}
      />
    </div>
  );
}

/** A hero number that opens the tab it comes from */
function HeroChip({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-w-0 rounded-2xl text-left transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      {children}
    </button>
  );
}
