"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Archive, CreditCard, Hourglass, Landmark, Plus, ShoppingBasket, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { stockApi, type StockOverview, type StockPurchaseRow, type StockUnit } from "@/lib/api/resources";
import {
  ChoiceCard,
  GradientHeader,
  SectionTitle,
  SOURCE_LABEL,
  StepPills,
  buyUnit,
  dt,
  dt3,
  gradientDialogClass,
  parseNum,
  possibleAfter,
  qty,
} from "./stock-ui";

type Line = { key: number; stockItemId: string; q: string; price: string };
const STEPS = ["Articles", "Paiement", "Résumé"];
let keySeq = 1;

/** Last lot bought per item: default quantity and price for the next purchase. */
function lastLots(purchases: StockPurchaseRow[]) {
  const out = new Map<string, { quantity: number; price: number }>();
  for (const p of purchases) for (const l of p.lots) if (!out.has(l.stockItemId)) out.set(l.stockItemId, { quantity: l.quantity, price: l.price });
  return out;
}

export function PurchaseDialog({
  open,
  onOpenChange,
  overview,
  preselect,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  overview: StockOverview;
  /** Open with this item already in the list */
  preselect?: string | null;
  onDone: () => void;
}) {
  const items = overview.items;
  const last = useMemo(() => lastLots(overview.purchases), [overview.purchases]);
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const [step, setStep] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);
  const [source, setSource] = useState<StockPurchaseRow["source"]>("CAISSE");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [note, setNote] = useState("");
  const [supplier, setSupplier] = useState("");
  /** Bought on credit: « pas encore payé » */
  const [due, setDue] = useState(false);

  const lineFor = (stockItemId: string): Line => {
    const item = itemById.get(stockItemId);
    const l = last.get(stockItemId);
    const f = item ? buyUnit(item.unit).factor : 1;
    return {
      key: keySeq++,
      stockItemId,
      q: l ? String(+(l.quantity / f).toFixed(3)).replace(".", ",") : "",
      price: l ? String(l.price).replace(".", ",") : "",
    };
  };

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setSource("CAISSE");
    setDate(format(new Date(), "yyyy-MM-dd"));
    setNote("");
    setSupplier("");
    setDue(false);
    if (preselect) setLines([lineFor(preselect)]);
    else {
      // Items running out first, so the usual restock is one click away
      const low = [...items]
        .filter((i) => i.hasLots && (i.left <= 0 || (i.daysLeft != null && i.daysLeft < 7)))
        .slice(0, 3);
      setLines(low.length ? low.map((i) => lineFor(i.id)) : items[0] ? [lineFor(items[0].id)] : []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preselect]);

  const valid = lines.filter((l) => l.stockItemId && parseNum(l.q) > 0 && parseNum(l.price) >= 0 && l.price.trim() !== "");
  const total = valid.reduce((s, l) => s + parseNum(l.price), 0);
  const set = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const save = useMutation({
    mutationFn: () =>
      stockApi.createPurchase({
        date,
        source: due ? "AUTRE" : source,
        paid: !due,
        supplier: supplier.trim() || undefined,
        note: note.trim() || undefined,
        lines: valid.map((l) => {
          const unit = itemById.get(l.stockItemId)!.unit;
          return { stockItemId: l.stockItemId, quantity: parseNum(l.q) * buyUnit(unit).factor, price: parseNum(l.price) };
        }),
      }),
    onSuccess: (r) => {
      toast.success(
        due
          ? `Achat enregistré dans « À payer » · ${dt(r.total)}`
          : r.expenseId
            ? `Achat enregistré · dépense ${dt(r.total)} (${SOURCE_LABEL[source]})`
            : "Stock de départ enregistré"
      );
      onDone();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const next = () => {
    if (step === 0 && !valid.length) return toast.error("Ajoute au moins un article avec sa quantité et son prix");
    if (step < 2) setStep(step + 1);
    else save.mutate();
  };

  const add: Record<string, number> = {};
  for (const l of valid) {
    const unit = itemById.get(l.stockItemId)!.unit;
    add[l.stockItemId] = (add[l.stockItemId] ?? 0) + parseNum(l.q) * buyUnit(unit).factor;
  }
  const gains = possibleAfter(overview, add).filter((g) => g.after !== g.before);
  const label = valid
    .map((l) => {
      const it = itemById.get(l.stockItemId)!;
      return `${it.name} ${qty(parseNum(l.q) * buyUnit(it.unit).factor, it.unit)}`;
    })
    .join(", ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(gradientDialogClass, "max-w-3xl sm:max-w-3xl")}>
        <GradientHeader
          eyebrow="Réassort · plusieurs articles"
          title="Nouvel achat"
          icon={ShoppingBasket}
          description="Une ligne par article acheté. Le total devient une dépense dans Finance."
        >
          {items.length ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-0.5 text-[11px] font-bold text-indigo-100">Ajouter :</span>
              {items.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => {
                    setStep(0);
                    setLines((ls) => [...ls, lineFor(i.id)]);
                  }}
                  className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm transition-colors duration-200 hover:bg-white/25 motion-reduce:transition-none"
                >
                  <Plus className="h-3 w-3" />
                  {i.name}
                </button>
              ))}
            </div>
          ) : null}
        </GradientHeader>

        <div className="border-b bg-muted/30 px-6 py-3">
          <StepPills steps={STEPS} current={step} onPick={setStep} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {step === 0 ? (
            <div key="s0" className="animate-in fade-in-0 slide-in-from-bottom-1 space-y-2 duration-200 motion-reduce:animate-none">
              {!items.length ? (
                <p className="rounded-xl bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
                  Crée d’abord tes ingrédients dans l’onglet « Ingrédients ».
                </p>
              ) : null}
              {lines.map((l) => {
                const it = itemById.get(l.stockItemId);
                const unit: StockUnit = it?.unit ?? "pc";
                const bu = buyUnit(unit);
                const q = parseNum(l.q);
                const per = q > 0 ? parseNum(l.price) / q : 0;
                const prev = last.get(l.stockItemId);
                const prevPer = prev ? prev.price / (prev.quantity / bu.factor) : 0;
                const diff = prevPer > 0 && per > 0 ? ((per - prevPer) / prevPer) * 100 : 0;
                return (
                  <div
                    key={l.key}
                    className="grid animate-in fade-in-0 grid-cols-[1fr_auto] items-end gap-3 rounded-xl border p-3 duration-200 motion-reduce:animate-none sm:grid-cols-[1fr_120px_130px_auto]"
                  >
                    <label className="col-span-2 min-w-0 text-[11px] font-semibold text-muted-foreground sm:col-span-1">
                      Article
                      <select
                        className="mt-0.5 h-9 w-full rounded-lg border bg-background px-2 text-sm font-semibold text-foreground"
                        value={l.stockItemId}
                        onChange={(e) => {
                          const fresh = lineFor(e.target.value);
                          set(l.key, { stockItemId: e.target.value, q: fresh.q, price: fresh.price });
                        }}
                      >
                        {items.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name}
                          </option>
                        ))}
                      </select>
                      <span
                        className={cn(
                          "mt-1 block text-[11px] font-medium",
                          Math.abs(diff) >= 1 ? (diff > 0 ? "text-rose-600" : "text-emerald-600") : "text-muted-foreground"
                        )}
                      >
                        {per > 0 ? `${dt3(per)} / ${bu.label}` : " "}
                        {Math.abs(diff) >= 1 ? ` · ${diff > 0 ? "+" : ""}${Math.round(diff)} % vs dernier achat` : ""}
                      </span>
                    </label>
                    <label className="text-[11px] font-semibold text-muted-foreground">
                      Quantité ({bu.label})
                      <Input
                        inputMode="decimal"
                        className="mt-0.5 h-9 tabular-nums"
                        value={l.q}
                        onChange={(e) => set(l.key, { q: e.target.value })}
                      />
                    </label>
                    <label className="text-[11px] font-semibold text-muted-foreground">
                      Prix payé (DT)
                      <Input
                        inputMode="decimal"
                        className="mt-0.5 h-9 tabular-nums"
                        value={l.price}
                        onChange={(e) => set(l.key, { price: e.target.value })}
                      />
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mb-0.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-600"
                      aria-label="Retirer"
                      onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
              {items.length ? (
                <p className="pt-1 text-xs text-muted-foreground">
                  Quantité et prix sont repris du dernier achat. Change-les si besoin.
                </p>
              ) : null}
            </div>
          ) : step === 1 ? (
            <div key="s1" className="animate-in fade-in-0 slide-in-from-bottom-1 space-y-5 duration-200 motion-reduce:animate-none">
              <section>
                <SectionTitle>Payé depuis</SectionTitle>
                <div className="grid gap-2 sm:grid-cols-2">
                  <ChoiceCard active={!due && source === "CAISSE"} onClick={() => { setDue(false); setSource("CAISSE"); }} icon={Wallet} title="Caisse" hint="Argent du tiroir" />
                  <ChoiceCard active={!due && source === "COFFRE"} onClick={() => { setDue(false); setSource("COFFRE"); }} icon={Landmark} title="Coffre" hint="Pris dans le coffre" />
                  <ChoiceCard active={!due && source === "AUTRE"} onClick={() => { setDue(false); setSource("AUTRE"); }} icon={CreditCard} title="Autre" hint="Carte, virement, de ta poche" />
                  <ChoiceCard
                    active={!due && source === "NONE"}
                    onClick={() => {
                      setDue(false);
                      setSource("NONE");
                    }}
                    icon={Archive}
                    title="Stock de départ"
                    hint="Déjà payé avant : pas de dépense"
                  />
                  <ChoiceCard
                    active={due}
                    onClick={() => setDue(true)}
                    icon={Hourglass}
                    title="Pas encore payé"
                    hint="Compté en dépense, à payer plus tard"
                  />
                </div>
              </section>
              <div className="flex flex-wrap gap-4">
                <label className="text-[11px] font-semibold text-muted-foreground">
                  Date
                  <Input type="date" className="mt-0.5 h-9 w-44" value={date} onChange={(e) => setDate(e.target.value)} />
                </label>
                <label className="min-w-0 flex-1 text-[11px] font-semibold text-muted-foreground">
                  Fournisseur
                  <Input
                    className="mt-0.5 h-9"
                    list="stock-suppliers-multi"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    placeholder="Optionnel"
                  />
                  <datalist id="stock-suppliers-multi">
                    {[...new Set(overview.purchases.map((p) => p.supplier?.trim()).filter(Boolean))].map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </label>
                <label className="min-w-0 flex-1 text-[11px] font-semibold text-muted-foreground">
                  Note
                  <Input className="mt-0.5 h-9" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optionnel" />
                </label>
              </div>
            </div>
          ) : (
            <div key="s2" className="animate-in fade-in-0 slide-in-from-bottom-1 grid gap-4 duration-200 motion-reduce:animate-none sm:grid-cols-2">
              <div className="rounded-xl border p-4">
                <SectionTitle>{!due && source === "NONE" ? "Stock de départ" : "Dépense créée dans Finance"}</SectionTitle>
                <p className="font-bold">{!due && source === "NONE" ? label : `${due ? "À payer — " : ""}Achat stock — ${label}`}</p>
                <p className="mt-1 text-2xl font-black tabular-nums">{dt(total)}</p>
                <p className="text-xs text-muted-foreground">
                  {due
                    ? "Pas encore payé : dans « À payer »"
                    : source === "NONE"
                      ? "Compté dans l’investissement, pas dans les dépenses"
                      : `Payé depuis ${SOURCE_LABEL[source]}`}{" "}
                  ·{" "}
                  {format(new Date(date), "dd/MM/yyyy")}
                </p>
              </div>
              <div className="rounded-xl border p-4">
                <SectionTitle>Ce que tu pourras servir</SectionTitle>
                <ul className="space-y-1.5 text-sm">
                  {gains.length ? (
                    gains.map((g) => (
                      <li key={g.id} className="flex justify-between gap-2">
                        <span className="truncate">{g.name}</span>
                        <span className="shrink-0 tabular-nums">
                          <span className="text-muted-foreground">{g.before}</span> → <b>{g.after}</b>
                        </span>
                      </li>
                    ))
                  ) : (
                    <li className="text-muted-foreground">Aucun produit ne change (pas de recette avec ces articles).</li>
                  )}
                </ul>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Si un lot du même article est encore ouvert, le nouveau attend qu’il soit fini.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-3 border-t px-6 py-3 sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Total{" "}
            <span key={total} className="ml-1 animate-in fade-in-0 text-lg font-black tabular-nums text-foreground duration-200 motion-reduce:animate-none">
              {dt(total)}
            </span>
          </p>
          <div className="flex gap-2">
            {step > 0 ? (
              <Button variant="outline" className="rounded-xl" onClick={() => setStep(step - 1)}>
                Retour
              </Button>
            ) : null}
            <Button
              className="rounded-xl bg-indigo-600 px-5 font-bold text-white transition-colors hover:bg-indigo-700"
              disabled={save.isPending || !items.length}
              onClick={next}
            >
              {step === 2 ? "Enregistrer l’achat" : "Suivant"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
