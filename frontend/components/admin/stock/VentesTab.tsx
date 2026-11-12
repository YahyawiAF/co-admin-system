"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ListPager } from "@/components/ui/list-pager";
import { Skeleton } from "@/components/ui/skeleton";
import { MemberSearchSelect } from "@/components/admin/MemberSearchSelect";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/query-client";
import { membersApi, mobileApi, salesApi, type SaleFilter, type SaleRow, type StockOverview } from "@/lib/api/resources";
import { dayKey, today } from "./buys";
import { GradientHeader, StatusPill, dt, gradientDialogClass, parseNum, qty } from "./stock-ui";

const PAGE = 20;
const day = (d: string) => format(new Date(d), "d MMM", { locale: fr });
const FILTERS: { id: SaleFilter; label: string }[] = [
  { id: "all", label: "Toutes" },
  { id: "unpaid", label: "Non payées" },
  { id: "paid", label: "Payées" },
];
const enter = (i: number) => ({
  className: "animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both duration-300 motion-reduce:animate-none",
  style: { animationDelay: `${Math.min(i, 8) * 30}ms` },
});

export const salesKey = ["stock-sales"] as const;

/** Sale window target: a sale to correct, or a new forgotten sale (optionally for a product). */
export type SaleTarget = { sale: SaleRow } | { productId: string | null };

export function VentesTab({
  filter,
  onFilter,
  onSale,
  onChanged,
}: {
  filter: SaleFilter;
  onFilter: (f: SaleFilter) => void;
  onSale: (t: SaleTarget) => void;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<Set<string>>(new Set());
  useEffect(() => {
    setPage(1);
    setSel(new Set());
  }, [filter]);

  const { data, isLoading } = useQuery({
    queryKey: [...salesKey, filter, page],
    queryFn: () => salesApi.list(filter, page, PAGE),
    placeholderData: keepPreviousData,
  });
  const rows = data?.rows ?? [];

  const setPaid = useMutation({
    mutationFn: async ({ ids, isPayed }: { ids: string[]; isPayed: boolean }) => {
      for (const id of ids) await mobileApi.payOrder(id, isPayed);
      return { n: ids.length, isPayed };
    },
    onSuccess: ({ n, isPayed }) => {
      toast.success(n > 1 ? `${n} ventes marquées ${isPayed ? "payées" : "non payées"}` : `Vente marquée ${isPayed ? "payée" : "non payée"}`);
      setSel(new Set());
      queryClient.invalidateQueries({ queryKey: salesKey });
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const allOn = rows.length > 0 && rows.every((r) => sel.has(r.id));
  const selRows = rows.filter((r) => sel.has(r.id));
  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const lastPage = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Ventes notées" value={data ? dt(data.totals.amount) : "…"} hint={data ? `${data.totals.count} ventes` : ""} />
        <Kpi
          label="Non payées"
          value={data ? dt(data.totals.unpaidAmount) : "…"}
          hint={data ? `${data.totals.unpaidCount} ventes à encaisser` : ""}
          tone="warn"
          onClick={() => onFilter("unpaid")}
        />
        <Kpi
          label="Payées"
          value={data ? dt(data.totals.amount - data.totals.unpaidAmount) : "…"}
          hint={data ? `${data.totals.count - data.totals.unpaidCount} ventes` : ""}
          tone="good"
          onClick={() => onFilter("paid")}
        />
        <button
          type="button"
          onClick={() => onSale({ productId: null })}
          className="flex flex-col items-start justify-center gap-1 rounded-2xl border-2 border-dashed border-indigo-300 p-3.5 text-left text-indigo-700 transition-colors duration-200 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
        >
          <span className="flex items-center gap-1.5 font-extrabold">
            <Plus className="h-4 w-4" /> Vente oubliée
          </span>
          <span className="text-xs text-muted-foreground">Une vente pas notée le jour même</span>
        </button>
      </div>

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex flex-wrap items-center gap-2 p-4 pb-3">
          <h2 className="text-base font-extrabold">Ventes</h2>
          <p className="text-[13px] text-muted-foreground">Clique sur « Payé / Non payé » pour corriger. Coche plusieurs lignes pour tout changer d’un coup.</p>
          <span className="flex-1" />
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filtrer les ventes">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                onClick={() => onFilter(f.id)}
                className={cn(
                  "min-h-8 rounded-full border px-3.5 text-[13px] font-semibold transition-colors duration-200 motion-reduce:transition-none",
                  filter === f.id ? "border-foreground bg-foreground text-background" : "bg-background text-muted-foreground hover:border-indigo-300"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-[13px]">
            <thead className="border-y bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-10 px-4 py-2">
                  <input
                    type="checkbox"
                    aria-label="Tout cocher"
                    className="h-4 w-4 accent-indigo-600"
                    checked={allOn}
                    onChange={() => setSel(allOn ? new Set() : new Set(rows.map((r) => r.id)))}
                  />
                </th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Produit</th>
                <th className="px-3 py-2 text-left">Membre</th>
                <th className="px-3 py-2 text-right">Qté</th>
                <th className="px-3 py-2 text-right">Prix</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-left">Paiement</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody key={`${filter}-${page}`}>
              {isLoading && !data
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td colSpan={9} className="px-4 py-2">
                        <Skeleton className="h-6" />
                      </td>
                    </tr>
                  ))
                : rows.map((r, i) => {
                    const { className, style } = enter(i);
                    const on = sel.has(r.id);
                    return (
                      <tr
                        key={r.id}
                        style={style}
                        className={cn(
                          className,
                          "border-b transition-colors duration-200 last:border-0",
                          on ? "bg-indigo-50 dark:bg-indigo-950/30" : "hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20"
                        )}
                      >
                        <td className="px-4 py-2">
                          <input type="checkbox" aria-label="Cocher la vente" className="h-4 w-4 accent-indigo-600" checked={on} onChange={() => toggle(r.id)} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums">{day(r.date)}</td>
                        <td className="px-3 py-2">
                          <b>{r.productName}</b>
                          {r.editedAt ? (
                            <span className="ml-1.5">
                              <StatusPill tone="info">corrigée</StatusPill>
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">{r.memberName || "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.quantity}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{dt(r.unitPrice)}</td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums">{dt(r.total)}</td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            disabled={setPaid.isPending}
                            onClick={() => setPaid.mutate({ ids: [r.id], isPayed: !r.isPayed })}
                            aria-label={r.isPayed ? "Marquer non payée" : "Marquer payée"}
                            className={cn(
                              "inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-colors duration-200 motion-reduce:transition-none",
                              r.isPayed
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300"
                            )}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {r.isPayed ? "Payé" : "Non payé"}
                          </button>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Button size="sm" variant="outline" className="h-8 rounded-lg" onClick={() => onSale({ sale: r })}>
                            <Pencil className="h-3.5 w-3.5" /> Modifier
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
              {data && !rows.length ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    {filter === "unpaid" ? "Aucune vente non payée." : "Aucune vente."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <ListPager page={page} lastPage={lastPage} total={data?.total ?? 0} onPage={setPage} />
      </section>

      {selRows.length ? (
        <div className="sticky bottom-3 z-10 flex animate-in fade-in-0 slide-in-from-bottom-2 flex-wrap items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-white shadow-xl duration-200 motion-reduce:animate-none">
          <b>
            {selRows.length} vente{selRows.length > 1 ? "s" : ""} cochée{selRows.length > 1 ? "s" : ""}
          </b>
          <span className="text-[13px] text-slate-300 tabular-nums">{dt(selRows.reduce((s, r) => s + r.total, 0))}</span>
          <span className="flex-1" />
          <Button
            size="sm"
            className="rounded-lg bg-emerald-600 font-bold text-white hover:bg-emerald-700"
            disabled={setPaid.isPending}
            onClick={() => setPaid.mutate({ ids: selRows.filter((r) => !r.isPayed).map((r) => r.id), isPayed: true })}
          >
            Marquer payées
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="rounded-lg"
            disabled={setPaid.isPending}
            onClick={() => setPaid.mutate({ ids: selRows.filter((r) => r.isPayed).map((r) => r.id), isPayed: false })}
          >
            Marquer non payées
          </Button>
          <Button size="sm" variant="ghost" className="rounded-lg text-white hover:bg-white/10 hover:text-white" onClick={() => setSel(new Set())}>
            Annuler
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "warn";
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "rounded-2xl border bg-card p-3.5 text-left",
        onClick && "transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-indigo-200 motion-reduce:hover:translate-y-0"
      )}
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        key={value}
        className={cn(
          "animate-in fade-in-0 text-xl font-black tabular-nums duration-200 motion-reduce:animate-none",
          tone === "good" && "text-emerald-600",
          tone === "warn" && "text-orange-600"
        )}
      >
        {value}
      </p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </Tag>
  );
}

/** Correct a sale (quantity, price, product, date) or add a forgotten one. */
export function SaleDialog({
  target,
  overview,
  onOpenChange,
  onDone,
}: {
  target: SaleTarget | null;
  overview: StockOverview;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const sale = target && "sale" in target ? target.sale : null;
  const [productId, setProductId] = useState("");
  const [q, setQ] = useState("1");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(today());
  const [memberId, setMemberId] = useState("");
  const [paid, setPaid] = useState(true);
  const [search, setSearch] = useState("");

  const { data: members = [] } = useQuery({
    queryKey: queryKeys.members,
    queryFn: () => membersApi.list(),
    enabled: !!target && !sale,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!target) return;
    setSearch("");
    if (sale) {
      setProductId(sale.productId);
      setQ(String(sale.quantity));
      setPrice(String(sale.unitPrice).replace(".", ","));
      setDate(dayKey(sale.date));
      setMemberId(sale.memberId ?? "");
      setPaid(sale.isPayed);
      return;
    }
    const pid = ("productId" in target && target.productId) || overview.products[0]?.id || "";
    setProductId(pid);
    setQ("1");
    setPrice(String(overview.products.find((p) => p.id === pid)?.sellingPrice ?? "").replace(".", ","));
    setDate(today());
    setMemberId("");
    setPaid(true);
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  const product = overview.products.find((p) => p.id === productId) ?? null;
  const n = Math.round(parseNum(q));
  const unit = parseNum(price);
  const valid = !!product && n >= 1 && Number.isFinite(unit) && unit >= 0 && !!date;
  const shown = overview.products.filter((p) => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase()));

  const save = useMutation({
    mutationFn: async () => {
      const unitPrice = Math.abs(unit - (product?.sellingPrice ?? 0)) < 1e-9 ? null : unit;
      if (sale) {
        await salesApi.update(sale.id, { productId, quantite: n, date, unitPrice });
        if (paid !== sale.isPayed) await mobileApi.payOrder(sale.id, paid);
        return;
      }
      await salesApi.create({ productId, quantite: n, date, unitPrice, memberId: memberId || null, isPayed: paid });
    },
    onSuccess: () => {
      toast.success(sale ? "Vente corrigée, stock mis à jour" : "Vente ajoutée, stock mis à jour");
      onDone();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      {target ? (
        <DialogContent className={cn(gradientDialogClass, "max-w-lg sm:max-w-lg")}>
          <GradientHeader
            eyebrow={sale ? "Modifier la vente" : "Vente oubliée"}
            title={product?.name ?? "Vente"}
            description={sale ? "Change la quantité, le prix ou le paiement." : "Pour une vente qui n’a pas été notée le jour même."}
            icon={Receipt}
          />
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {sale ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed bg-muted/40 px-3 py-2 text-[13px]">
                <span>
                  <span className="text-muted-foreground">Enregistré avant : </span>
                  <b className="tabular-nums">
                    {sale.quantity} × {sale.productName} à {dt(sale.unitPrice)} = {dt(sale.total)}
                  </b>
                </span>
                <StatusPill tone={sale.isPayed ? "ok" : "warn"}>{sale.isPayed ? "Payé" : "Non payé"}</StatusPill>
              </div>
            ) : null}
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Produit</p>
              {overview.products.length > 8 ? (
                <Input className="mb-1.5 h-9" placeholder="Chercher un produit" value={search} onChange={(e) => setSearch(e.target.value)} />
              ) : null}
              <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                {shown.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={p.id === productId}
                    onClick={() => {
                      setProductId(p.id);
                      setPrice(String(p.sellingPrice).replace(".", ","));
                    }}
                    className={cn(
                      "min-h-9 rounded-xl border px-3 text-sm font-bold transition-colors duration-200 motion-reduce:transition-none",
                      p.id === productId
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                        : "bg-background hover:border-indigo-300"
                    )}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[11px] font-semibold text-muted-foreground">
                Quantité
                <Input inputMode="numeric" className="mt-0.5 h-10 tabular-nums" value={q} onChange={(e) => setQ(e.target.value)} />
              </label>
              <label className="block text-[11px] font-semibold text-muted-foreground">
                Prix unitaire (DT)
                <Input inputMode="decimal" className="mt-0.5 h-10 tabular-nums" value={price} onChange={(e) => setPrice(e.target.value)} />
              </label>
              <label className="block text-[11px] font-semibold text-muted-foreground">
                Date
                <Input type="date" className="mt-0.5 h-10" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              {sale ? (
                <div className="text-[11px] font-semibold text-muted-foreground">
                  Membre
                  <p className="mt-0.5 flex h-10 items-center text-sm font-normal text-foreground">{sale.memberName || "—"}</p>
                </div>
              ) : (
                <div className="text-[11px] font-semibold text-muted-foreground">
                  Membre (facultatif)
                  <MemberSearchSelect className="mt-0.5" members={members} value={memberId} onChange={setMemberId} placeholder="Personne" />
                </div>
              )}
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Payé ?</p>
              <div className="flex gap-1.5">
                {[true, false].map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    aria-pressed={paid === v}
                    onClick={() => setPaid(v)}
                    className={cn(
                      "min-h-10 rounded-xl border px-4 text-sm font-bold transition-colors duration-200 motion-reduce:transition-none",
                      paid === v
                        ? v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"
                        : "bg-background hover:border-indigo-300"
                    )}
                  >
                    {v ? "Payé" : "Non payé"}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-0.5 rounded-xl bg-indigo-50 px-3.5 py-3 text-[13px] text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200">
              <p>
                Total : <b className="tabular-nums">{valid ? dt(n * unit) : "—"}</b>
              </p>
              <p>
                Stock utilisé :{" "}
                {product?.recipe.length && n >= 1
                  ? product.recipe.map((l) => `${qty(l.quantity * n, l.unit)} ${l.itemName.toLowerCase()}`).join(", ")
                  : "pas suivi (pas de recette)"}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 border-t px-6 py-3">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button className="rounded-xl bg-indigo-600 px-5 font-bold text-white hover:bg-indigo-700" disabled={!valid || save.isPending} onClick={() => save.mutate()}>
              {sale ? "Enregistrer" : "Ajouter la vente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
