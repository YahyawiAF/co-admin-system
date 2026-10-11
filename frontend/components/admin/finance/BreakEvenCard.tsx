"use client";

import Link from "next/link";
import { Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PerformanceOverview } from "@/lib/types";

const dt = (n: number | null | undefined) =>
  n == null ? "—" : `${Math.round(n).toLocaleString("fr-FR")} DT`;

/** Money needed this month to cover charges + daily spending, and what it means per day. */
export function BreakEvenCard({
  data,
  compact = false,
}: {
  data: PerformanceOverview;
  compact?: boolean;
}) {
  const b = data.breakEven;
  const revenue = data.current?.revenue ?? 0;
  const isCurrent = data.period.isCurrent;

  if (!b.hasCharges) {
    return (
      <Card className="border-dashed shadow-none">
        <CardContent className={cn("flex flex-wrap items-center justify-between gap-3", compact ? "p-4" : "p-5")}>
          <div className="flex items-center gap-3">
            <Scale className="h-7 w-7 shrink-0 text-indigo-500" />
            <div>
              <div className="font-semibold">Seuil de rentabilité</div>
              <p className="text-sm text-muted-foreground">
                Ajoutez vos charges du mois (loyer, internet, électricité, salaires…) pour savoir
                combien encaisser chaque jour sans perdre d&apos;argent.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/finance?tab=depenses">Ajouter mes charges</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const pct = b.coveredPct ?? 0;
  const losing = b.projectedProfit != null && b.projectedProfit < 0;
  return (
    <Card className="shadow-none">
      <CardContent className={cn("space-y-3", compact ? "p-4" : "p-5")}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Scale className="h-3.5 w-3.5" />
              Seuil de rentabilité du mois
            </div>
            <div className="text-2xl font-semibold tabular-nums">
              {dt(Math.min(revenue, b.total))}{" "}
              <span className="text-base font-normal text-muted-foreground">/ {dt(b.total)}</span>
            </div>
          </div>
          {b.projectedProfit != null ? (
            <div className="text-right">
              <div className="text-xs text-muted-foreground">
                {isCurrent ? "Bénéfice prévu fin de mois" : "Bénéfice du mois"}
              </div>
              <div
                className={cn(
                  "text-lg font-semibold tabular-nums",
                  losing ? "text-rose-600" : "text-emerald-700",
                )}
              >
                {b.projectedProfit > 0 ? "+" : ""}
                {dt(b.projectedProfit)}
              </div>
            </div>
          ) : null}
        </div>

        <div className="h-3 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              b.reached ? "bg-emerald-500" : losing ? "bg-rose-500" : "bg-indigo-500",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>

        {!compact ? (
          <div className="text-xs text-muted-foreground">
            Charges {dt(b.fixed)}
            {b.fixedRemaining > 0 ? ` (dont ${dt(b.fixedRemaining)} encore à payer)` : ""} + petites
            dépenses ~{dt(b.dailyProjected)}
          </div>
        ) : null}

        {b.reached ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Frais du mois couverts. {isCurrent ? "Tout ce que vous encaissez maintenant est du bénéfice." : ""}
          </p>
        ) : isCurrent && b.neededPerDay != null ? (
          <p
            className={cn(
              "rounded-lg px-3 py-2 text-sm",
              losing ? "bg-rose-50 text-rose-800" : "bg-indigo-50 text-indigo-900",
            )}
          >
            Encaissez <b>{dt(b.neededPerDay)} par jour</b>
            {b.visitsPerDay ? <> (≈ {b.visitsPerDay} visites)</> : null} jusqu&apos;à la fin du mois
            pour couvrir vos frais
            {data.current ? `, vous faites ${dt(data.current.revenuePerDay)} par jour en moyenne` : ""}.
            {losing ? " À ce rythme, le mois finit en perte." : ""}
          </p>
        ) : !isCurrent ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
            Il a manqué {dt(b.remaining)} pour couvrir les frais de ce mois.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
