"use client";

import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { analyticsApi } from "@/lib/api/resources";
import { managerApi } from "@/lib/api/manager";
import { dt } from "@/lib/finance-queries";
import type { MonthForecast, PerformanceOverview } from "@/lib/types";
import { InfoButton, InfoCalc, ProgressBar } from "./InfoModal";
import { MONEY_KEY } from "./MoneyQuestions";

const WD = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

/** The forecast rule, with this month's own numbers. */
export function ForecastInfo({ f }: { f: MonthForecast }) {
  const t = f.toDate;
  const base = f.period.base;
  return (
    <>
      <p>
        <b>Un jour normal</b> = la moyenne du même jour de semaine sur{" "}
        {base.kind === "PREVIOUS_MONTH" ? (
          <>le mois dernier ({format(new Date(`${base.from}T12:00:00`), "d MMM", { locale: fr })} → {format(new Date(`${base.to}T12:00:00`), "d MMM", { locale: fr })}), les derniers jours comptant jusqu’à {base.recentWeight ?? 3}× plus</>
        ) : (
          <>les {base.days} jours habituels des 8 dernières semaines</>
        )}
        .
      </p>
      <div className="grid grid-cols-7 gap-1 text-center text-xs tabular-nums">
        {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
          const w = f.perWeekday.find((x) => x.weekday === wd);
          return (
            <div key={wd} className="rounded-lg bg-muted/60 px-1 py-2">
              <div className="text-muted-foreground">{WD[wd]}</div>
              <div className="font-semibold">{w ? Math.round(w.revenueVisits + w.products) : "—"}</div>
            </div>
          );
        })}
      </div>
      <p><b>Calendrier</b> : un jour d’examens, de vacances ou férié est multiplié par l’effet mesuré la dernière fois.</p>
      {f.cafe ? (
        <p>
          <b>Café</b> = visites prévues × {dt(f.cafe.perVisit, 2)} par visite
          {f.cafe.changedOn ? ` (depuis le changement du ${format(new Date(`${f.cafe.changedOn}T12:00:00`), "d MMM", { locale: fr })})` : " (14 derniers jours)"}.
        </p>
      ) : null}
      {t ? (
        <>
          <p><b>Rythme du mois</b> : l’écart des jours vécus déplace aussi les jours restants, de plus en plus fort avec les jours vécus.</p>
          <InfoCalc>
            {t.days} jours vécus : réel {dt(t.actual)} pour {dt(t.expected)} prévus ({t.gapPct != null ? `${t.gapPct > 0 ? "+" : ""}${Math.round(t.gapPct)} %` : "—"})
            <br />
            poids {Math.round(t.pace.weight * 100)} % → jours restants × {t.pace.multiplier.toLocaleString("fr-FR")}
            <br />
            Fin de mois = réel + jours restants + abonnements ({dt(t.projectedSubscriptions)}) + événements ≈ {dt(f.projectedAll.pace)}
          </InfoCalc>
        </>
      ) : null}
      <p>Tout est refait chaque soir avec les jours vécus : la prévision ne reste jamais sur le mois dernier.</p>
    </>
  );
}

/** Folded section with a height transition (grid rows 0fr → 1fr). */
export function Fold({ title, hint, children, defaultOpen = false }: { title: string; hint?: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border bg-card">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left">
        <span>
          <span className="font-semibold">{title}</span>
          {hint ? <span className="ml-2 text-sm text-muted-foreground">{hint}</span> : null}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 motion-reduce:transition-none", open && "rotate-180")} />
      </button>
      <div className={cn("grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="min-h-0 overflow-hidden">{open ? <div className="space-y-4 px-4 pb-4">{children}</div> : null}</div>
      </div>
    </div>
  );
}

/**
 * Vue d'ensemble, compact: two progress bars and four numbers. The way each
 * number is computed opens from its ⓘ button.
 */
export function FinanceSummary({
  data,
  year,
  month,
  onGoTab,
}: {
  data: PerformanceOverview;
  year: number;
  month: number;
  onGoTab?: (tab: string) => void;
}) {
  const fq = useQuery({ queryKey: ["performance", "forecast", year, month], queryFn: () => analyticsApi.performanceForecast(year, month) });
  const money = useQuery({ queryKey: MONEY_KEY, queryFn: managerApi.money, enabled: data.period.isCurrent });
  const unusual = useQuery({ queryKey: ["unusual-days"], queryFn: () => analyticsApi.unusualDays(), enabled: data.period.isCurrent });
  const f = fq.data;
  const be = data.breakEven;
  const revenue = data.current?.revenue ?? 0;
  const projected = data.projectedPace ?? data.projected ?? (f ? f.projectedAll.pace : null);
  const t = f?.toDate;
  const expectedNow = t && f ? t.expected + t.subscriptions.actual + f.events.paid : null;
  const profit = projected != null ? projected - be.total : null;
  const plan = money.data?.plan;
  const bank = plan?.lines.find((l) => l.key === "bank");
  const bankStale = !!bank?.source.at?.includes("à revoir");
  const coveredDay = (() => {
    if (!f || !be.total || revenue >= be.total) return null;
    let cum = revenue;
    for (const d of f.days.filter((x) => x.actual == null)) {
      cum += d.expected * (t?.pace.multiplier ?? 1);
      if (cum >= be.total) return d.key;
    }
    return null;
  })();

  if (!f) return <Skeleton className="h-48 rounded-xl" />;
  return (
    <div className="flex flex-col gap-3">
      <Card className="shadow-none">
        <CardContent className="grid gap-5 p-5 lg:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-semibold">Progression du mois</span>
              <span className="tabular-nums text-muted-foreground">
                {dt(revenue)} sur ≈ {projected != null ? dt(projected) : "?"}
                {expectedNow != null && data.period.isCurrent ? ` · attendu à ce jour ≈ ${dt(expectedNow)}` : ""}
              </span>
            </div>
            <ProgressBar value={revenue} max={projected ?? revenue} marker={data.period.isCurrent ? expectedNow : null} label="Encaissé sur la fin de mois prévue" />
            <div className="text-xs text-muted-foreground">Le trait = ce qu’on attendait à ce jour. Au-dessus : le mois va mieux que prévu.</div>
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-semibold">Dépenses couvertes</span>
              <span className="tabular-nums text-muted-foreground">
                {be.coveredPct != null ? `${Math.round(be.coveredPct)} %` : "—"} de {dt(be.total)}
                {coveredDay ? ` · couvertes vers le ${format(new Date(`${coveredDay}T12:00:00`), "d MMM", { locale: fr })}` : be.reached ? " · couvertes ✓" : ""}
              </span>
            </div>
            <ProgressBar value={Math.min(revenue, be.total)} max={be.total || 1} tone={be.reached ? "good" : "warn"} label="Dépenses du mois couvertes" />
            <div className="text-xs text-muted-foreground">Après ce point, chaque dinar encaissé est du bénéfice.</div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Encaissé" value={dt(revenue)} sub={`${data.period.isCurrent ? `jour ${data.period.elapsedDays.toFixed(0)}` : "mois"} · passes, café, abonnements`} />
        <Tile
          label="Fin de mois prévue"
          value={projected != null ? `≈ ${dt(projected)}` : "—"}
          sub={`fourchette ${dt(f.expected.low)} – ${dt(f.expected.high)}`}
          info={<InfoButton title="Comment la fin de mois est prévue" wide><ForecastInfo f={f} /></InfoButton>}
          onClick={() => onGoTab?.("prevision")}
        />
        <Tile
          label="Bénéfice prévu"
          value={profit != null ? `${profit >= 0 ? "≈ +" : "≈ −"}${dt(Math.abs(profit))}` : "—"}
          tone={profit == null ? undefined : profit >= 0 ? "good" : "bad"}
          sub={`${projected != null ? dt(projected) : "?"} − ${dt(be.fixed)} charges − ${dt(be.dailyProjected)} achats`}
          info={
            <InfoButton title="Comment le bénéfice est calculé">
              <InfoCalc>
                Fin de mois prévue {projected != null ? dt(projected) : "?"}
                <br />− charges du mois {dt(be.fixed)} (payées + à payer)
                <br />− achats du jour {dt(be.dailyProjected)}
                <br />= {profit != null ? dt(profit) : "?"}
              </InfoCalc>
              <p>Chaque dépense compte dans <b>le mois pour lequel elle est</b> (« pour quel mois »), pas le jour où elle est payée.</p>
              {be.paidForOtherMonths ? <p>Payé ce mois pour un autre mois : {dt(be.paidForOtherMonths)}, pas compté ici.</p> : null}
              <p>Achats du jour restants = la moyenne des 4 dernières semaines ({be.dailyPerDay != null ? `${dt(be.dailyPerDay, 2)} par jour` : "—"}), pas les premiers jours × 30.</p>
            </InfoButton>
          }
          onClick={() => onGoTab?.("depenses")}
        />
        <Tile
          label="Argent disponible"
          value={plan?.liquid != null ? dt(plan.liquid) : "—"}
          tone={bankStale ? "warn" : undefined}
          sub={bankStale ? "banque à revoir" : "caisse + coffre + banque"}
          info={
            <InfoButton title="L’argent disponible">
              <p>Caisse + coffre + banque. Chaque chiffre, d’où il vient et comment le changer : onglet Argent.</p>
              {bankStale ? <p>La banque vient d’une réponse de plus de 7 jours : mettez-la à jour.</p> : null}
            </InfoButton>
          }
          onClick={() => onGoTab?.("argent")}
        />
      </div>

      {unusual.data?.toAnswer || bankStale || be.fixedRemaining > 0 ? (
        <div className="flex flex-wrap gap-2">
          {unusual.data?.toAnswer ? (
            <Alert onClick={() => onGoTab?.("annee")}>{unusual.data.toAnswer} jour{unusual.data.toAnswer > 1 ? "s" : ""} inhabituel{unusual.data.toAnswer > 1 ? "s" : ""} à expliquer</Alert>
          ) : null}
          {bankStale ? <Alert onClick={() => onGoTab?.("argent")}>Banque à mettre à jour</Alert> : null}
          {be.fixedRemaining > 0 ? <Alert onClick={() => onGoTab?.("depenses")}>{dt(be.fixedRemaining)} de charges encore à payer</Alert> : null}
        </div>
      ) : null}
    </div>
  );
}

function Alert({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 transition-colors duration-200 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <AlertTriangle className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

function Tile({
  label,
  value,
  sub,
  info,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  sub: string;
  info?: ReactNode;
  tone?: "good" | "bad" | "warn";
  onClick?: () => void;
}) {
  return (
    <Card className="shadow-none">
      <CardContent className="space-y-1 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          {info}
        </div>
        <button type="button" onClick={onClick} disabled={!onClick} className="block text-left">
          <span className={cn("text-2xl font-bold tabular-nums", tone === "good" && "text-emerald-700", tone === "bad" && "text-rose-700", tone === "warn" && "text-amber-700")}>{value}</span>
        </button>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  );
}

/** Finance › Prévision: the forecast block, with its rule one tap away. */
export function ForecastTab({ year, month, children }: { year: number; month: number; children: ReactNode }) {
  const fq = useQuery({ queryKey: ["performance", "forecast", year, month], queryFn: () => analyticsApi.performanceForecast(year, month) });
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Prévision · {fq.data?.period.label ?? "…"}</h2>
        {fq.data ? (
          <InfoButton title="Comment la prévision est calculée" wide>
            <ForecastInfo f={fq.data} />
          </InfoButton>
        ) : null}
      </div>
      {children}
    </div>
  );
}
