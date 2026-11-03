"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, Link2, Loader2, Pencil, Sparkles, Target, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { advisorApi } from "@/lib/api/resources";
import type { BusinessInitiative, HealthSolution, InitiativeVerdict, ToolDraft, ToolKind } from "@/lib/types";
import { DISMISS_REASONS, STATUS_TEXT, TOOL_UI, VERDICTS, dt, signedDt } from "./conseil-ui";

const ENTER = "animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both duration-300 motion-reduce:animate-none";

/** Grows open / closed with a CSS grid-rows transition. */
export function Reveal({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}
      aria-hidden={!open}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

function ToolChip({ tool }: { tool: ToolDraft }) {
  const Icon = TOOL_UI[tool.kind].icon;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
      <Icon className="h-3 w-3" />
      {TOOL_UI[tool.kind].label}
    </span>
  );
}

/** The last objective of every solution: the money, counted by the app. */
function GoalObjective({ goal, gained }: { goal: number; gained: number | null }) {
  return (
    <div className="flex min-h-11 items-center gap-2.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-950">
      <Target className="h-5 w-5 shrink-0 text-indigo-600" />
      <span className="flex-1">
        <b>Gagner +{dt(goal)} en 4 semaines</b> <span className="text-xs text-indigo-700">· compté par l&apos;app</span>
      </span>
      <b className="tabular-nums">{gained == null ? "auto" : signedDt(gained)}</b>
    </div>
  );
}

function DismissReasons({ onPick, busy }: { onPick: (reason: string) => void; busy: boolean }) {
  return (
    <div className={cn("space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3", ENTER)}>
      <p className="text-sm font-semibold text-amber-950">Pourquoi pas pour vous ? L&apos;IA ne la proposera plus.</p>
      <div className="flex flex-wrap gap-1.5">
        {DISMISS_REASONS.map((r) => (
          <button
            key={r}
            type="button"
            disabled={busy}
            onClick={() => onPick(r)}
            className="min-h-10 rounded-full border bg-white px-3.5 text-sm font-semibold text-slate-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-50"
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// A solution not started: one tap to start
// ---------------------------------------------------------------------------

export function IdleSolutionCard({
  s,
  full,
  max,
  starting,
  onStart,
  onAdapt,
  onDismissed,
}: {
  s: HealthSolution;
  full: boolean;
  max: number;
  starting: boolean;
  onStart: () => void;
  onAdapt: () => void;
  onDismissed: () => void;
}) {
  const qc = useQueryClient();
  const [asking, setAsking] = useState(false);
  const dismiss = useMutation({
    mutationFn: (reason: string) =>
      advisorApi.dismiss({ title: s.title, category: s.category, leverId: s.leverId, reason }),
    onSuccess: () => {
      toast.success("Mise de côté : l'IA ne la proposera plus");
      qc.invalidateQueries({ queryKey: ["advisor", "health"] });
      onDismissed();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const toolAt = (i: number) => s.tools.find((t) => t.step === i);

  return (
    <article className={cn("space-y-3 rounded-2xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md", ENTER)}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-60">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold",
              s.source === "ai" ? "bg-violet-100 text-violet-800" : "bg-sky-100 text-sky-800",
            )}
          >
            {s.source === "ai" ? <Sparkles className="h-3 w-3" /> : null}
            {s.source === "ai" ? "Proposée par l'IA" : "Calculée par les règles"}
          </span>
          <h4 className="mt-2 text-[17px] font-extrabold leading-snug">{s.title}</h4>
          {s.why ? <p className="mt-1 text-sm text-slate-600">{s.why}</p> : null}
        </div>
        <div className="text-right">
          <div className="text-2xl font-extrabold tabular-nums text-emerald-700">≈ +{dt(s.gain)}</div>
          <div className="text-xs text-slate-500">par mois · coût {dt(s.cost)}</div>
        </div>
      </header>

      <div className="space-y-1.5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Objectifs · {s.steps.length + 1}</p>
        {s.steps.map((text, i) => (
          <div key={i} className="flex min-h-11 items-center gap-2.5 rounded-xl border px-3 py-2 text-sm">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-extrabold text-slate-600">
              {i + 1}
            </span>
            <span className="flex-1">{text}</span>
            {toolAt(i) ? <ToolChip tool={toolAt(i)!} /> : null}
          </div>
        ))}
        <GoalObjective goal={s.goalAmount} gained={null} />
      </div>

      {asking ? <DismissReasons busy={dismiss.isPending} onPick={(r) => dismiss.mutate(r)} /> : null}

      <footer className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          <Button variant="ghost" className="text-slate-600" onClick={() => setAsking((v) => !v)}>
            Pas pour moi
          </Button>
          <Button variant="ghost" className="text-indigo-700" onClick={onAdapt}>
            <Wand2 className="mr-1.5 h-4 w-4" />
            Adapter
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {full ? <span className="text-xs font-medium text-rose-700">{max} solutions en cours : finissez-en une d&apos;abord</span> : null}
          <Button
            disabled={full || starting}
            onClick={onStart}
            className="rounded-xl bg-indigo-600 font-bold hover:bg-indigo-700"
          >
            {starting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Je m&apos;en occupe
          </Button>
        </div>
      </footer>
    </article>
  );
}

// ---------------------------------------------------------------------------
// A solution in progress: objectives, tools, money, verdict
// ---------------------------------------------------------------------------

/** The money, line by line, in plain words. */
function calcLines(i: BusinessInitiative) {
  const r = i.result;
  const lines: Array<{ label: string; value: string; strong?: boolean }> = [];
  if (!r) return { lines, note: "La mesure commence aujourd'hui : premier point dans 14 jours, verdict dans 4 semaines." };
  if (i.toolLinks.length) {
    for (const l of i.toolLinks) {
      lines.push({ label: `${TOOL_UI[l.kind].label} · ${l.label ?? "—"}`, value: `${l.count} · ${dt(l.revenue)}` });
    }
    if (i.toolLinks.length > 1) lines.push({ label: "Total (chaque vente comptée une fois)", value: dt(r.gain) });
  } else if (r.gainSource === "campaign" && i.campaign) {
    lines.push({ label: `Relance · ${i.campaign.won} revenus sur ${i.campaign.contacted} contactés`, value: dt(i.campaign.revenue) });
  } else if (r.before != null && r.after != null) {
    lines.push({ label: `${r.targetLabel} (visé)`, value: `${r.before} → ${r.after} ${r.per}` });
    if (r.comparison && r.comparisonLabel) {
      lines.push({ label: `${r.comparisonLabel} (comparaison)`, value: `${r.comparison.before} → ${r.comparison.after}` });
    }
    if (r.effect != null) lines.push({ label: "Ce que la solution a apporté", value: `${r.effect > 0 ? "+" : ""}${r.effect} ${r.unit}` });
    lines.push({ label: `Gagné en ${r.daysMeasured} jours`, value: dt(r.gain) });
  } else {
    lines.push({ label: `Gagné en ${r.daysMeasured} jours`, value: dt(r.gain) });
  }
  if (r.cost) lines.push({ label: "Coût (remises comprises)", value: `− ${dt(r.cost)}` });
  lines.push({ label: "Gain net", value: signedDt(r.netGain), strong: true });
  const note = i.toolLinks.length
    ? "Chaque vente faite par un outil lié compte : c'est une preuve directe."
    : r.comparisonLabel
      ? `On enlève ce qui a bougé tout seul (${r.comparisonLabel.toLowerCase()}) pour ne garder que l'effet de la solution.`
      : "Pas de comparaison : on regarde avant / après. Liez une promo, un événement ou une relance pour une preuve directe.";
  return { lines, note };
}

export function RunningSolutionCard({
  i,
  onPrepare,
  onLinkExisting,
  onEdit,
}: {
  i: BusinessInitiative;
  onPrepare: (tool: ToolDraft) => void;
  onLinkExisting: (kind: ToolKind | null, step: number | null) => void;
  onEdit: () => void;
}) {
  const qc = useQueryClient();
  const [showCalc, setShowCalc] = useState(false);
  const [stopping, setStopping] = useState(false);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["advisor", "initiatives"] });
    qc.invalidateQueries({ queryKey: ["advisor", "health"] });
  };
  const patch = useMutation({
    mutationFn: (data: Parameters<typeof advisorApi.updateInitiative>[1]) => advisorApi.updateInitiative(i.id, data),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });
  const unlink = useMutation({
    mutationFn: (linkId: string) => advisorApi.removeTool(i.id, linkId),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const goal = i.goalAmount ?? 0;
  const gained = i.result?.gain ?? 0;
  const pct = goal > 0 ? Math.max(0, Math.min(100, Math.round((gained / goal) * 100))) : 0;
  const undone = i.steps.filter((s) => !s.done).length;
  const day = i.activeDays;
  const toolFor = (k: number) => i.tools.find((t) => t.step === k);
  const linksFor = (k: number) => i.toolLinks.filter((l) => l.stepIndex === k);
  const loose = i.toolLinks.filter((l) => l.stepIndex == null || l.stepIndex >= i.steps.length);
  const { lines, note } = calcLines(i);
  const status = i.result?.status;

  const toggleStep = (k: number) =>
    patch.mutate({ steps: i.steps.map((s, n) => (n === k ? { ...s, done: !s.done } : s)) });

  return (
    <article className={cn("space-y-3 rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm ring-4 ring-indigo-50", ENTER)}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-60">
          <span className="inline-flex rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-bold text-indigo-800">
            {i.paused ? "En pause" : day === 0 ? "En cours · commence aujourd'hui" : `En cours · jour ${day} sur ${i.windowDays}`}
          </span>
          <h4 className="mt-2 text-[17px] font-extrabold leading-snug">{i.title}</h4>
        </div>
        <div className="text-right">
          <div className="text-2xl font-extrabold tabular-nums text-emerald-700">{signedDt(gained)}</div>
          <div className="text-xs text-slate-500">gagnés sur +{dt(goal)}</div>
        </div>
      </header>

      <div className="h-2.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Objectif atteint">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Objectifs · {i.steps.length - undone} / {i.steps.length} faits
        </p>
        {i.steps.map((s, k) => {
          const tool = toolFor(k);
          const done = linksFor(k);
          return (
            <div key={k} className="space-y-1">
              <label
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition-colors duration-200",
                  s.done ? "border-emerald-200 bg-emerald-50" : "bg-white hover:border-indigo-200",
                )}
              >
                <input
                  type="checkbox"
                  checked={s.done}
                  disabled={patch.isPending}
                  onChange={() => toggleStep(k)}
                  className="h-5 w-5 shrink-0 accent-emerald-600"
                />
                <span className={cn("flex-1 transition-colors", s.done && "text-slate-500 line-through")}>{s.text}</span>
                {tool && !done.length ? (
                  <span className="flex flex-wrap gap-1">
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 rounded-lg bg-indigo-600 px-2.5 text-xs font-bold hover:bg-indigo-700"
                      onClick={(e) => {
                        e.preventDefault();
                        onPrepare(tool);
                      }}
                    >
                      {tool.label}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-lg px-2 text-xs"
                      title="Lier un élément existant"
                      aria-label={`Lier ${TOOL_UI[tool.kind].noun} existant`}
                      onClick={(e) => {
                        e.preventDefault();
                        onLinkExisting(tool.kind, k);
                      }}
                    >
                      <Link2 className="h-3.5 w-3.5" />
                    </Button>
                  </span>
                ) : null}
              </label>
              {done.map((l) => (
                <LinkedRow key={l.id} l={l} onRemove={() => unlink.mutate(l.id)} />
              ))}
            </div>
          );
        })}
        <GoalObjective goal={goal} gained={i.result ? gained : 0} />
        {loose.map((l) => (
          <LinkedRow key={l.id} l={l} onRemove={() => unlink.mutate(l.id)} />
        ))}
        <button
          type="button"
          onClick={() => onLinkExisting(null, null)}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-50"
        >
          <Link2 className="h-4 w-4" />
          Lier une promo, un événement, une enquête…
        </button>
      </div>

      {undone > 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-950">
          Cochez les objectifs au fur et à mesure. Tant qu&apos;il en reste un, le résultat n&apos;est pas encore jugé.
        </p>
      ) : status ? (
        <p
          className={cn(
            "rounded-xl px-3 py-2 text-[13px] font-medium",
            status === "goal_reached" ? "bg-emerald-50 text-emerald-900" : "bg-slate-50 text-slate-700",
          )}
        >
          {STATUS_TEXT[status] ?? status}
          {i.result?.daysLeft ? ` · encore ${i.result.daysLeft} jours de mesure` : ""}
        </p>
      ) : null}

      <div>
        <button
          type="button"
          onClick={() => setShowCalc((v) => !v)}
          aria-expanded={showCalc}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
        >
          Comment on a calculé
          <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", showCalc && "rotate-180")} />
        </button>
        <Reveal open={showCalc}>
          <div className="mt-1 rounded-xl border bg-slate-50 p-3">
            {lines.map((l, k) => (
              <div
                key={k}
                className={cn(
                  "flex flex-wrap justify-between gap-2 border-b border-dashed py-1.5 text-sm last:border-0",
                  l.strong && "font-extrabold text-emerald-800",
                )}
              >
                <span>{l.label}</span>
                <span className="tabular-nums">{l.value}</span>
              </div>
            ))}
            <p className="mt-1.5 text-xs text-slate-600">{note}</p>
          </div>
        </Reveal>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-sm font-semibold text-slate-700">Mon avis :</span>
        {VERDICTS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={i.ownerVerdict === k}
            onClick={() => patch.mutate({ ownerVerdict: i.ownerVerdict === k ? null : (k as InitiativeVerdict) })}
            className={cn(
              "min-h-10 rounded-full border px-3.5 text-sm font-semibold transition-colors duration-200",
              i.ownerVerdict === k ? "border-indigo-600 bg-indigo-600 text-white" : "bg-white text-slate-700 hover:border-indigo-300",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {stopping ? (
        <DismissReasons
          busy={patch.isPending}
          onPick={(reason) => {
            patch.mutate({ drop: { reason } });
            setStopping(false);
          }}
        />
      ) : null}

      <footer className="flex flex-wrap justify-end gap-1 border-t pt-2">
        <Button variant="ghost" className="text-indigo-700" onClick={onEdit}>
          <Pencil className="mr-1.5 h-4 w-4" />
          Modifier
        </Button>
        <Button variant="ghost" className="text-slate-600" disabled={patch.isPending} onClick={() => patch.mutate({ paused: !i.paused })}>
          {i.paused ? "Reprendre" : "Mettre en pause"}
        </Button>
        <Button variant="ghost" className="text-slate-600" disabled={patch.isPending} onClick={() => patch.mutate({ endDate: new Date().toISOString().slice(0, 10) })}>
          Terminer
        </Button>
        <Button variant="ghost" className="text-rose-700" onClick={() => setStopping((v) => !v)}>
          Abandonner
        </Button>
      </footer>
    </article>
  );
}

function LinkedRow({ l, onRemove }: { l: BusinessInitiative["toolLinks"][number]; onRemove: () => void }) {
  const Icon = TOOL_UI[l.kind].icon;
  return (
    <div className={cn("ml-8 flex flex-wrap items-center gap-2 rounded-xl bg-indigo-50/70 px-3 py-1.5 text-[13px]", ENTER)}>
      <Icon className="h-4 w-4 text-indigo-600" />
      <b className="font-semibold">{TOOL_UI[l.kind].label} · {l.label ?? "—"}</b>
      <span className="flex flex-wrap gap-x-2 text-slate-600">
        {l.stages.map((s) => (
          <span key={s.label} className="tabular-nums">
            {s.label} {s.value ?? "—"}
          </span>
        ))}
      </span>
      <b className="ml-auto tabular-nums text-emerald-700">{dt(l.revenue)}</b>
      <button type="button" onClick={onRemove} aria-label="Délier" className="rounded p-1 text-slate-400 transition-colors hover:bg-white hover:text-slate-700">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
