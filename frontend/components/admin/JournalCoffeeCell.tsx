"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Coffee,
  Loader2,
  Minus,
  PackageX,
  Plus,
  Search,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  mobileApi,
  productsApi,
  type DailyProduct,
} from "@/lib/api/resources";
import type { ProductOrder } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  memberId: string | null;
  memberName: string;
  journalId: string;
  /** Local yyyy-MM-dd of the journal day (for "mark paid"). */
  dateKey: string;
  /** This member's non-cancelled orders for the journal day. */
  orders: DailyProduct[];
  /** productId → times ordered recently (most used first). */
  popularity: Map<string, number>;
};

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Café column: today's count + a quick-add dialog for the member's tab. */
export function JournalCoffeeCell({
  memberId,
  memberName,
  journalId,
  dateKey,
  orders,
  popularity,
}: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [qty, setQty] = useState(1);
  const [paidNow, setPaidNow] = useState(false);
  const [justAdded, setJustAdded] = useState<ProductOrder[]>([]);
  const [flashId, setFlashId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => productsApi.list(),
    enabled: open,
    staleTime: 60_000,
  });

  const sorted = useMemo(
    () =>
      [...products].sort(
        (a, b) =>
          (popularity.get(b.id) ?? 0) - (popularity.get(a.id) ?? 0) ||
          a.name.localeCompare(b.name, "fr")
      ),
    [products, popularity]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((p) => p.name.toLowerCase().includes(q));
  }, [sorted, query]);

  const qtyTotal = orders.reduce((s, o) => s + (o.quantite || 0), 0);
  const unpaid = orders.filter((o) => !o.isPayed);
  const unpaidAmount = unpaid.reduce(
    (s, o) => s + (o.product?.sellingPrice || 0) * (o.quantite || 0),
    0
  );
  const allPaid = qtyTotal > 0 && unpaid.length === 0;
  const sessionTotal = justAdded.reduce((s, o) => s + o.amount, 0);

  const reset = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery("");
      setQty(1);
      setPaidNow(false);
      setJustAdded([]);
    } else {
      window.setTimeout(() => searchRef.current?.focus(), 80);
    }
  };

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["daily-products"] });
    queryClient.invalidateQueries({ queryKey: ["product-orders"] });
    queryClient.invalidateQueries({ queryKey: ["products"] });
    queryClient.invalidateQueries({ queryKey: ["caisse-summary"] });
    queryClient.invalidateQueries({ queryKey: ["visitor-day"] });
  };

  const add = useMutation({
    mutationFn: (productId: string) =>
      mobileApi.adminCreateOrder({
        memberId: memberId!,
        productId,
        quantity: qty,
        isPayed: paidNow,
        journalId,
      }),
    onSuccess: (order, productId) => {
      setJustAdded((list) => [order, ...list]);
      setFlashId(productId);
      window.setTimeout(() => setFlashId(null), 500);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const payAll = useMutation({
    mutationFn: () => mobileApi.payMemberDayOrders(memberId!, true, dateKey),
    onSuccess: () => {
      toast.success(`Commandes de ${memberName} payées`);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && filtered.length === 1 && !add.isPending) {
        add.mutate(filtered[0].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, add]);

  const badge = qtyTotal ? (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        allPaid ? "text-emerald-600" : "text-red-600"
      )}
      title={allPaid ? "Café / boutique payé" : "Café / boutique impayé"}
    >
      <Coffee className="h-3.5 w-3.5" />
      {qtyTotal}×
    </span>
  ) : (
    <span className="text-muted-foreground">—</span>
  );

  if (!memberId) return badge;

  return (
    <div className="flex items-center gap-1">
      {badge}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-6 w-6 text-muted-foreground hover:text-foreground"
        title="Ajouter un café / produit"
        onClick={() => reset(true)}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={reset}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="shrink-0 border-b bg-muted/30 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {initialsOf(memberName)}
              </span>
              <div className="min-w-0 flex-1 text-left">
                <DialogTitle className="truncate text-base">
                  {memberName}
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  {qtyTotal > 0
                    ? `${qtyTotal} article${qtyTotal > 1 ? "s" : ""} aujourd’hui${
                        unpaid.length
                          ? ` · ${unpaidAmount.toFixed(1)} DT impayé`
                          : " · payé"
                      }`
                    : "Ajouter un café ou un produit"}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-5 py-3">
            <div className="relative min-w-[160px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un produit…"
                className="h-8 pl-8 text-sm"
              />
            </div>
            <div className="flex shrink-0 items-center gap-0.5 rounded-lg border bg-background p-0.5">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                disabled={qty <= 1}
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className="w-6 text-center text-sm font-bold tabular-nums">
                {qty}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setQty((q) => Math.min(20, q + 1))}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <label className="flex shrink-0 items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
              Payé
              <Switch checked={paidNow} onCheckedChange={setPaidNow} />
            </label>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                <PackageX className="h-7 w-7 text-muted-foreground/60" />
                {products.length === 0
                  ? "Aucun produit. Ajoutez-en dans Produits."
                  : "Aucun produit ne correspond à la recherche."}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {filtered.map((p) => {
                  const out = p.stock < qty;
                  const pending = add.isPending && add.variables === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={out || add.isPending}
                      onClick={() => add.mutate(p.id)}
                      className={cn(
                        "group relative flex flex-col overflow-hidden rounded-xl border text-left transition disabled:cursor-not-allowed disabled:opacity-50",
                        "hover:-translate-y-0.5 hover:border-primary hover:shadow-sm active:translate-y-0 active:shadow-none",
                        flashId === p.id && "border-emerald-400 ring-2 ring-emerald-200"
                      )}
                    >
                      <div className="relative flex h-16 items-center justify-center bg-muted/60">
                        {p.img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.img}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Coffee className="h-6 w-6 text-muted-foreground/50" />
                        )}
                        {pending ? (
                          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          </div>
                        ) : flashId === p.id ? (
                          <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/80">
                            <Check className="h-5 w-5 text-white" />
                          </div>
                        ) : null}
                        {p.stock <= 5 ? (
                          <Badge
                            variant={out ? "destructive" : "secondary"}
                            className="absolute right-1 top-1 h-4 px-1.5 text-[9px] leading-none"
                          >
                            {out ? "Rupture" : `${p.stock} restants`}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="px-2 py-1.5">
                        <p className="truncate text-xs font-semibold leading-tight">
                          {p.name}
                        </p>
                        <p className="text-[11px] font-medium text-primary">
                          {(p.sellingPrice * qty).toFixed(1)} DT
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {justAdded.length > 0 || unpaid.length > 0 ? (
            <div className="shrink-0 space-y-2 border-t bg-muted/20 px-5 py-3">
              {justAdded.length > 0 ? (
                <div className="flex items-start justify-between gap-3 text-xs">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                    <ShoppingBag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    {justAdded.map((o, i) => (
                      <span
                        key={`${o.id}-${i}`}
                        className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 font-medium shadow-sm"
                      >
                        {o.quantity}× {o.productName}
                      </span>
                    ))}
                  </div>
                  <span className="shrink-0 font-semibold">
                    +{sessionTotal.toFixed(1)} DT
                  </span>
                </div>
              ) : null}
              {unpaid.length > 0 ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-red-600">
                    Impayé aujourd’hui : {unpaidAmount.toFixed(1)} DT
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={payAll.isPending}
                    onClick={() => payAll.mutate()}
                  >
                    {payAll.isPending ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : null}
                    Tout marquer payé
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
