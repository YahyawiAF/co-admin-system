"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Calculator, HandCoins, ShoppingBasket, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { stockApi, type StockOverview } from "@/lib/api/resources";
import { average, dayKey, itemBuys, payLabel, perBuyUnit, today, allBuys, type Buy } from "./buys";
import { GradientHeader, StatusPill, buyUnit, dt, gradientDialogClass, parseNum, qty } from "./stock-ui";

const day = (d: string) => format(new Date(d), "d MMM yyyy", { locale: fr });
const num3 = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

type Pay = "CAISSE" | "COFFRE" | "AUTRE" | "DUE";
const PAY_OPTIONS: { id: Pay; label: string }[] = [
  { id: "CAISSE", label: "Payé · Caisse" },
  { id: "COFFRE", label: "Payé · Coffre" },
  { id: "AUTRE", label: "Payé · Autre" },
  { id: "DUE", label: "Pas encore payé" },
];

function Opt({ on, due, onClick, children }: { on: boolean; due?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "min-h-10 rounded-xl border px-3 py-2 text-sm font-bold transition-colors duration-200 motion-reduce:transition-none",
        on
          ? due
            ? "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"
            : "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
          : "bg-background text-foreground hover:border-indigo-300"
      )}
    >
      {children}
    </button>
  );
}

function Kv({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-bold tabular-nums">{children}</span>
    </div>
  );
}

/** Edit target: one article line of a purchase */
export type BuyTarget = { purchaseId: string; lotId: string };

/**
 * New purchase of one article, or correction of one. Shows the purchase before next to this one,
 * the unit price difference and the new average cost.
 */
export function BuyDialog({
  open,
  onOpenChange,
  overview,
  preselect,
  edit,
  onDone,
  onMulti,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  overview: StockOverview;
  preselect: string | null;
  edit: BuyTarget | null;
  onDone: () => void;
  /** Switch to the purchase of several articles at once */
  onMulti?: () => void;
}) {
  const buys = useMemo(() => allBuys(overview), [overview]);
  const editing = edit ? buys.find((b) => b.lotId === edit.lotId) ?? null : null;
  const [itemId, setItemId] = useState<string>("");
  const [q, setQ] = useState("");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(today());
  const [supplier, setSupplier] = useState("");
  const [pay, setPay] = useState<Pay>("CAISSE");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const item = overview.items.find((i) => i.id === itemId) ?? null;
  const bu = buyUnit(item?.unit ?? "pc");

  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    if (editing) {
      const f = buyUnit(editing.unit).factor;
      setItemId(editing.stockItemId);
      setQ(String(+(editing.quantity / f).toFixed(3)).replace(".", ","));
      setPrice(String(editing.price).replace(".", ","));
      setDate(dayKey(editing.date));
      setSupplier(editing.supplier ?? "");
      setPay(editing.paid ? (editing.source === "NONE" ? "AUTRE" : (editing.source as Pay)) : "DUE");
      return;
    }
    const id = preselect ?? overview.items[0]?.id ?? "";
    setItemId(id);
    setQ("");
    setPrice("");
    setDate(today());
    const last = id ? itemBuys(overview, id).pop() : undefined;
    setSupplier(last?.supplier ?? "");
    setPay("CAISSE");
  }, [open, edit?.lotId, preselect]); // eslint-disable-line react-hooks/exhaustive-deps

  // Choosing another article (new purchase) proposes its usual supplier
  const pickItem = (id: string) => {
    setItemId(id);
    const last = itemBuys(overview, id).pop();
    setSupplier(last?.supplier ?? "");
  };

  const history = item ? itemBuys(overview, item.id).filter((b) => b.lotId !== editing?.lotId) : [];
  const before: Buy | undefined = editing ? history.filter((b) => b.date <= editing.date).pop() : history[history.length - 1];
  const quantity = parseNum(q) * bu.factor;
  const amount = parseNum(price);
  const valid = !!item && quantity > 0 && Number.isFinite(amount) && amount >= 0;
  const unitNow = valid && quantity > 0 ? amount / quantity : 0;
  const unitBefore = before ? before.price / before.quantity : 0;
  const diff = unitNow - unitBefore;
  const pct = unitBefore ? Math.round((diff / unitBefore) * 100) : 0;
  const withThis = valid ? [...history, { quantity, price: amount }] : history;
  const avgNew = average(withThis);
  const avgOld = item ? average(itemBuys(overview, item.id)) : average([]);
  const suppliers = useMemo(
    () => [...new Set(overview.purchases.map((p) => p.supplier?.trim()).filter((s): s is string => !!s))],
    [overview.purchases]
  );

  const save = useMutation({
    mutationFn: async () => {
      const paid = pay !== "DUE";
      const source = pay === "DUE" ? "AUTRE" : pay;
      if (editing) {
        return stockApi.updatePurchase(editing.purchaseId, {
          date,
          supplier: supplier.trim() || null,
          paid,
          source,
          lines: [{ lotId: editing.lotId, quantity, price: amount }],
        });
      }
      return stockApi.createPurchase({
        date,
        source,
        paid,
        supplier: supplier.trim() || undefined,
        lines: [{ stockItemId: item!.id, quantity, price: amount }],
      });
    },
    onSuccess: () => {
      toast.success(
        editing ? "Achat corrigé : stock et coût moyen recalculés" : pay === "DUE" ? "Achat enregistré dans « À payer »" : "Achat enregistré"
      );
      onDone();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: () => stockApi.removePurchase(editing!.purchaseId),
    onSuccess: () => {
      toast.success("Achat supprimé (et sa dépense)");
      onDone();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(gradientDialogClass, "max-w-3xl sm:max-w-3xl")}>
        <GradientHeader
          eyebrow={editing ? "Corriger un achat" : "Nouvel achat"}
          title={item?.name ?? "Achat"}
          description="À gauche l’achat d’avant, à droite celui-ci."
          icon={ShoppingBasket}
        />
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {!editing ? (
            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Article</p>
                {onMulti ? (
                  <button
                    type="button"
                    onClick={onMulti}
                    className="text-xs font-semibold text-indigo-600 underline-offset-2 transition-colors hover:text-indigo-800 hover:underline"
                  >
                    Plusieurs articles d’un coup (ou stock de départ) →
                  </button>
                ) : null}
              </div>
              <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                {overview.items.map((i) => (
                  <Opt key={i.id} on={i.id === itemId} onClick={() => pickItem(i.id)}>
                    {i.name}
                  </Opt>
                ))}
              </div>
            </div>
          ) : editing.others.length ? (
            <p className="rounded-xl bg-muted px-3 py-2 text-[13px] text-muted-foreground">
              Cet achat contient aussi : {editing.others.join(", ")}. La date, le fournisseur et le paiement changent pour tout l’achat.
            </p>
          ) : null}

          {item ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5 rounded-2xl border border-dashed bg-muted/40 p-3.5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Achat d’avant</p>
                {before ? (
                  <>
                    <Kv label="Date">{day(before.date)}</Kv>
                    <Kv label="Quantité">{qty(before.quantity, before.unit)}</Kv>
                    <Kv label="Prix payé">{dt(before.price)}</Kv>
                    <Kv label="Prix unitaire">{perBuyUnit(unitBefore, item.unit)}</Kv>
                    <Kv label="Fournisseur">{before.supplier || "—"}</Kv>
                    <Kv label="Paiement">
                      <StatusPill tone={before.paid ? "ok" : "warn"}>{payLabel(before)}</StatusPill>
                    </Kv>
                  </>
                ) : (
                  <p className="text-[13px] text-muted-foreground">Premier achat de cet article.</p>
                )}
                <div className="border-t pt-1.5">
                  <Kv label="En stock maintenant">{qty(item.left, item.unit)}</Kv>
                </div>
              </div>

              <div className="space-y-2.5 rounded-2xl border-2 border-indigo-200 p-3.5 dark:border-indigo-900">
                <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-600">
                  {editing ? "Cet achat (corrigé)" : "Cet achat — maintenant"}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-[11px] font-semibold text-muted-foreground">
                    Quantité ({bu.label})
                    <Input autoFocus inputMode="decimal" className="mt-0.5 h-10 tabular-nums" value={q} onChange={(e) => setQ(e.target.value)} />
                  </label>
                  <label className="block text-[11px] font-semibold text-muted-foreground">
                    Prix payé (DT)
                    <Input inputMode="decimal" className="mt-0.5 h-10 tabular-nums" value={price} onChange={(e) => setPrice(e.target.value)} />
                  </label>
                  <label className="block text-[11px] font-semibold text-muted-foreground">
                    Date
                    <Input type="date" className="mt-0.5 h-10" value={date} onChange={(e) => setDate(e.target.value)} />
                  </label>
                  <label className="block text-[11px] font-semibold text-muted-foreground">
                    Fournisseur
                    <Input className="mt-0.5 h-10" list="stock-suppliers" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
                    <datalist id="stock-suppliers">
                      {suppliers.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </label>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                  <span className="text-muted-foreground">Prix unitaire</span>
                  <span className="flex items-center gap-2">
                    <b className="tabular-nums">{valid ? perBuyUnit(unitNow, item.unit) : "—"}</b>
                    {valid && before ? (
                      <span
                        key={Math.sign(Math.round(diff * 1e6))}
                        className={cn(
                          "animate-in fade-in-0 rounded-md px-2 py-0.5 text-xs font-bold duration-200 motion-reduce:animate-none",
                          Math.abs(diff) < 1e-6
                            ? "bg-muted text-muted-foreground"
                            : diff > 0
                              ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                        )}
                      >
                        {Math.abs(diff) < 1e-6
                          ? "même prix"
                          : `${diff > 0 ? "+" : "−"}${num3(Math.abs(diff) * bu.factor)} DT (${pct > 0 ? "+" : ""}${pct} %) vs avant`}
                      </span>
                    ) : null}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Ajoute d’abord un article dans Stock.</p>
          )}

          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Payé ?</p>
            <div className="flex flex-wrap gap-1.5">
              {PAY_OPTIONS.map((o) => (
                <Opt key={o.id} on={pay === o.id} due={o.id === "DUE"} onClick={() => setPay(o.id)}>
                  {o.label}
                </Opt>
              ))}
            </div>
            {pay === "DUE" ? (
              <p className="mt-2 animate-in fade-in-0 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-[13px] text-orange-800 duration-200 motion-reduce:animate-none dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300">
                Compté en dépense pour {format(new Date(`${date}T12:00:00`), "MMMM", { locale: fr })} quand même. Il reste dans « À payer »
                jusqu’à ce que tu cliques « Payer ».
              </p>
            ) : null}
          </div>

          {item ? (
            <div className="space-y-1 rounded-xl bg-indigo-50 px-3.5 py-3 text-[13px] text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200">
              <p className="flex items-center gap-1.5 font-semibold">
                <Calculator className="h-3.5 w-3.5" />
                Nouveau coût moyen : tous les achats additionnés ÷ la quantité totale
              </p>
              {withThis.length ? (
                <>
                  <p className="tabular-nums">
                    ({withThis.map((b) => num3(b.price)).join(" + ")}) ÷ ({withThis.map((b) => qty(b.quantity, item.unit)).join(" + ")})
                  </p>
                  <p className="text-[15px] font-black tabular-nums">
                    = {dt(avgNew.total)} ÷ {qty(avgNew.quantity, item.unit)} = {perBuyUnit(avgNew.perBase, item.unit)}
                  </p>
                </>
              ) : (
                <p>Tape la quantité et le prix.</p>
              )}
              <p className="tabular-nums text-indigo-700/80 dark:text-indigo-300/80">Avant : {avgOld.quantity ? perBuyUnit(avgOld.perBase, item.unit) : "—"}</p>
            </div>
          ) : null}
        </div>
        <DialogFooter className="gap-2 border-t px-6 py-3 sm:justify-between">
          {editing ? (
            <Button
              variant="ghost"
              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              disabled={remove.isPending}
              onClick={() => (confirmDelete ? remove.mutate() : setConfirmDelete(true))}
            >
              <Trash2 className="h-4 w-4" />
              {confirmDelete ? (editing.others.length ? "Supprimer tout l’achat ?" : "Confirmer la suppression") : "Supprimer l’achat"}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              className="rounded-xl bg-indigo-600 px-5 font-bold text-white hover:bg-indigo-700"
              disabled={!valid || save.isPending || !date}
              onClick={() => save.mutate()}
            >
              {editing ? "Enregistrer la correction" : "Enregistrer l’achat"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Pay the supplier of a purchase bought on credit. */
export function PayDialog({
  purchaseId,
  overview,
  onOpenChange,
  onDone,
}: {
  purchaseId: string | null;
  overview: StockOverview;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const p = overview.purchases.find((x) => x.id === purchaseId) ?? null;
  const [source, setSource] = useState<"CAISSE" | "COFFRE" | "AUTRE">("CAISSE");
  const [date, setDate] = useState(today());
  useEffect(() => {
    if (!purchaseId) return;
    setSource("CAISSE");
    setDate(today());
  }, [purchaseId]);
  const save = useMutation({
    mutationFn: () => stockApi.payPurchase(purchaseId!, { source, date }),
    onSuccess: () => {
      toast.success(`Payé depuis ${{ CAISSE: "la caisse", COFFRE: "le coffre", AUTRE: "Autre" }[source]}`);
      onDone();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={!!p} onOpenChange={onOpenChange}>
      {p ? (
        <DialogContent className={cn(gradientDialogClass, "max-w-md sm:max-w-md")}>
          <GradientHeader
            eyebrow="Payer le fournisseur"
            title={p.lots.map((l) => l.itemName).join(", ")}
            description={`Acheté le ${day(p.date)}${p.supplier ? ` · ${p.supplier}` : ""}`}
            icon={HandCoins}
          />
          <div className="space-y-4 px-6 py-5">
            <Kv label="Montant">
              <span className="text-lg">{dt(p.invested)}</span>
            </Kv>
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">L’argent sort de</p>
              <div className="flex flex-wrap gap-1.5">
                {(["CAISSE", "COFFRE", "AUTRE"] as const).map((s) => (
                  <Opt key={s} on={source === s} onClick={() => setSource(s)}>
                    {{ CAISSE: "Caisse", COFFRE: "Coffre", AUTRE: "Autre (banque, carte…)" }[s]}
                  </Opt>
                ))}
              </div>
            </div>
            <label className="block text-[11px] font-semibold text-muted-foreground">
              Payé le
              <Input type="date" className="mt-0.5 h-10" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <p className="text-xs text-muted-foreground">
              La dépense passe à ce jour et à cette source (c’est là que l’argent sort), et reste comptée pour{" "}
              {format(new Date(p.date), "MMMM", { locale: fr })} (« pour quel mois »).
            </p>
          </div>
          <DialogFooter className="gap-2 border-t px-6 py-3">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button className="rounded-xl bg-emerald-600 px-5 font-bold text-white hover:bg-emerald-700" disabled={save.isPending || !date} onClick={() => save.mutate()}>
              Marquer payé
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

/** ⓘ How the average cost of an article is computed. */
export function AvgCostDialog({
  itemId,
  overview,
  onOpenChange,
}: {
  itemId: string | null;
  overview: StockOverview;
  onOpenChange: (o: boolean) => void;
}) {
  const item = overview.items.find((i) => i.id === itemId) ?? null;
  const buys = item ? itemBuys(overview, item.id) : [];
  const avg = average(buys);
  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      {item ? (
        <DialogContent className={cn(gradientDialogClass, "max-w-lg sm:max-w-lg")}>
          <GradientHeader
            eyebrow="Coût moyen"
            title={item.name}
            description="Tous les achats additionnés ÷ la quantité totale achetée."
            icon={Calculator}
          />
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-5">
            {buys.length ? (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-[13px]">
                  <thead className="bg-muted/50 text-[11px] uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-right">Quantité</th>
                      <th className="px-3 py-2 text-right">Prix payé</th>
                      <th className="px-3 py-2 text-right">Unitaire</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buys.map((b) => (
                      <tr key={b.lotId} className="border-t">
                        <td className="px-3 py-2">{day(b.date)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{qty(b.quantity, b.unit)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{dt(b.price)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{perBuyUnit(b.price / b.quantity, b.unit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun achat pour l’instant.</p>
            )}
            {buys.length ? (
              <div className="space-y-1 rounded-xl bg-indigo-50 px-3.5 py-3 text-[13px] text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200">
                <p className="tabular-nums">
                  ({buys.map((b) => num3(b.price)).join(" + ")}) ÷ ({buys.map((b) => qty(b.quantity, b.unit)).join(" + ")})
                </p>
                <p className="text-[15px] font-black tabular-nums">
                  = {dt(avg.total)} ÷ {qty(avg.quantity, item.unit)} = {perBuyUnit(avg.perBase, item.unit)}
                </p>
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Source : tes achats (onglet Achats). Pour changer ce chiffre, corrige un achat. Il sert pour la marge : prix de vente − coût
              moyen.
            </p>
          </div>
          <DialogFooter className="border-t px-6 py-3">
            <Button className="rounded-xl bg-indigo-600 px-5 font-bold text-white hover:bg-indigo-700" onClick={() => onOpenChange(false)}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
