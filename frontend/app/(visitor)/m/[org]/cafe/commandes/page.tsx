"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { loadVisitorCache } from "@/lib/visitorCache";
import { mobileApi } from "@/lib/api/resources";
import { useRealtime } from "@/lib/realtime/RealtimeProvider";

export default function CafeOrdersPage() {
  const queryClient = useQueryClient();
  const { socket } = useRealtime();
  const [memberId, setMemberId] = useState<string | null>(null);

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

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["mobile-orders", memberId],
    queryFn: () => mobileApi.orders(memberId!),
    enabled: !!memberId,
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
      <p className="px-1 text-xs text-slate-500">Statut et paiement de vos commandes</p>

      {isLoading ? (
        <p className="text-sm text-slate-500">Chargement…</p>
      ) : !orders.length ? (
        <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500">
          Aucune commande pour le moment.
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
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
                      : o.status === "CANCELLED"
                        ? "Annulée"
                        : o.status}
                </Badge>
                {o.status === "PENDING" ? (
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
                      Annuler
                    </Button>
                  </div>
                ) : o.status === "CONFIRMED" || o.canCancel ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">
                      {o.isPayed ? "Payé" : "À payer le soir"}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-destructive"
                      disabled={cancelOrder.isPending}
                      onClick={() => cancelOrder.mutate(o.id)}
                    >
                      Annuler
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">
                    {o.status === "CANCELLED" ? "Annulée" : "—"}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
