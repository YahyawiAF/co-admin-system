"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Ban,
  Check,
  Coffee,
  Loader2,
  Minus,
  PackageX,
  Plus,
  Receipt,
  Search,
  X,
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
  orderUnitPrice,
  productsApi,
  type DailyProduct,
} from "@/lib/api/resources";
import { cn } from "@/lib/utils";

type Props = {
  memberId: string | null;
  memberName: string;
  /** Visit the orders belong to; null with `anonymous` = counter sale (no visit). */
  journalId: string | null;
  /** Allow adding without a member (anonymous visit or counter sale). */
  anonymous?: boolean;
  /** "button" = toolbar trigger for counter sales instead of the table cell. */
  trigger?: "cell" | "button";
  /** Local yyyy-MM-dd of the journal day (for "mark paid"). */
  dateKey: string;
  /** This member's non-cancelled orders for the journal day. */
  orders: DailyProduct[];
  /** productId → times ordered recently (most used first). */
  popularity: Map<string, number>;
};

type OrderAction = "pay" | "unpay" | "confirm" | "reject" | "cancel" | "qty";

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

const lineAmount = (o: DailyProduct) => orderUnitPrice(o) * (o.quantite || 0);

/** Café column: today's count + a dialog to add / pay / refuse / cancel the member's orders. */
export function JournalCoffeeCell({
  memberId,
  memberName,
  journalId,
  anonymous = false,
  trigger = "cell",
  dateKey,
  orders,
  popularity,
}: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [qty, setQty] = useState(1);
  const [paidNow, setPaidNow] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  /** Order awaiting a second click to confirm cancel / refuse. */
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
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

  const ticket = useMemo(
    () =>
      [...orders].sort((a, b) =>
        (b.createdAt || "").localeCompare(a.createdAt || "")
      ),
    [orders]
  );

  const qtyTotal = orders.reduce((s, o) => s + (o.quantite || 0), 0);
  const total = orders.reduce((s, o) => s + lineAmount(o), 0);
  const unpaid = orders.filter((o) => !o.isPayed);
  const unpaidAmount = unpaid.reduce((s, o) => s + lineAmount(o), 0);
  const pendingCount = orders.filter((o) => o.status === "PENDING").length;
  const allPaid = qtyTotal > 0 && unpaid.length === 0;

  const toggle = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery("");
      setQty(1);
      setPaidNow(false);
      setConfirmingId(null);
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
    mutationFn: (vars: { productId: string; quantity: number }) =>
      mobileApi.adminCreateOrder({
        memberId: memberId ?? undefined,
        productId: vars.productId,
        quantity: vars.quantity,
        isPayed: paidNow,
        journalId,
      }),
    onSuccess: (order, vars) => {
      toast.success(
        order.quantity > vars.quantity
          ? `+${vars.quantity} ${order.productName} · ${order.quantity} au total`
          : `${order.quantity}× ${order.productName} ajouté`
      );
      setFlashId(vars.productId);
      window.setTimeout(() => setFlashId(null), 500);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const act = useMutation({
    mutationFn: ({
      id,
      action,
      quantity,
    }: {
      id: string;
      action: OrderAction;
      quantity?: number;
    }) => {
      switch (action) {
        case "qty":
          return mobileApi.setOrderQuantity(id, quantity ?? 1);
        case "pay":
          return mobileApi.payOrder(id, true);
        case "unpay":
          return mobileApi.payOrder(id, false);
        case "confirm":
          return mobileApi.confirmOrder(id);
        default:
          return mobileApi.rejectOrder(id);
      }
    },
    onSuccess: (_res, { action }) => {
      setConfirmingId(null);
      if (action === "reject") toast.message("Commande refusée · stock rendu");
      if (action === "cancel") toast.message("Commande annulée · stock rendu");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const payAll = useMutation({
    mutationFn: (isPayed: boolean) =>
      mobileApi.payMemberDayOrders(memberId, isPayed, dateKey, journalId),
    onSuccess: (_res, isPayed) => {
      toast.success(isPayed ? "Tout est payé" : "Paiements annulés");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && filtered.length === 1 && !add.isPending) {
        add.mutate({ productId: filtered[0].id, quantity: qty });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, add, qty]);

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
      {pendingCount ? (
        <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-amber-500" title="Commande en attente" />
      ) : null}
    </span>
  ) : (
    <span className="text-muted-foreground">—</span>
  );

  if (!memberId && !anonymous) return badge;

  const rowBusy = (id: string) => act.isPending && act.variables?.id === id;

  return (
    <div className="flex items-center gap-1">
      {trigger === "button" ? (
        <Button
          type="button"
          variant="outline"
          size="lg"
          title="Café / boutique pour un passant, sans fiche"
          onClick={() => toggle(true)}
        >
          <Coffee className="mr-2 h-4 w-4" />
          Café comptoir
          {qtyTotal ? (
            <Badge
              variant="secondary"
              className={cn(
                "ml-2 h-5 px-1.5 text-[10px]",
                allPaid ? "text-emerald-700" : "text-red-700"
              )}
            >
              {qtyTotal}×
            </Badge>
          ) : null}
        </Button>
      ) : (
        <>
          <button
            type="button"
            className="rounded px-0.5 hover:bg-muted"
            onClick={() => toggle(true)}
            title="Voir les commandes"
          >
            {badge}
          </button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            title="Ajouter / gérer les commandes"
            onClick={() => toggle(true)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </>
      )}

      <Dialog open={open} onOpenChange={toggle}>
        <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="shrink-0 border-b bg-muted/30 px-5 py-4">
            <div className="flex items-center gap-3 pr-6">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {initialsOf(memberName)}
              </span>
              <div className="min-w-0 flex-1 text-left">
                <DialogTitle className="truncate text-base">
                  {memberName}
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Café / boutique · {qtyTotal} article{qtyTotal > 1 ? "s" : ""}
                  {pendingCount ? ` · ${pendingCount} en attente` : ""}
                </p>
              </div>
              {unpaidAmount > 0 ? (
                <Badge variant="destructive" className="shrink-0">
                  {unpaidAmount.toFixed(1)} DT à payer
                </Badge>
              ) : qtyTotal > 0 ? (
                <Badge className="shrink-0 bg-emerald-600 hover:bg-emerald-600">
                  Tout payé
                </Badge>
              ) : null}
            </div>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 md:grid-cols-[1fr_340px]">
            {/* Add products */}
            <section className="flex min-h-0 flex-col border-b md:border-b-0 md:border-r">
              <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-3">
                <div className="relative min-w-[150px] flex-1">
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

              <div className="min-h-[220px] flex-1 overflow-y-auto px-4 py-3">
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                    <PackageX className="h-7 w-7 text-muted-foreground/60" />
                    {products.length === 0
                      ? "Aucun produit. Ajoutez-en dans Produits."
                      : "Aucun produit ne correspond à la recherche."}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                    {filtered.map((p) => {
                      const out = p.stock < qty;
                      const busy =
                        add.isPending && add.variables?.productId === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          disabled={out || add.isPending}
                          onClick={() =>
                            add.mutate({ productId: p.id, quantity: qty })
                          }
                          className={cn(
                            "group relative flex flex-col overflow-hidden rounded-xl border text-left transition disabled:cursor-not-allowed disabled:opacity-50",
                            "hover:-translate-y-0.5 hover:border-primary hover:shadow-sm active:translate-y-0 active:shadow-none",
                            flashId === p.id &&
                              "border-emerald-400 ring-2 ring-emerald-200"
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
                            {busy ? (
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
            </section>

            {/* Day ticket */}
            <section className="flex min-h-0 flex-col bg-muted/20">
              <div className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold">Ticket du jour</p>
              </div>

              <div className="min-h-[160px] flex-1 space-y-2 overflow-y-auto px-3 py-3">
                {ticket.length === 0 ? (
                  <p className="py-10 text-center text-xs text-muted-foreground">
                    Aucune commande aujourd’hui.
                    <br />
                    Touchez un produit pour l’ajouter.
                  </p>
                ) : (
                  ticket.map((o) => {
                    const busy = rowBusy(o.id);
                    const isPending = o.status === "PENDING";
                    const confirming = confirmingId === o.id;
                    return (
                      <div
                        key={o.id}
                        className={cn(
                          "rounded-xl border bg-background p-2.5 shadow-sm transition",
                          isPending && "border-amber-300",
                          busy && "opacity-60"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold leading-tight">
                              {o.product?.name || "Produit"}
                            </p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {lineAmount(o).toFixed(1)} DT
                              {o.createdAt
                                ? ` · ${format(new Date(o.createdAt), "HH:mm")}`
                                : ""}
                              {isPending ? (
                                <span className="ml-1 font-medium text-amber-600">
                                  · En attente
                                </span>
                              ) : null}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              act.mutate({
                                id: o.id,
                                action: o.isPayed ? "unpay" : "pay",
                              })
                            }
                            title={
                              o.isPayed
                                ? "Marquer non payé"
                                : "Marquer payé"
                            }
                            className={cn(
                              "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-semibold transition",
                              o.isPayed
                                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                : "bg-red-100 text-red-700 hover:bg-red-200"
                            )}
                          >
                            {busy && act.variables?.action.endsWith("pay") ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : o.isPayed ? (
                              <Check className="h-3 w-3" />
                            ) : null}
                            {o.isPayed ? "Payé" : "Non payé"}
                          </button>
                        </div>

                        <div className="mt-2 flex items-center gap-1.5">
                          {confirming ? (
                            <>
                              <span className="flex-1 text-[11px] font-medium text-red-600">
                                {isPending ? "Refuser" : "Annuler"} et rendre le
                                stock ?
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-[11px]"
                                onClick={() => setConfirmingId(null)}
                              >
                                Non
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                className="h-6 px-2 text-[11px]"
                                disabled={busy}
                                onClick={() =>
                                  act.mutate({
                                    id: o.id,
                                    action: isPending ? "reject" : "cancel",
                                  })
                                }
                              >
                                Oui
                              </Button>
                            </>
                          ) : (
                            <>
                              {isPending ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-6 px-2 text-[11px]"
                                  disabled={busy}
                                  onClick={() =>
                                    act.mutate({ id: o.id, action: "confirm" })
                                  }
                                >
                                  <Check className="mr-1 h-3 w-3" />
                                  Valider
                                </Button>
                              ) : null}
                              <div className="flex items-center rounded-md border bg-background">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  disabled={busy}
                                  title={
                                    o.quantite <= 1 ? "Retirer" : "Un de moins"
                                  }
                                  onClick={() =>
                                    o.quantite <= 1
                                      ? setConfirmingId(o.id)
                                      : act.mutate({
                                          id: o.id,
                                          action: "qty",
                                          quantity: o.quantite - 1,
                                        })
                                  }
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-6 text-center text-xs font-bold tabular-nums">
                                  {busy && act.variables?.action === "qty" ? (
                                    <Loader2 className="mx-auto h-3 w-3 animate-spin" />
                                  ) : (
                                    o.quantite
                                  )}
                                </span>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  disabled={
                                    busy || (o.product?.stock ?? 1) < 1
                                  }
                                  title="Un de plus"
                                  onClick={() =>
                                    act.mutate({
                                      id: o.id,
                                      action: "qty",
                                      quantity: o.quantite + 1,
                                    })
                                  }
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                              <div className="flex-1" />
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-[11px] text-red-600 hover:bg-red-50 hover:text-red-700"
                                disabled={busy}
                                onClick={() => setConfirmingId(o.id)}
                              >
                                {isPending ? (
                                  <Ban className="mr-1 h-3 w-3" />
                                ) : (
                                  <X className="mr-1 h-3 w-3" />
                                )}
                                {isPending ? "Refuser" : "Annuler"}
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="shrink-0 space-y-2 border-t bg-background px-4 py-3">
                <div className="space-y-0.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-semibold tabular-nums">
                      {total.toFixed(1)} DT
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payé</span>
                    <span className="font-medium tabular-nums text-emerald-600">
                      {(total - unpaidAmount).toFixed(1)} DT
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reste à payer</span>
                    <span
                      className={cn(
                        "font-bold tabular-nums",
                        unpaidAmount > 0 ? "text-red-600" : "text-foreground"
                      )}
                    >
                      {unpaidAmount.toFixed(1)} DT
                    </span>
                  </div>
                </div>
                {ticket.length > 0 ? (
                  unpaidAmount > 0 ? (
                    <Button
                      type="button"
                      className="h-9 w-full bg-emerald-600 hover:bg-emerald-700"
                      disabled={payAll.isPending}
                      onClick={() => payAll.mutate(true)}
                    >
                      {payAll.isPending ? (
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="mr-1.5 h-4 w-4" />
                      )}
                      Encaisser tout · {unpaidAmount.toFixed(1)} DT
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 w-full"
                      disabled={payAll.isPending}
                      onClick={() => payAll.mutate(false)}
                    >
                      Annuler le paiement de tout
                    </Button>
                  )
                ) : null}
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
