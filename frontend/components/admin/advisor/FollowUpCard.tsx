"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { AlertTriangle, ChevronDown, MessageCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { advisorApi } from "@/lib/api/resources";
import type { AdvisorResult, BusinessInitiative, InitiativeVerdict } from "@/lib/types";
import { METRIC_UI, STATUS_UI, VERDICT_UI, dt, fr1, metricValue, signed, today } from "./advice-ui";

const AI_VERDICT = {
  working: "Ça marche",
  not_working: "Pas d'effet",
  too_early: "Trop tôt",
} as const;

const GAIN_SOURCE = {
  sale: "ventes liées",
  campaign: "relance",
  target: "revenu de la cible",
  global: "revenu total",
} as const;

const SALE_UNIT = { PRICE: "vendus", PRODUCT: "vendus", PROMOTION: "utilisées" } as const;

/** Ratios and averages: never "per day" or "per client". */
const RATE_LABEL = new Set(["cafeAttachRatePct", "avgOccupancyPct", "avgStayHours"]);

const day = (s: string) => format(new Date(s), "d MMM", { locale: fr });

/** Before / after bars for the target and the comparison group, on one scale. */
function CompareChart({
  target,
  comparison,
  comparisonLabel,
}: {
  target: { before: number | null; after: number | null };
  comparison: { before: number | null; after: number | null } | null;
  comparisonLabel: string | null;
}) {
  const vals = [target.before, target.after, comparison?.before, comparison?.after].map((v) => v ?? 0);
  const max = Math.max(...vals) * 1.2 || 1;
  const H = 70;
  const bar = (v: number | null, x: number, fill: string) => {
    const h = Math.max(2, ((v ?? 0) / max) * H);
    return (
      <g key={x}>
        <rect x={x} y={H - h + 14} width={26} height={h} rx={3} fill={fill} />
        <text x={x + 13} y={H - h + 10} textAnchor="middle" fontSize={10} fill="hsl(var(--foreground))">
          {v == null ? "—" : fr1(v)}
        </text>
      </g>
    );
  };
  return (
    <svg viewBox="0 0 280 104" className="h-auto w-full max-w-sm" role="img" aria-label="Avant et après, cible et comparaison">
      <line x1={0} y1={H + 14} x2={280} y2={H + 14} stroke="hsl(var(--border))" />
      {bar(target.before, 24, "hsl(var(--muted-foreground) / 0.45)")}
      {bar(target.after, 56, "hsl(var(--primary))")}
      <text x={56} y={100} textAnchor="middle" fontSize={11} fill="hsl(var(--muted-foreground))">Cible</text>
      {comparison ? (
        <>
          {bar(comparison.before, 160, "hsl(var(--muted-foreground) / 0.3)")}
          {bar(comparison.after, 192, "hsl(var(--muted-foreground) / 0.55)")}
          <text x={192} y={100} textAnchor="middle" fontSize={11} fill="hsl(var(--muted-foreground))">
            {comparisonLabel ?? "Comparaison"}
          </text>
        </>
      ) : null}
    </svg>
  );
}

/** One action the owner did: effect vs a comparison group, net gain, linked sale, notes and verdict. */
export function FollowUpCard({
  item,
  review,
  index,
  highlight,
}: {
  item: BusinessInitiative;
  review?: AdvisorResult["initiativeReviews"][number];
  index: number;
  highlight?: boolean;
}) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["advisor", "initiatives"] });
  const update = useMutation({
    mutationFn: (data: Parameters<typeof advisorApi.updateInitiative>[1]) => advisorApi.updateInitiative(item.id, data),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: () => advisorApi.deleteInitiative(item.id),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const r = item.result;
  const status = r ? STATUS_UI[r.status] : null;
  const unit = r?.unit === "pts" ? " pts" : " %";
  const effectTone = r?.effect == null ? "" : r.effect > 0 ? "text-emerald-700" : r.effect < 0 ? "text-rose-700" : "";
  const goalPct = r?.targetPct && r.effect != null ? Math.max(0, Math.min(100, (r.effect / r.targetPct) * 100)) : 0;
  const measuredPct = r ? Math.min(100, Math.round((r.daysMeasured / item.windowDays) * 100)) : 0;

  const addNote = () => {
    const text = note.trim();
    if (!text) return;
    update.mutate({ notes: [...item.notes, { date: today(), text }] }, { onSuccess: () => setNote("") });
  };
  const setVerdict = (v: InitiativeVerdict) => update.mutate({ ownerVerdict: item.ownerVerdict === v ? null : v });

  return (
    <li
      id={`action-${item.id}`}
      className={cn(
        "advisor-in flex flex-col gap-2.5 rounded-xl border bg-card p-4 transition-[box-shadow,border-color] duration-500",
        highlight && "border-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]",
      )}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold leading-snug">{item.title}</div>
          <div className="text-xs text-muted-foreground">
            Depuis le {day(item.startDate)}
            {item.endDate ? ` · arrêtée le ${day(item.endDate)}` : ` · J+${item.daysSinceStart}`}
            {item.cost ? ` · coût ${dt(item.cost)}` : ""} · {item.target.label}
          </div>
        </div>
        {status ? (
          <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", status.tone)}>{status.label}</span>
        ) : (
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs">Commence bientôt</span>
        )}
      </div>

      {item.description ? (
        <p className="text-sm">
          <span className="font-medium">Fait : </span>
          <span className="text-muted-foreground">{item.description}</span>
        </p>
      ) : null}

      {r ? (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-4 gap-y-2 rounded-lg bg-muted/50 p-3">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">
              {/* "Revenu par jour" + "par client" → "Revenu par client" */}
              {RATE_LABEL.has(r.metric)
                ? METRIC_UI[r.metric].label
                : `${METRIC_UI[r.metric].label.replace(/ par jour$/, "")} ${r.per}`}
              {r.comparisonLabel ? ` · effet net vs ${r.comparisonLabel.toLowerCase()}` : ""}
            </div>
            <div className="flex flex-wrap items-baseline gap-x-2 text-xl font-bold tabular-nums">
              <span>
                {metricValue(r.metric, r.before)} → {metricValue(r.metric, r.after)}
              </span>
              {r.effect != null ? (
                <span className={cn("text-[15px]", effectTone)}>{signed(r.effect, unit)}</span>
              ) : null}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Gain net</div>
            <div
              className={cn(
                "text-xl font-bold tabular-nums",
                r.netGain > 0 ? "text-emerald-700" : r.netGain < 0 ? "text-rose-700" : "",
              )}
            >
              {signed(r.netGain, " DT")}
            </div>
            <div className="text-[11px] text-muted-foreground tabular-nums">
              {fr1(r.gain)} {GAIN_SOURCE[r.gainSource]}
              {r.cost ? ` − ${fr1(r.cost)}` : ""}
            </div>
          </div>
          {r.targetPct != null ? (
            <div className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-background">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none",
                    goalPct >= 100 ? "bg-emerald-600" : "bg-amber-500",
                  )}
                  style={{ width: `${goalPct}%` }}
                />
              </div>
              objectif {signed(r.targetPct, unit)}
            </div>
          ) : null}
          <div className="col-span-2">
            <div className="h-1 overflow-hidden rounded-full bg-background">
              <div
                className="h-full rounded-full bg-primary/60 transition-[width] duration-700 ease-out motion-reduce:transition-none"
                style={{ width: `${measuredPct}%` }}
              />
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">
              Mesuré {r.daysMeasured} / {item.windowDays} jours · {r.visitsCompared} visites sur la cible
              {r.status === "too_early" ? " · verdict à J+14" : ""}
            </div>
          </div>
        </div>
      ) : (
        <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          La mesure commence à la date de début. Premier résultat fiable vers J+14.
        </p>
      )}

      {r?.sale ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-1.5 text-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Vente liée</span>
          <span className="tabular-nums">
            {r.sale.label} · {r.sale.count} {SALE_UNIT[r.sale.kind]} · {dt(r.sale.revenue)}
            {r.sale.kind === "PRODUCT" ? ` · marge ${dt(r.sale.margin)}` : ""}
            {r.sale.discount ? ` · remise ${dt(r.sale.discount)}` : ""}
          </span>
        </div>
      ) : null}

      {item.campaign ? (
        <Link
          href="/relances"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-1.5 text-sm transition-colors hover:bg-muted/50"
        >
          <MessageCircle className="h-4 w-4 text-emerald-700" />
          <span>
            Relance : <b>{item.campaign.contacted}</b>/{item.campaign.total} contactés
          </span>
          <span>
            <b>{item.campaign.won}</b> revenus
          </span>
          <span className="font-semibold text-emerald-700">{dt(item.campaign.revenue)}</span>
        </Link>
      ) : null}

      {r?.disturbances.length ? (
        <p className="flex items-start gap-1.5 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Pendant la mesure : {r.disturbances.join(", ")}. La comparaison peut être faussée.
        </p>
      ) : null}

      {review ? (
        <p className="flex gap-2 text-sm">
          <b className="text-violet-700">IA</b>
          <span>
            <span className="font-medium">{AI_VERDICT[review.verdict]}.</span> {review.detail}
          </span>
        </p>
      ) : null}

      {r ? (
        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none",
            open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
          aria-hidden={!open}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="space-y-2 text-sm">
              <CompareChart
                target={{ before: r.before, after: r.after }}
                comparison={r.comparison}
                comparisonLabel={r.comparisonLabel}
              />
              <table className="w-full tabular-nums">
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th className="py-1 text-left font-normal" />
                    <th className="py-1 text-right font-normal">Avant</th>
                    <th className="py-1 text-right font-normal">Après</th>
                    <th className="py-1 text-right font-normal">Écart</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t">
                    <td className="py-1">Cible · {r.targetLabel}</td>
                    <td className="py-1 text-right">{metricValue(r.metric, r.before)}</td>
                    <td className="py-1 text-right">{metricValue(r.metric, r.after)}</td>
                    <td className="py-1 text-right">{r.targetMove != null ? signed(r.targetMove, unit) : "—"}</td>
                  </tr>
                  {r.comparison ? (
                    <tr className="border-t">
                      <td className="py-1">{r.comparisonLabel}</td>
                      <td className="py-1 text-right">{metricValue(r.metric, r.comparison.before)}</td>
                      <td className="py-1 text-right">{metricValue(r.metric, r.comparison.after)}</td>
                      <td className="py-1 text-right">{r.comparisonMove != null ? signed(r.comparisonMove, unit) : "—"}</td>
                    </tr>
                  ) : null}
                  <tr className="border-t font-semibold">
                    <td className="py-1">Effet de l&apos;action</td>
                    <td />
                    <td />
                    <td className={cn("py-1 text-right", effectTone)}>{r.effect != null ? signed(r.effect, unit) : "—"}</td>
                  </tr>
                </tbody>
              </table>
              <p className="text-xs text-muted-foreground">
                {r.comparison
                  ? "Effet = écart de la cible − écart de la comparaison. Ce qui monte partout (saison, météo) est retiré."
                  : "Pas de groupe de comparaison : l'écart peut venir de la saison."}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-1.5 border-t pt-2.5">
        <div className="text-sm font-medium">Ce qui s&apos;est passé</div>
        {item.notes.length ? (
          <ul className="space-y-1 text-sm">
            {item.notes.map((n, i) => (
              <li key={`${n.date}-${i}`} className="advisor-in grid grid-cols-[3.25rem_minmax(0,1fr)] gap-2">
                <span className="text-xs leading-5 text-muted-foreground">{day(n.date)}</span>
                <span>{n.text}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addNote();
          }}
        >
          <Input
            aria-label="Ajouter une note"
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex. : les clients trouvent le prix trop haut"
            className="h-8 text-sm"
          />
          <Button type="submit" size="sm" variant="outline" disabled={!note.trim() || update.isPending}>
            Ajouter
          </Button>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        Mon avis :
        {(Object.keys(VERDICT_UI) as InitiativeVerdict[]).map((v) => (
          <button
            key={v}
            type="button"
            disabled={update.isPending}
            onClick={() => setVerdict(v)}
            aria-pressed={item.ownerVerdict === v}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs text-foreground transition-colors duration-200",
              item.ownerVerdict === v ? VERDICT_UI[v].active : "bg-background hover:bg-muted",
            )}
          >
            {VERDICT_UI[v].label}
          </button>
        ))}
        <div className="ml-auto flex items-center">
          {r ? (
            <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
              {open ? "Masquer le calcul" : "Voir le calcul"}
              <ChevronDown className={cn("ml-1 h-4 w-4 transition-transform duration-200", open && "rotate-180")} />
            </Button>
          ) : null}
          {!item.endDate ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              disabled={update.isPending}
              onClick={() => update.mutate({ endDate: today() })}
            >
              Arrêter
            </Button>
          ) : null}
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground"
            title="Supprimer"
            disabled={remove.isPending}
            onClick={() => {
              if (confirm(`Supprimer « ${item.title} » ?`)) remove.mutate();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </li>
  );
}
