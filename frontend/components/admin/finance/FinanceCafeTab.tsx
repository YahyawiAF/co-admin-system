"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ListPager, usePaged } from "@/components/ui/list-pager";
import { cn } from "@/lib/utils";
import { analyticsApi } from "@/lib/api/resources";
import { dt } from "@/lib/finance-queries";
import type { CafeMonth } from "@/lib/types";
import { InfoButton, InfoCalc, ProgressBar } from "./InfoModal";

const day = (k: string) => format(new Date(`${k}T12:00:00`), "d MMM", { locale: fr });

function DailyBars({ c }: { c: CafeMonth }) {
  const [hover, setHover] = useState<CafeMonth["daily"][number] | null>(null);
  const rows = c.daily.slice(-28);
  const max = Math.max(1, ...rows.map((d) => d.products));
  const change = c.rate?.changedOn ?? null;
  return (
    <div>
      <div className="mb-2 min-h-5 text-sm" aria-live="polite">
        {hover ? (
          <>
            <b className="capitalize">{format(new Date(`${hover.key}T12:00:00`), "EEEE d MMM", { locale: fr })}</b> · café {dt(hover.products)} · {hover.visits} visites
            {hover.perVisit != null ? ` · ${dt(hover.perVisit, 2)} par visite` : ""}
          </>
        ) : (
          <span className="text-muted-foreground">Survolez un jour.</span>
        )}
      </div>
      <div className="flex h-40 items-end gap-[2px]" onMouseLeave={() => setHover(null)}>
        {rows.map((d) => (
          <button
            key={d.key}
            type="button"
            aria-label={day(d.key)}
            onMouseEnter={() => setHover(d)}
            onFocus={() => setHover(d)}
            className={cn("relative flex h-full min-w-0 flex-1 flex-col justify-end", change && d.key === change && "border-l-2 border-dashed border-foreground/50")}
          >
            <div
              className={cn("rounded-t-[4px] transition-[height] duration-500 motion-reduce:transition-none", change && d.key >= change ? "bg-primary" : "bg-primary/40", hover === d && "opacity-80")}
              style={{ height: `${(d.products / max) * 100}%` }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{rows[0] ? day(rows[0].key) : ""}</span>
        {change ? <span>changement le {day(change)}</span> : null}
        <span>{rows.length ? day(rows[rows.length - 1].key) : ""}</span>
      </div>
    </div>
  );
}

/** Finance › Café: café per visit (and the change of habit), each day, each product, offered and unpaid. */
export function FinanceCafeTab({ monthKey }: { monthKey: string }) {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  const q = useQuery({ queryKey: ["cafe", year, month], queryFn: () => analyticsApi.cafe(year, month) });
  const products = usePaged(q.data?.products ?? [], 20);
  if (q.isLoading) return <Skeleton className="h-96 rounded-xl" />;
  if (!q.data) return <p className="text-sm text-destructive">Café indisponible : {q.error?.message}</p>;
  const c = q.data;
  const r = c.rate;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-none">
          <CardContent className="space-y-1 p-4">
            <div className="text-xs font-medium text-muted-foreground">Ventes café · {c.period.label}</div>
            <div className="text-2xl font-bold tabular-nums">{dt(c.actual)}</div>
            <div className="text-xs text-muted-foreground">{c.visits} visites · {c.perVisitMonth != null ? `${dt(c.perVisitMonth, 2)} par visite` : "—"}</div>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="space-y-1 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Prévu fin du mois</span>
              <InfoButton title="Comment le café prévu est calculé">
                <InfoCalc>
                  Café prévu = vendu ({dt(c.actual)}) + visites prévues des jours restants ({Math.round(c.visitsLeft)}) × DT par visite ({r ? dt(r.perVisit, 2) : "?"})
                  <br />= {dt(c.expected)}
                </InfoCalc>
                <p><b>DT par visite</b> = café ÷ visites depuis le dernier changement d’habitude (au moins 3 jours), sinon sur les 14 derniers jours.</p>
                <p>Un changement = à partir d’un jour, le café par visite reste au moins 1,5× plus haut (ou plus bas) que les 14 jours d’avant. Ex. : plus de boissons de l’extérieur, nouveaux brownies.</p>
                <p>La prévision est refaite chaque soir avec les jours vécus : elle ne reste jamais sur le mois dernier.</p>
              </InfoButton>
            </div>
            <div className="text-2xl font-bold tabular-nums">≈ {dt(c.expected)}</div>
            <ProgressBar value={c.actual} max={c.expected} label="Café vendu sur le prévu" />
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="space-y-1 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Par visite</span>
              <InfoButton title="Le café par visite">
                <p>Ce que chaque visite laisse en café et produits, en moyenne.</p>
                {r?.changedOn ? (
                  <InfoCalc>
                    Avant le {day(r.changedOn)} : {r.before != null ? dt(r.before, 2) : "?"} par visite
                    <br />
                    Depuis : {dt(r.perVisit, 2)} par visite ({r.days} jours)
                  </InfoCalc>
                ) : (
                  <InfoCalc>14 derniers jours : {r ? dt(r.perVisit, 2) : "?"} par visite</InfoCalc>
                )}
              </InfoButton>
            </div>
            <div className="text-2xl font-bold tabular-nums">{r ? dt(r.perVisit, 2) : "—"}</div>
            <div className="text-xs text-muted-foreground">
              {r?.changedOn ? `depuis le ${day(r.changedOn)} · avant ${r.before != null ? dt(r.before, 2) : "?"}` : "14 derniers jours"}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="space-y-1 p-4">
            <div className="text-xs font-medium text-muted-foreground">Offert · pas payé</div>
            <div className="text-2xl font-bold tabular-nums">{c.offered.qty} · {c.unpaid.qty}</div>
            <div className="text-xs text-muted-foreground">
              offert {dt(c.offered.value)} · servi pas payé {dt(c.unpaid.value)}
            </div>
          </CardContent>
        </Card>
      </div>

      {r?.changedOn ? (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
          <b>Changement détecté le {day(r.changedOn)}</b> : le café par visite passe de {r.before != null ? dt(r.before, 2) : "?"} à {dt(r.perVisit, 2)}. La prévision utilise le nouveau niveau.
        </div>
      ) : null}

      <Card className="shadow-none">
        <CardContent className="p-5">
          <h2 className="mb-2 text-base font-semibold">Café jour par jour · 4 dernières semaines</h2>
          <DailyBars c={c} />
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardContent className="p-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Par produit · {c.period.label}</h2>
            <Link href="/products" className="text-sm font-medium text-primary hover:underline">Coûts et marges → Produits</Link>
          </div>
          {c.products.length ? (
            <div className="text-sm">
              <div className="grid grid-cols-[minmax(0,2fr)_70px_100px_minmax(0,1fr)] gap-3 border-b pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Produit</span>
                <span>Vendus</span>
                <span>Ventes</span>
                <span>Offert · pas payé</span>
              </div>
              {products.pageItems.map((p) => (
                <div key={p.id} className="grid grid-cols-[minmax(0,2fr)_70px_100px_minmax(0,1fr)] items-center gap-3 border-b py-2 tabular-nums last:border-0">
                  <span className="truncate font-medium">{p.name}</span>
                  <span>{p.qty}</span>
                  <span className="font-semibold">{dt(p.revenue, 2)}</span>
                  <span className="text-muted-foreground">
                    {p.offered ? `${p.offered} offert${p.offered > 1 ? "s" : ""}` : "—"}
                    {p.unpaidQty ? ` · ${p.unpaidQty} pas payé${p.unpaidQty > 1 ? "s" : ""} (${dt(p.unpaid, 2)})` : ""}
                  </span>
                </div>
              ))}
              <ListPager page={products.page} lastPage={products.lastPage} total={products.total} onPage={products.setPage} className="px-0" />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune vente ce mois.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
