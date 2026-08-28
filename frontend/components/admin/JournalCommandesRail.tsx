"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, Coffee, CircleDollarSign } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { mobileApi, type ProductOrder } from "@/lib/api/resources";
import { queryKeys } from "@/lib/query-client";
import { cn } from "@/lib/utils";

function CompactOrder({
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
        "rounded-lg border px-3 py-2",
        tone === "unpaid"
          ? "border-rose-200 bg-rose-50"
          : "border-emerald-200 bg-emerald-50"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {order.memberName || "Visiteur"}
            {order.visitorNumber ? ` #${order.visitorNumber}` : ""}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {order.quantity}× {order.productName}
          </p>
        </div>
        <p className="shrink-0 text-sm font-bold">{order.amount.toFixed(2)} DT</p>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge
          variant={order.status === "CONFIRMED" ? "default" : "secondary"}
          className="h-5 text-[10px]"
        >
          {order.status === "CONFIRMED" ? "OK" : "Attente"}
        </Badge>
        {order.status === "PENDING" && onConfirm ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            disabled={pending}
            onClick={onConfirm}
          >
            <Check className="mr-1 h-3 w-3" />
            Confirmer
          </Button>
        ) : null}
        <Button
          size="sm"
          className={cn(
            "h-7 px-2 text-xs",
            tone === "unpaid"
              ? "bg-rose-600 hover:bg-rose-700"
              : "border border-emerald-400 bg-white text-emerald-800 hover:bg-emerald-50"
          )}
          variant={tone === "unpaid" ? "default" : "outline"}
          disabled={pending}
          onClick={() => onPay(tone === "unpaid")}
        >
          <CircleDollarSign className="mr-1 h-3 w-3" />
          {tone === "unpaid" ? "Payée" : "Impayée"}
        </Button>
      </div>
    </div>
  );
}

export function JournalCommandesBody({ date }: { date: Date }) {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const dateKey = format(date, "yyyy-MM-dd");

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
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Input
        placeholder="Visiteur, café…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="h-8"
      />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-800">
                À encaisser
              </p>
              <Badge className="bg-rose-600 hover:bg-rose-600">
                {unpaid.length} · {unpaidTotal.toFixed(1)} DT
              </Badge>
            </div>
            {unpaid.length ? (
              <div className="space-y-2">
                {unpaid.map((o) => (
                  <CompactOrder
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
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-rose-200 px-3 py-4 text-center text-xs text-muted-foreground">
                Rien à encaisser
              </p>
            )}
          </section>
          <section>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                Payées
              </p>
              <Badge className="bg-emerald-600 hover:bg-emerald-600">
                {paid.length} · {paidTotal.toFixed(1)} DT
              </Badge>
            </div>
            {paid.length ? (
              <div className="space-y-2">
                {paid.map((o) => (
                  <CompactOrder
                    key={o.id}
                    order={o}
                    tone="paid"
                    pending={pending}
                    onPay={(isPayed) => pay.mutate({ id: o.id, isPayed })}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-emerald-200 px-3 py-4 text-center text-xs text-muted-foreground">
                Aucune commande payée
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export function JournalCommandesRail({ date }: { date: Date }) {
  const [open, setOpen] = useState(true);
  const dateKey = format(date, "yyyy-MM-dd");
  const { data: orders = [] } = useQuery({
    queryKey: queryKeys.adminOrders(dateKey),
    queryFn: () => mobileApi.adminOrders(dateKey),
    refetchInterval: 8_000,
  });
  const unpaidCount = orders.filter((o) => !o.isPayed).length;

  return (
    <>
      <aside
        className={cn(
          "sticky top-16 hidden shrink-0 self-start lg:flex",
          open ? "w-[420px]" : "w-12"
        )}
      >
        {open ? (
          <div className="flex h-[calc(100vh-6.5rem)] w-full flex-col rounded-xl border bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b px-3 py-2.5">
              <Coffee className="h-4 w-4 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">Commandes</p>
                <p className="text-[11px] text-muted-foreground">
                  Café du jour · même date que le journal
                </p>
              </div>
              {unpaidCount ? (
                <Badge className="bg-rose-600 hover:bg-rose-600">
                  {unpaidCount}
                </Badge>
              ) : null}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setOpen(false)}
                aria-label="Réduire"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col p-3">
              <JournalCommandesBody date={date} />
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex h-[calc(100vh-6.5rem)] w-12 flex-col items-center gap-2 rounded-xl border bg-card py-3 text-primary shadow-sm hover:bg-accent"
            aria-label="Ouvrir les commandes"
          >
            <ChevronLeft className="h-4 w-4" />
            <Coffee className="h-5 w-5" />
            {unpaidCount ? (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                {unpaidCount}
              </span>
            ) : null}
            <span
              className="mt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
              style={{ writingMode: "vertical-rl" }}
            >
              Commandes
            </span>
          </button>
        )}
      </aside>

      <Sheet>
        <SheetTrigger asChild>
          <Button
            size="lg"
            className="fixed bottom-20 right-4 z-30 h-12 gap-2 rounded-full shadow-lg lg:hidden"
          >
            <Coffee className="h-4 w-4" />
            Commandes
            {unpaidCount ? (
              <Badge className="bg-rose-600 hover:bg-rose-600">
                {unpaidCount}
              </Badge>
            ) : null}
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="flex w-[min(100%,420px)] flex-col p-0">
          <SheetHeader className="border-b px-4 py-3 text-left">
            <SheetTitle className="flex items-center gap-2">
              <Coffee className="h-4 w-4" />
              Commandes du jour
            </SheetTitle>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col p-3">
            <JournalCommandesBody date={date} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
