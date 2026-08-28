"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CircleDollarSign } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mobileApi, type ProductOrder } from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import { cn } from "@/lib/utils";

function OrderCard({
  order,
  tone,
  onPay,
  onConfirm,
  pending,
}: {
  order: ProductOrder;
  tone: "unpaid" | "paid";
  onPay: (isPayed: boolean) => void;
  onConfirm?: () => void;
  pending?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3",
        tone === "unpaid"
          ? "border-rose-200 bg-rose-50/80"
          : "border-emerald-200 bg-emerald-50/70"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">
            {order.memberName || "Visiteur"}
            {order.visitorNumber ? ` #${order.visitorNumber}` : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            {order.quantity}× {order.productName} · {order.amount.toFixed(2)} DT
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={order.status === "CONFIRMED" ? "default" : "secondary"}
          >
            {order.status === "CONFIRMED" ? "Confirmée" : "En attente"}
          </Badge>
          {order.status === "PENDING" && onConfirm ? (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={onConfirm}
            >
              <Check className="mr-1 h-3.5 w-3.5" />
              Confirmer
            </Button>
          ) : null}
          <Button
            size="sm"
            variant={tone === "unpaid" ? "default" : "outline"}
            className={
              tone === "unpaid"
                ? "bg-rose-600 hover:bg-rose-700"
                : "border-emerald-400 text-emerald-800"
            }
            disabled={pending}
            onClick={() => onPay(tone === "unpaid")}
          >
            <CircleDollarSign className="mr-1 h-3.5 w-3.5" />
            {tone === "unpaid" ? "Marquer payée" : "Marquer impayée"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CommandesBoard({ dateKey }: { dateKey: string }) {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: queryKeys.adminOrders(dateKey),
    queryFn: () => mobileApi.adminOrders(dateKey),
    refetchInterval: 8_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.adminOrders(dateKey) });
    queryClient.invalidateQueries({ queryKey: queryKeys.productOrdersPending });
    queryClient.invalidateQueries({ queryKey: ["daily-products"] });
  };

  const pay = useMutation({
    mutationFn: ({ id, isPayed }: { id: string; isPayed: boolean }) =>
      mobileApi.payOrder(id, isPayed),
    onSuccess: () => {
      toast.success("Paiement mis à jour");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirm = useMutation({
    mutationFn: (id: string) => mobileApi.confirmOrder(id),
    onSuccess: () => {
      toast.success("Commande confirmée");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (!term) return true;
      return `${o.memberName || ""} ${o.productName} ${o.phone || ""}`
        .toLowerCase()
        .includes(term);
    });
  }, [orders, q]);

  const unpaid = filtered.filter((o) => !o.isPayed);
  const paid = filtered.filter((o) => o.isPayed);
  const unpaidTotal = unpaid.reduce((a, o) => a + o.amount, 0);
  const paidTotal = paid.reduce((a, o) => a + o.amount, 0);
  const pending = pay.isPending || confirm.isPending;

  return (
    <div className="space-y-4">
      <Input
        placeholder="Rechercher un visiteur…"
        className="max-w-sm"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-rose-200 shadow-sm">
            <CardHeader className="bg-rose-50/80">
              <CardTitle className="flex items-center justify-between text-rose-900">
                <span>À encaisser</span>
                <Badge className="bg-rose-600 hover:bg-rose-600">
                  {unpaid.length} · {unpaidTotal.toFixed(2)} DT
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-4">
              {!unpaid.length ? (
                <p className="text-sm text-muted-foreground">
                  Aucune commande impayée.
                </p>
              ) : (
                unpaid.map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    tone="unpaid"
                    pending={pending}
                    onConfirm={
                      o.status === "PENDING"
                        ? () => confirm.mutate(o.id)
                        : undefined
                    }
                    onPay={(isPayed) => pay.mutate({ id: o.id, isPayed })}
                  />
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-emerald-200 shadow-sm">
            <CardHeader className="bg-emerald-50/80">
              <CardTitle className="flex items-center justify-between text-emerald-900">
                <span>Payées</span>
                <Badge className="bg-emerald-600 hover:bg-emerald-600">
                  {paid.length} · {paidTotal.toFixed(2)} DT
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-4">
              {!paid.length ? (
                <p className="text-sm text-muted-foreground">
                  Aucune commande payée aujourd’hui.
                </p>
              ) : (
                paid.map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    tone="paid"
                    pending={pay.isPending}
                    onPay={(isPayed) => pay.mutate({ id: o.id, isPayed })}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
