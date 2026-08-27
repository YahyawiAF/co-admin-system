"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { loadVisitorCache } from "@/lib/visitorCache";
import { mobileApi } from "@/lib/api/resources";
import { cn } from "@/lib/utils";
import { useRealtime } from "@/lib/realtime/RealtimeProvider";

function isCoffee(name: string, desc?: string | null) {
  const t = `${name} ${desc || ""}`.toLowerCase();
  return /caf|coffee|espresso|latte|thé|tea|boisson|jus|snack/.test(t);
}

export default function CafePage() {
  const queryClient = useQueryClient();
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
    const refresh = (payload: { memberId?: string; status?: string }) => {
      if (payload?.memberId && memberId && payload.memberId !== memberId) return;
      queryClient.invalidateQueries({ queryKey: ["mobile-orders"] });
                    if (payload?.status === "CONFIRMED") {
        toast.success("Votre commande a été confirmée");
      }
    };
    socket.on("product_order", refresh);
    socket.on("product_order_confirmed", refresh);
    socket.on("table_updates", refresh);
    return () => {
      socket.off("product_order", refresh);
      socket.off("product_order_confirmed", refresh);
      socket.off("table_updates", refresh);
    };
  }, [socket, memberId, queryClient]);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["mobile-products"],
    queryFn: () => mobileApi.products(),
  });
  const { data: orders = [] } = useQuery({
    queryKey: ["mobile-orders", memberId],
    queryFn: () => mobileApi.orders(memberId!),
    enabled: !!memberId,
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

  const updateOrder = useMutation({
    mutationFn: (vars: { id: string; quantity: number }) =>
      mobileApi.updateOrder(vars.id, {
        memberId: memberId!,
        quantity: vars.quantity,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mobile-orders"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelOrder = useMutation({
    mutationFn: (id: string) => mobileApi.cancelOrder(id, memberId!),
    onSuccess: () => {
      toast.message("Commande annulée");
      queryClient.invalidateQueries({ queryKey: ["mobile-orders"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
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

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          className="h-11 rounded-xl bg-white pl-9"
          placeholder="Rechercher un produit"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
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

      {orders.length > 0 ? (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Vos commandes
          </h3>
          <div className="space-y-2">
            {orders.slice(0, 8).map((o) => (
              <div
                key={o.id}
                className="rounded-2xl bg-white px-4 py-3 text-sm shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span>
                    {o.quantity}× {o.productName}
                  </span>
                  <span className="font-semibold">{o.amount.toFixed(2)} DT</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <Badge
                    variant={
                      o.status === "CONFIRMED"
                        ? "default"
                        : o.status === "PENDING"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {o.status === "CONFIRMED"
                      ? "Confirmée"
                      : o.status === "PENDING"
                        ? "En attente"
                        : o.status}
                  </Badge>
                  {o.canEdit || o.status === "PENDING" ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="rounded-full border px-2 py-0.5"
                        onClick={() =>
                          updateOrder.mutate({
                            id: o.id,
                            quantity: Math.max(1, o.quantity - 1),
                          })
                        }
                      >
                        −
                      </button>
                      <button
                        type="button"
                        className="rounded-full border px-2 py-0.5"
                        onClick={() =>
                          updateOrder.mutate({
                            id: o.id,
                            quantity: o.quantity + 1,
                          })
                        }
                      >
                        +
                      </button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-destructive"
                        onClick={() => cancelOrder.mutate(o.id)}
                      >
                        Supprimer
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">
                      {o.isPayed ? "Payé en fin de journée" : "À payer le soir"}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
