"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Receipt, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { loadVisitorCache } from "@/lib/visitorCache";
import { mobileApi } from "@/lib/api/resources";
import { cn } from "@/lib/utils";
import { useRealtime } from "@/lib/realtime/RealtimeProvider";
import { useOrg } from "@/lib/org";
import Link from "next/link";
import {
  readLocalCache,
  writeLocalCache,
} from "@/lib/visitor-local-cache";

function isCoffee(name: string, desc?: string | null) {
  const t = `${name} ${desc || ""}`.toLowerCase();
  return /caf|coffee|espresso|latte|thé|tea|boisson|jus|snack/.test(t);
}

export default function CafePage() {
  const queryClient = useQueryClient();
  const { href } = useOrg();
  const { socket } = useRealtime();
  const [memberId, setMemberId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "coffee" | "shop">("all");
  const [qty, setQty] = useState<Record<string, number>>({});

  useEffect(() => {
    setMemberId(
      loadVisitorCache()?.memberId || sessionStorage.getItem("memberId")
    );
  }, []);

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
      queryClient.invalidateQueries({ queryKey: ["mobile-products"] });
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
  }, [socket, memberId, queryClient]);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["mobile-products"],
    queryFn: async () => {
      const data = await mobileApi.products();
      writeLocalCache("products", data);
      return data;
    },
    staleTime: 60_000,
    placeholderData: () => readLocalCache("products") ?? undefined,
  });
  const { data: orders = [] } = useQuery({
    queryKey: ["mobile-orders", memberId],
    queryFn: () => mobileApi.orders(memberId!),
    enabled: !!memberId,
    staleTime: 20_000,
  });

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const coffee = isCoffee(p.name, p.description);
      if (tab === "coffee" && !coffee) return false;
      if (tab === "shop" && coffee) return false;
      if (q && !`${p.name} ${p.description || ""}`.toLowerCase().includes(q.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [products, q, tab]);

  const order = useMutation({
    mutationFn: (productId: string) =>
      mobileApi.order({
        memberId: memberId!,
        productId,
        quantity: qty[productId] || 1,
      }),
    onSuccess: (res) => {
      toast.success(`Commande envoyée : ${res.productName} · ${res.amount} DT`);
      queryClient.invalidateQueries({ queryKey: ["mobile-products"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openOrders = orders.filter((o) => o.status !== "CANCELLED");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher…"
            className="h-11 rounded-full bg-white pl-9"
          />
        </div>
        <Link href={href("/cafe/commandes")} className="relative shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-full bg-white shadow-sm"
            aria-label="Mes commandes"
          >
            <Receipt className="h-5 w-5 text-primary" />
          </Button>
          {openOrders.length ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
              {openOrders.length}
            </span>
          ) : null}
        </Link>
      </div>

      <div className="flex gap-1 rounded-full bg-slate-200/70 p-1 text-sm">
        {(
          [
            ["all", "Tout"],
            ["coffee", "Café"],
            ["shop", "Boutique"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 rounded-full py-1.5 font-medium",
              tab === id ? "bg-white shadow-sm" : "text-slate-500"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Chargement du menu…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500">
          Aucun produit pour le moment. L&apos;accueil peut en ajouter dans
          Products.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((p) => (
            <article key={p.id} className="overflow-hidden rounded-3xl bg-white shadow-sm">
              <div className="relative aspect-[4/3] bg-slate-100">
                {p.img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.img}
                    alt={p.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-300">
                    <ShoppingBag className="h-16 w-16" />
                  </div>
                )}
                <span className="absolute bottom-3 left-3 rounded-full bg-black/70 px-3 py-1 text-sm font-semibold text-white">
                  {p.sellingPrice.toFixed(2)} DT
                </span>
                {p.stock <= 0 ? (
                  <Badge className="absolute right-3 top-3 bg-rose-600">
                    Rupture
                  </Badge>
                ) : null}
              </div>
              <div className="p-4">
                <h2 className="text-lg font-bold">{p.name}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                  {p.description || "Disponible à l'accueil."}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex items-center rounded-full border bg-slate-50">
                    <button
                      type="button"
                      className="px-3 py-1 text-lg"
                      onClick={() =>
                        setQty((s) => ({
                          ...s,
                          [p.id]: Math.max(1, (s[p.id] || 1) - 1),
                        }))
                      }
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm font-semibold">
                      {qty[p.id] || 1}
                    </span>
                    <button
                      type="button"
                      className="px-3 py-1 text-lg"
                      onClick={() =>
                        setQty((s) => ({
                          ...s,
                          [p.id]: Math.min(p.stock || 9, (s[p.id] || 1) + 1),
                        }))
                      }
                    >
                      +
                    </button>
                  </div>
                  <Button
                    className="h-11 flex-1 rounded-full"
                    disabled={!memberId || p.stock <= 0 || order.isPending}
                    onClick={() => {
                      if (!memberId) {
                        toast.message("Connectez-vous depuis l’accueil");
                        return;
                      }
                      order.mutate(p.id);
                    }}
                  >
                    Commander
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
