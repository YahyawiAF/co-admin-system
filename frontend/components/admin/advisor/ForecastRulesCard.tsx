"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowRight, CheckCircle2, CircleAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { analyticsApi } from "@/lib/api/resources";

const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR");
const r50 = (n: number) => Math.round(n / 50) * 50;
const dayLabel = (key: string) => format(new Date(`${key}T12:00:00`), "d MMM", { locale: fr });
const factorLabel = (f: number) => `${f >= 1 ? "+" : "−"}${Math.round(Math.abs(f - 1) * 100)} %`;

/**
 * Conseiller: this month's prediction with the rules behind it, and how the
 * stored predictions of the last months compared with what happened.
 */
export function ForecastRulesCard() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const forecast = useQuery({
    queryKey: ["performance", "forecast", year, month],
    queryFn: () => analyticsApi.performanceForecast(year, month),
  });
  const accuracy = useQuery({
    queryKey: ["performance", "forecast", "accuracy"],
    queryFn: () => analyticsApi.performanceForecastAccuracy(),
  });
  const f = forecast.data;
  const s = f?.subscriptions;

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Prévision du mois et ses règles</CardTitle>
          <Link href="/finance" className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline">
            Détail jour par jour <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          Calculée par des règles, pas devinée. Chaque mois, la prévision est gardée puis comparée au réel.
        </p>
      </CardHeader>
      <CardContent className="grid gap-5 lg:grid-cols-2">
        {!f || !s ? (
          <Skeleton className="h-40" />
        ) : (
          <div className="space-y-2 text-sm motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums">{fmt(r50(f.expected.total))} DT</span>
              <span className="text-muted-foreground">
                prévus en {f.period.label} · fourchette {fmt(r50(f.expected.low))} – {fmt(r50(f.expected.high))}
              </span>
            </div>
            <ul className="space-y-1.5">
              <li>
                <b>Passes + café {fmt(r50(f.expected.variable))} DT</b> : chaque jour = moyenne du même jour de semaine avant le mois,
                sans jours fériés ni périodes.
              </li>
              <li>
                <b>Calendrier {f.expected.periodsEffect ? `${f.expected.periodsEffect > 0 ? "+" : "−"}${fmt(Math.abs(f.expected.periodsEffect))} DT` : ""}</b>
                {f.periods.length ? " : " : " : aucune période ce mois-ci."}
                {f.periods.map((p, i) => (
                  <span key={`${p.label}-${p.from}`}>
                    {i ? " · " : ""}
                    {p.label} ({dayLabel(p.from)}) {p.known ? factorLabel(p.factor) : "effet inconnu"}
                  </span>
                ))}
              </li>
              <li>
                <b>Abonnements {fmt(r50(f.expected.subscriptions))} DT</b> : {s.endingCount} finissent ×{" "}
                {s.renewalRatePct != null ? `${s.renewalRatePct} %` : "40 %"} renouvelés + {fmt(s.newPace)} DT de nouveaux. Jamais
                répartis par jour.
              </li>
            </ul>
          </div>
        )}

        <div className="space-y-2 text-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Précision des prévisions</div>
          {accuracy.isLoading ? (
            <Skeleton className="h-24" />
          ) : !accuracy.data?.months.length ? (
            <p className="text-muted-foreground">
              La prévision de ce mois est gardée. Elle sera comparée au réel à la fin du mois.
            </p>
          ) : (
            accuracy.data.months.map((m) => {
              const total = m.lines.find((l) => l.key === "total")!;
              const ok = total.errorPct != null && Math.abs(total.errorPct) <= 10;
              return (
                <div
                  key={`${m.year}-${m.month}`}
                  className="space-y-1.5 rounded-lg border p-3 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <CircleAlert className="h-4 w-4 text-amber-600" />}
                    <b className="capitalize">{m.label}</b>
                    <span className="text-muted-foreground">
                      prévu {fmt(total.predicted)} · réel {fmt(total.actual)} DT
                      {total.errorPct != null ? ` (${total.errorPct > 0 ? "+" : ""}${total.errorPct} %)` : ""}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {m.lines
                      .filter((l) => l.key !== "total")
                      .map((l) => (
                        <span
                          key={l.key}
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs",
                            l.errorPct != null && Math.abs(l.errorPct) > 15 ? "bg-amber-100 text-amber-800" : "bg-muted",
                          )}
                        >
                          {l.label} {l.errorPct != null ? `${l.errorPct > 0 ? "+" : ""}${l.errorPct} %` : "—"}
                        </span>
                      ))}
                  </div>
                  {m.periods.map((p) => (
                    <div key={p.label} className="text-xs text-muted-foreground">
                      {p.label} : supposé {p.assumedFactor != null ? factorLabel(p.assumedFactor) : "inconnu"}, mesuré{" "}
                      {p.measuredFactor != null ? factorLabel(p.measuredFactor) : "—"}
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
