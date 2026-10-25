"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Coffee,
  Cookie,
  Loader2,
  Minus,
  Plus,
  Receipt,
  Search,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";
import { loadVisitorCache } from "@/lib/visitorCache";
import { mobileApi } from "@/lib/api/resources";
import { cn } from "@/lib/utils";
import { useRealtime } from "@/lib/realtime/RealtimeProvider";
import { useOrg } from "@/lib/org";
import Link from "next/link";
import { OffersStrip, useMemberPromotions } from "@/components/visitor/VisitorSpotlight";
import { readLocalCache, writeLocalCache } from "@/lib/visitor-local-cache";
import { isDrink } from "@/lib/drinks";
import { dtToPoints } from "@/lib/points-catalog";
import { usePlayer } from "@/lib/hooks/use-player";

type Kind = "drink" | "snack" | "shop";
type Tab = "all" | Kind;

const SNACK_RE =
  /g[aâ]teau|cake|cookie|croissant|snack|sandwich|chips|biscuit|viennoiserie|muffin|brownie|donut|beignet|pain|tarte|cr[eê]pe|gaufre|madeleine|barre|bonbon|pizza|panini|wrap|salade/;
const HOT_RE =
  /caf[eé]|coffee|espresso|express|latte|cappuccino|capucin|nespresso|th[eé]\b|tea|infusion|chocolat chaud/;

function textOf(name: string, desc?: string | null) {
  return `${name} ${desc || ""}`.toLowerCase();
}

function kindOf(name: string, desc?: string | null): Kind {
  // snacks first: isDrink's /eau/ also matches "gâteau"
  if (SNACK_RE.test(textOf(name, desc))) return "snack";
  if (isDrink(name, desc)) return "drink";
  return "shop";
}

const TABS: ReadonlyArray<readonly [Tab, string]> = [
  ["all", "Tout"],
  ["drink", "Boissons"],
  ["snack", "Snacks"],
  ["shop", "Boutique"],
];

const fmt = (n: number) => n.toFixed(2);

export default function CafePage() {
  const queryClient = useQueryClient();
  const { href, slug } = useOrg();
  const { socket } = useRealtime();
  const [memberId, setMemberId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  /** productId → quantity in the cart */
  const [cart, setCart] = useState<Record<string, number>>({});
  const { player, isPwa } = usePlayer(memberId);

  useEffect(() => {
    setMemberId(loadVisitorCache(slug)?.memberId || null);
  }, [slug]);

  useEffect(() => {
    if (!socket) return;
    const refreshOrders = (payload: { memberId?: string; status?: string }) => {
      if (payload?.memberId && memberId && payload.memberId !== memberId) return;
      queryClient.invalidateQueries({ queryKey: ["mobile-orders"] });
      if (payload?.status === "CONFIRMED") {
        toast.success("Votre commande a été confirmée");
      }
    };
    const refreshStock = () => {
      queryClient.invalidateQueries({ queryKey: ["mobile-products", slug] });
    };
    socket.on("product_order", refreshOrders);
    socket.on("product_order_confirmed", refreshOrders);
    socket.on("product_updated", refreshStock);
    socket.on("table_updates", (p: { type?: string }) => {
      if (p?.type === "product_order" || p?.type === "product_updated") {
        refreshStock();
      }
      refreshOrders(p as { memberId?: string; status?: string });
    });
    return () => {
      socket.off("product_order", refreshOrders);
      socket.off("product_order_confirmed", refreshOrders);
      socket.off("product_updated", refreshStock);
      socket.off("table_updates");
    };
  }, [socket, memberId, queryClient, slug]);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["mobile-products", slug],
    queryFn: async () => {
      const data = await mobileApi.products(slug);
      writeLocalCache("products", data, slug);
      return data;
    },
    staleTime: 60_000,
    placeholderData: () => readLocalCache("products", slug) ?? undefined,
  });
  const { data: orders = [] } = useQuery({
    queryKey: ["mobile-orders", memberId],
    queryFn: () => mobileApi.orders(memberId!),
    enabled: !!memberId,
    staleTime: 20_000,
  });

  const { data: promotions = [] } = useMemberPromotions();
  /** productId → live offer (best price) */
  const deals = useMemo(() => {
    const m = new Map<string, (typeof promotions)[number]>();
    for (const p of promotions) {
      if (!p.liveNow || p.target !== "PRODUCT" || !p.productId || p.priceAfter == null) continue;
      const cur = m.get(p.productId);
      if (!cur || p.priceAfter < (cur.priceAfter ?? Infinity)) m.set(p.productId, p);
    }
    return m;
  }, [promotions]);
  const [focusPromo, setFocusPromo] = useState<string | null>(null);
  useEffect(() => {
    setFocusPromo(new URLSearchParams(window.location.search).get("promo"));
  }, []);
  const focusProductId = promotions.find((p) => p.id === focusPromo)?.productId ?? null;
  useEffect(() => {
    if (!focusProductId) return;
    document.getElementById(`product-${focusProductId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusProductId]);

  const priceOf = (p: { id: string; sellingPrice: number }) =>
    deals.get(p.id)?.priceAfter ?? p.sellingPrice;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return products
      .filter((p) => {
        if (tab !== "all" && kindOf(p.name, p.description) !== tab) return false;
        if (needle && !textOf(p.name, p.description).includes(needle)) return false;
        return true;
      })
      .sort((a, b) => Number(deals.has(b.id)) - Number(deals.has(a.id)));
  }, [products, q, tab, deals]);

  /** Cart lines, clamped to the live stock. */
  const lines = useMemo(
    () =>
      products
        .map((p) => ({ product: p, qty: Math.min(cart[p.id] || 0, Math.max(0, p.stock)) }))
        .filter((l) => l.qty > 0),
    [products, cart]
  );
  const itemCount = lines.reduce((n, l) => n + l.qty, 0);
  const total = lines.reduce((s, l) => s + l.qty * priceOf(l.product), 0);

  const setQty = (id: string, next: number, stock: number) => {
    setCart((s) => {
      const v = Math.max(0, Math.min(stock, next));
      const copy = { ...s };
      if (v === 0) delete copy[id];
      else copy[id] = v;
      return copy;
    });
  };

  const add = (p: { id: string; stock: number }) => {
    if (!memberId) {
      toast.message("Connectez-vous depuis l’accueil");
      return;
    }
    setQty(p.id, (cart[p.id] || 0) + 1, p.stock);
  };

  const order = useMutation({
    mutationFn: async () => {
      if (!memberId) throw new Error("Connectez-vous depuis l’accueil");
      let count = 0;
      let amount = 0;
      for (const l of lines) {
        try {
          const res = await mobileApi.order({
            memberId,
            productId: l.product.id,
            quantity: l.qty,
          });
          count += l.qty;
          amount += Number(res.amount) || 0;
          setCart((s) => {
            const copy = { ...s };
            delete copy[l.product.id];
            return copy;
          });
        } catch (e) {
          if (count > 0) {
            toast.success(
              `Commande envoyée · ${count} article${count > 1 ? "s" : ""}`
            );
          }
          throw e;
        }
      }
      return { count, amount };
    },
    onSuccess: ({ count, amount }) => {
      toast.success(
        `Commande envoyée · ${count} article${count > 1 ? "s" : ""} · ${fmt(amount)} DT`
      );
      setCart({});
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["mobile-orders"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-products"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-promotions"] });
      queryClient.invalidateQueries({ queryKey: ["member-points"] });
    },
  });

  const openOrders = orders.filter((o) => o.status !== "CANCELLED");
  const cafeOrders = player?.stats.cafeOrders ?? null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-white px-3.5 shadow-sm ring-1 ring-slate-200 transition-shadow duration-200 focus-within:ring-2 focus-within:ring-indigo-500 motion-reduce:transition-none">
          <Search className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Café, thé, jus…"
            aria-label="Rechercher"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-500"
          />
        </label>
        <Link
          href={href("/cafe/commandes")}
          className="relative flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 transition-colors duration-200 active:bg-slate-50 motion-reduce:transition-none"
        >
          <Receipt className="h-4 w-4 text-indigo-600" aria-hidden />
          Mes commandes
          {openOrders.length ? (
            <span
              key={openOrders.length}
              className="v-pop absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1 text-[11px] font-bold text-white ring-2 ring-white"
            >
              {openOrders.length}
            </span>
          ) : null}
        </Link>
      </div>

      <OffersStrip only="PRODUCT" />

      <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Catégories">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            className={cn(
              "h-10 rounded-full text-[13px] font-bold transition-colors duration-200 motion-reduce:transition-none",
              tab === id
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-700 ring-1 ring-slate-200"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="v-rise rounded-[22px] bg-white p-6 text-center text-sm text-slate-600 shadow-sm ring-1 ring-slate-900/5">
          Chargement du menu…
        </div>
      ) : filtered.length === 0 ? (
        <div className="v-rise rounded-[22px] bg-white p-6 text-center text-sm text-slate-600 shadow-sm ring-1 ring-slate-900/5">
          Aucun produit pour le moment. L&apos;accueil peut en ajouter dans
          Products.
        </div>
      ) : (
        // keyed by tab so switching category replays the rise-in
        <div key={tab} className="grid grid-cols-2 gap-2.5">
          {filtered.map((p, i) => {
            const deal = deals.get(p.id);
            const price = priceOf(p);
            const kind = kindOf(p.name, p.description);
            const hot = kind === "drink" && HOT_RE.test(textOf(p.name, p.description));
            const out = p.stock <= 0;
            const n = Math.min(cart[p.id] || 0, Math.max(0, p.stock));
            const pts = dtToPoints(price);
            const Icon = kind === "drink" ? Coffee : kind === "snack" ? Cookie : ShoppingBag;
            return (
              <article
                key={p.id}
                id={`product-${p.id}`}
                style={{ animationDelay: `${Math.min(i * 40, 240)}ms` }}
                className={cn(
                  "v-rise flex flex-col overflow-hidden rounded-[22px] bg-white shadow-sm ring-1 ring-slate-900/5",
                  deal && "ring-2 ring-amber-400",
                  focusProductId === p.id && "ring-4"
                )}
              >
                <div
                  className={cn(
                    "relative flex h-[84px] items-center justify-center",
                    !p.img &&
                      (kind === "drink"
                        ? hot
                          ? "bg-orange-50 text-orange-800"
                          : "bg-sky-50 text-sky-800"
                        : kind === "snack"
                          ? "bg-rose-50 text-rose-800"
                          : "bg-slate-100 text-slate-600"),
                    out && "opacity-60"
                  )}
                >
                  {p.img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.img}
                      alt={p.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <>
                      {hot ? (
                        <>
                          <span
                            aria-hidden
                            className="v-steam absolute left-[46%] top-2.5 h-3.5 w-[5px] rounded-full bg-orange-900/30"
                          />
                          <span
                            aria-hidden
                            style={{ animationDelay: "700ms" }}
                            className="v-steam absolute left-[54%] top-3 h-3 w-1 rounded-full bg-orange-900/25"
                          />
                        </>
                      ) : null}
                      <Icon className="h-8 w-8" aria-hidden />
                    </>
                  )}
                  {deal ? (
                    <span className="absolute left-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-extrabold text-amber-950 shadow-sm">
                      {deal.label}
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-1 flex-col px-2.5 pb-2.5 pt-2">
                  <p className="line-clamp-2 text-sm font-extrabold leading-tight text-slate-900">
                    {p.name}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                    {deal ? (
                      <span className="flex items-baseline gap-1">
                        <span className="text-[13px] font-extrabold text-amber-700">
                          {fmt(price)} DT
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500 line-through">
                          {fmt(p.sellingPrice)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-[13px] font-bold text-slate-700">
                        {fmt(price)} DT
                      </span>
                    )}
                    {isPwa && pts > 0 ? (
                      <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-extrabold leading-none text-amber-800">
                        +{pts} pts
                      </span>
                    ) : null}
                    {out ? (
                      <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[11px] font-extrabold leading-none text-rose-700">
                        Rupture
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-auto pt-2">
                    {n === 0 ? (
                      <button
                        type="button"
                        disabled={out}
                        onClick={() => add(p)}
                        className="h-10 w-full rounded-full bg-indigo-600 text-[13px] font-extrabold text-white transition-[background-color,transform] duration-150 active:scale-[0.97] active:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-500 motion-reduce:transition-none"
                      >
                        {out ? "Indisponible" : "Ajouter"}
                      </button>
                    ) : (
                      <div className="v-rise flex h-10 items-center justify-between rounded-full bg-indigo-50 px-1">
                        <button
                          type="button"
                          aria-label={`Retirer un ${p.name}`}
                          onClick={() => setQty(p.id, n - 1, p.stock)}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-indigo-700 shadow-sm transition-transform duration-150 active:scale-90 motion-reduce:transition-none"
                        >
                          <Minus className="h-4 w-4" strokeWidth={3} />
                        </button>
                        <span
                          key={n}
                          className="v-pop text-[15px] font-black text-indigo-700"
                          aria-live="polite"
                        >
                          {n}
                        </span>
                        <button
                          type="button"
                          aria-label={`Ajouter un ${p.name}`}
                          disabled={n >= p.stock}
                          onClick={() => setQty(p.id, n + 1, p.stock)}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm transition-[transform,opacity] duration-150 active:scale-90 disabled:opacity-40 motion-reduce:transition-none"
                        >
                          <Plus className="h-4 w-4" strokeWidth={3} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {itemCount > 0 ? (
        <div className="v-slide-up sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 flex items-center gap-2.5 rounded-[22px] bg-slate-900 py-2.5 pl-3.5 pr-2.5 text-white shadow-[0_14px_30px_-12px_rgba(15,23,42,0.6)]">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-extrabold">
              {itemCount} article{itemCount > 1 ? "s" : ""} · {fmt(total)} DT
            </p>
            {cafeOrders != null && cafeOrders < 5 ? (
              <p className="truncate text-xs text-amber-200">
                Habitué café {cafeOrders + 1}/5 après cette commande
              </p>
            ) : null}
          </div>
          <button
            type="button"
            disabled={order.isPending}
            onClick={() => order.mutate()}
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-amber-400 px-4 text-sm font-black text-amber-950 transition-[background-color,transform,opacity] duration-150 active:scale-[0.97] active:bg-amber-300 disabled:opacity-70 motion-reduce:transition-none"
          >
            {order.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Commander
          </button>
        </div>
      ) : null}
    </div>
  );
}
