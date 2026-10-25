"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, ChevronDown, Copy, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SEGMENT_LABEL } from "@/components/admin/OutreachCampaigns";
import type { AdvisorRecommendation, BusinessInitiative, CampaignSegment } from "@/lib/types";
import {
  CATEGORY_UI,
  METRIC_UI,
  copyText,
  gainHeadline,
  goalUnit,
  signed,
  slotText,
} from "./advice-ui";

function adviceText(rec: AdvisorRecommendation) {
  const lines = [rec.title, "", `Pourquoi : ${rec.evidence}`];
  rec.actions.forEach((a, i) => lines.push(`${i + 1}. ${a}`));
  lines.push("", `Gain estimé : ${rec.expectedImpact}`, `À surveiller : ${rec.measure}`);
  if (rec.outreach && rec.outreach.segment !== "NONE") lines.push("", rec.outreach.message);
  return lines.join("\n");
}

/** Who the advice aims at, in a few words. */
export function adviceTargetText(
  rec: AdvisorRecommendation,
  segmentCounts?: Partial<Record<CampaignSegment, number>>,
) {
  const t = rec.target;
  const seg = rec.outreach && rec.outreach.segment !== "NONE" ? (rec.outreach.segment as CampaignSegment) : null;
  if (t?.kind === "LIST" || (!t && seg)) {
    if (!seg) return "Une liste de clients";
    const n = segmentCounts?.[seg];
    return `${SEGMENT_LABEL[seg] ?? seg}${n != null ? ` · ${n}` : ""}`;
  }
  if (t?.kind === "SLOT") return slotText(t.days, t.fromHour, t.toHour);
  return "Tout l'espace";
}

/** One advice: what to do, the gain, why (one number), first step, who and what is measured. */
export function AdviceCard({
  rec,
  index,
  tracked,
  blockedBy,
  segmentCounts,
  onDone,
  onRelance,
  onOpenTracked,
}: {
  rec: AdvisorRecommendation;
  index: number;
  /** The action already started from this advice, if any */
  tracked?: BusinessInitiative;
  /** Data problem that makes this advice unreliable for now */
  blockedBy?: string;
  segmentCounts?: Partial<Record<CampaignSegment, number>>;
  onDone: () => void;
  onRelance: () => void;
  onOpenTracked: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ui = CATEGORY_UI[rec.category] ?? CATEGORY_UI.OPERATIONS;
  const Icon = ui.icon;
  const gain = gainHeadline(rec.expectedImpact);
  const relance = rec.outreach && rec.outreach.segment !== "NONE" ? rec.outreach : null;
  const relanceCount = relance ? segmentCounts?.[relance.segment as CampaignSegment] : undefined;
  const [first, ...rest] = rec.actions;
  const measure = rec.metric ? METRIC_UI[rec.metric].label : rec.measure;

  return (
    <li
      className="advisor-in flex flex-col gap-2 rounded-xl border bg-card p-4 transition-shadow duration-200 hover:shadow-md"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", ui.tone)}
          title={ui.label}
        >
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="min-w-0 flex-1 text-[15px] font-semibold leading-snug">
          {rec.title}
          {rec.priority === "high" ? (
            <span className="ml-2 inline-block rounded-full bg-rose-50 px-1.5 py-0.5 align-[2px] text-[11px] font-medium text-rose-700">
              Prioritaire
            </span>
          ) : null}
        </h3>
        {gain ? (
          <span className="shrink-0 whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-0.5 text-sm font-bold tabular-nums text-emerald-700">
            {gain}
          </span>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground">{rec.evidence}</p>
      {first ? (
        <p className="flex gap-1.5 text-sm">
          <span className="font-bold text-primary">→</span>
          <span>{first}</span>
        </p>
      ) : null}

      <div className="flex flex-wrap gap-1.5 text-xs">
        <span className="rounded-md bg-muted px-2 py-0.5 text-muted-foreground">
          Cible <b className="font-semibold text-foreground">{adviceTargetText(rec, segmentCounts)}</b>
        </span>
        <span className="rounded-md bg-muted px-2 py-0.5 text-muted-foreground">
          Mesure{" "}
          <b className="font-semibold text-foreground">
            {measure}
            {rec.metric && rec.targetPct ? ` · ${signed(rec.targetPct, goalUnit(rec.metric))}` : ""}
          </b>
        </span>
        {blockedBy ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-amber-800">
            <AlertTriangle className="h-3 w-3" />
            {blockedBy}
          </span>
        ) : null}
      </div>

      {relance ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-emerald-50/80 px-3 py-1.5 text-sm">
          <MessageCircle className="h-4 w-4 shrink-0 text-emerald-700" />
          <span className="min-w-0 flex-1">
            Message prêt
            {relanceCount ? (
              <>
                {" "}pour <b>{relanceCount} client{relanceCount > 1 ? "s" : ""}</b>
              </>
            ) : null}
            <span className="text-muted-foreground">
              {" "}
              · {SEGMENT_LABEL[relance.segment as CampaignSegment] ?? relance.segment}
            </span>
          </span>
          {relanceCount === 0 ? (
            <span className="text-xs text-muted-foreground">Personne dans cette liste pour l&apos;instant</span>
          ) : (
            <Button size="sm" variant="outline" className="h-7 bg-background" onClick={onRelance}>
              Relancer
            </Button>
          )}
        </div>
      ) : null}

      {/* Details: smooth open via grid rows 0fr → 1fr */}
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
        aria-hidden={!open}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-2 border-t pt-2 text-sm">
            {rest.length ? (
              <ol className="list-decimal space-y-0.5 pl-5" start={2}>
                {rest.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ol>
            ) : null}
            <p className="text-muted-foreground">
              <span className="text-foreground">Gain estimé :</span> {rec.expectedImpact}
            </p>
            {relance?.message ? (
              <p className="rounded-md border border-dashed px-3 py-2 text-muted-foreground">
                « {relance.message} »
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {tracked ? (
          <button
            type="button"
            onClick={onOpenTracked}
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
          >
            <Check className="h-4 w-4" />
            Fait · J+{tracked.daysSinceStart} — voir le résultat
          </button>
        ) : (
          <Button size="sm" onClick={onDone}>
            Je l&apos;ai fait
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? "Moins" : "Détails"}
          <ChevronDown
            className={cn("ml-1 h-4 w-4 transition-transform duration-200", open && "rotate-180")}
          />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="ml-auto h-8 w-8 text-muted-foreground"
          title="Copier"
          onClick={async () => {
            await copyText(adviceText(rec));
            toast.success("Copié");
          }}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}
