"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronRight, Pause, Play, Plus, RotateCcw, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { advisorApi, analyticsApi } from "@/lib/api/resources";
import type {
  AdviceMetric,
  AdvisorCategory,
  AdvisorRecommendation,
  AdvisorResult,
  BusinessInitiative,
  CampaignSegment,
  MissingIdea,
  TargetKind,
} from "@/lib/types";
import { AdviceCard } from "./AdviceCard";
import { FollowUpCard } from "./FollowUpCard";
import { CATEGORY_UI, gainAmount } from "./advice-ui";
import type { DoneDraft } from "./DonePanel";

const REASONS = ["Trop cher", "Pas le temps", "Déjà essayé", "Ne colle pas à mon espace", "Plus tard"];

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const sameTitle = (a: string, b: string) => norm(a) === norm(b);
const day = (k: string) => format(new Date(`${k}T12:00:00`), "d MMM", { locale: fr });

/** An idea to try: from the latest analysis, or from the lever map when the analysis did not cover it. */
type Todo =
  | { key: string; kind: "advice"; rec: AdvisorRecommendation; gain: number }
  | { key: string; kind: "lever"; idea: MissingIdea; gain: number };

type Shown = { kind: "todo"; key: string } | { kind: "action"; id: string };

function nextStep(a: BusinessInitiative) {
  const undone = a.steps.find((s) => !s.done);
  if (undone) return undone.text;
  return a.diagnosis?.next ?? null;
}

function Column({ title, hint, count, children }: { title: string; hint: string; count: number; children: ReactNode }) {
  return (
    <section className="flex min-h-36 min-w-0 flex-col gap-2 rounded-xl bg-muted/50 p-2.5" aria-label={title}>
      <header className="flex items-baseline justify-between gap-2 px-1">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-[11px] text-muted-foreground">{hint}</p>
        </div>
        <span className="text-xs font-semibold text-muted-foreground">{count}</span>
      </header>
      {children}
    </section>
  );
}

const cardClass =
  "w-full cursor-pointer rounded-lg border bg-background px-3 py-2.5 text-left transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-primary hover:shadow-sm motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both motion-reduce:transition-none";

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">{children}</p>;
}

function Reasons({ onPick, busy }: { onPick: (r: string) => void; busy: boolean }) {
  return (
    <div className="space-y-2 rounded-xl border border-violet-300 bg-violet-50/60 p-3 animate-in fade-in-0 slide-in-from-top-1 duration-200 motion-reduce:animate-none dark:border-violet-800 dark:bg-violet-950/30">
      <div className="text-sm font-medium">Pourquoi tu ne continues pas ?</div>
      <div className="flex flex-wrap gap-1.5">
        {REASONS.map((r) => (
          <button
            key={r}
            type="button"
            disabled={busy}
            onClick={() => onPick(r)}
            className="rounded-full border bg-background px-3 py-1 text-sm transition-colors hover:border-violet-500 hover:bg-violet-600 hover:text-white disabled:opacity-50"
          >
            {r}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Elle part dans « Pas pour moi ». Le conseiller ne la repropose plus, sauf si tu la remets.
      </p>
    </div>
  );
}

export function ConseillerBoard({
  result,
  reportId,
  actions,
  blockedLabel,
  segmentCounts,
  onStart,
  onRelance,
  onNew,
}: {
  result: AdvisorResult | null;
  reportId: string | null;
  actions: BusinessInitiative[];
  blockedLabel: (c: AdvisorCategory) => string | undefined;
  segmentCounts?: Partial<Record<CampaignSegment, number>>;
  onStart: (draft: DoneDraft) => void;
  onRelance: (rec: AdvisorRecommendation) => void;
  onNew: () => void;
}) {
  const qc = useQueryClient();
  const dismissals = useQuery({ queryKey: ["advisor", "dismissals"], queryFn: advisorApi.dismissals });
  const levers = useQuery({ queryKey: ["performance", "levers"], queryFn: () => analyticsApi.performanceLevers() });
  const [shown, setShown] = useState<Shown | null>(null);
  const [asking, setAsking] = useState(false);
  const [interested, setInterested] = useState<string>("");

  const reviews = new Map((result?.initiativeReviews ?? []).map((r) => [r.initiativeId, r]));
  const refused = dismissals.data ?? [];
  const isRefused = (title: string, leverId?: string | null) =>
    refused.some((d) => (leverId && d.leverId === leverId) || sameTitle(d.title, title));
  const tracked = (title: string) => actions.find((a) => sameTitle(a.recommendationTitle ?? "", title) || sameTitle(a.title, title));

  const todo: Todo[] = useMemo(() => {
    const recs = (result?.recommendations ?? [])
      .filter((r) => !tracked(r.title) && !isRefused(r.title, r.leverId))
      .map((rec, i): Todo => ({ key: `advice:${i}:${rec.title}`, kind: "advice", rec, gain: gainAmount(rec.expectedImpact) }));
    const covered = new Set((result?.recommendations ?? []).map((r) => r.leverId).filter(Boolean));
    const ideas = (levers.data?.missing ?? [])
      .filter(
        (m) =>
          !covered.has(m.leverId) &&
          !(result?.recommendations ?? []).some((r) => sameTitle(r.title, m.title)) &&
          !tracked(m.title) &&
          !isRefused(m.title, m.leverId),
      )
      .map((idea): Todo => ({ key: `lever:${idea.leverId}`, kind: "lever", idea, gain: idea.gain }));
    return [...recs, ...ideas].sort((a, b) => b.gain - a.gain);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, levers.data, actions, refused]);

  const live = actions.filter((a) => !a.dropped);
  const doing = live.filter((a) => !a.finished && !a.paused);
  const paused = live.filter((a) => a.paused);
  const done = live.filter((a) => a.finished && !a.paused);
  const dropped = actions.filter((a) => a.dropped);

  const draftFor = (t: Todo): DoneDraft => {
    if (t.kind === "advice") {
      const r = t.rec;
      return {
        title: r.title,
        hint: r.actions[0],
        steps: r.actions,
        category: r.category,
        metric: r.metric,
        targetPct: r.targetPct,
        target: r.target,
        segment: r.outreach && r.outreach.segment !== "NONE" ? (r.outreach.segment as CampaignSegment) : undefined,
        sourceReportId: reportId ?? undefined,
        recommendationTitle: r.title,
      };
    }
    const p = t.idea.plan as { category?: AdvisorCategory; metric?: AdviceMetric; targetPct?: number; targetKind?: TargetKind; targetDays?: number[] };
    return {
      title: t.idea.title,
      hint: t.idea.steps[0],
      steps: t.idea.steps,
      category: p.category ?? "NEW_REVENUE",
      metric: p.metric,
      targetPct: p.targetPct,
      target: p.targetKind === "SLOT" ? { kind: "SLOT", days: p.targetDays ?? [], fromHour: 0, toHour: 0 } : undefined,
      recommendationTitle: t.idea.title,
    };
  };

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["advisor", "initiatives"] });
    void qc.invalidateQueries({ queryKey: ["advisor", "dismissals"] });
    void qc.invalidateQueries({ queryKey: ["performance", "levers"] });
  };
  const close = () => {
    setShown(null);
    setAsking(false);
  };

  const dismiss = useMutation({
    mutationFn: (v: { t: Todo; reason: string }) =>
      advisorApi.dismiss({
        title: v.t.kind === "advice" ? v.t.rec.title : v.t.idea.title,
        category: v.t.kind === "advice" ? v.t.rec.category : null,
        leverId: v.t.kind === "advice" ? v.t.rec.leverId || null : v.t.idea.leverId,
        reason: v.reason,
      }),
    onSuccess: (_r, v) => {
      toast.success(`Retirée : le conseiller ne la proposera plus (${v.reason.toLowerCase()})`);
      refresh();
      close();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const undismiss = useMutation({
    mutationFn: (id: string) => advisorApi.undismiss(id),
    onSuccess: () => {
      toast.success("Remise dans « À essayer »");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const update = useMutation({
    mutationFn: (v: { id: string; data: Parameters<typeof advisorApi.updateInitiative>[1]; msg: string }) =>
      advisorApi.updateInitiative(v.id, v.data),
    onSuccess: (_r, v) => {
      toast.success(v.msg);
      refresh();
      setAsking(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const shownTodo = shown?.kind === "todo" ? todo.find((t) => t.key === shown.key) ?? null : null;
  const shownAction = shown?.kind === "action" ? actions.find((a) => a.id === shown.id) ?? null : null;

  const nextUp = [
    ...doing.map((a) => ({ key: a.id, step: nextStep(a), title: a.title, open: () => openAction(a) })).filter((x) => x.step),
    ...todo.map((t) => ({
      key: t.key,
      step: t.kind === "advice" ? t.rec.actions[0] ?? t.rec.title : t.idea.steps[0] ?? t.idea.title,
      title: t.kind === "advice" ? t.rec.title : t.idea.title,
      open: () => setShown({ kind: "todo", key: t.key }),
    })),
  ].slice(0, 3);

  function openAction(a: BusinessInitiative) {
    setShown({ kind: "action", id: a.id });
    setAsking(false);
    setInterested(a.interested != null ? String(a.interested) : "");
  }

  const actionCard = (a: BusinessInitiative, i: number) => {
    const ui = CATEGORY_UI[a.category] ?? CATEGORY_UI.OPERATIONS;
    const step = nextStep(a);
    const net = a.result?.netGain;
    const verdict = a.ownerVerdict ?? (a.result?.status === "up" || a.result?.status === "goal_reached" ? "WORKING" : a.result?.status === "down" ? "NOT_WORKING" : null);
    return (
      <div
        key={a.id}
        role="button"
        tabIndex={0}
        onClick={() => openAction(a)}
        onKeyDown={(e) => e.key === "Enter" && openAction(a)}
        className={cn(cardClass, "space-y-1.5")}
        style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", ui.tone)}>{ui.label}</span>
          <span className="text-[11px] text-muted-foreground">
            {a.paused ? `⏸ depuis le ${day(a.pausedSince!)}` : a.finished ? (a.endDate ? `fini le ${day(a.endDate)}` : "28 jours mesurés") : `J+${a.activeDays}`}
          </span>
        </div>
        <div className="text-sm font-semibold leading-snug">{a.title}</div>
        {a.funnel?.length ? (
          <div className="space-y-0.5 text-xs">
            {a.funnel.filter((s) => s.value != null || s.pending).slice(0, 5).map((s) => (
              <div key={s.key} className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    s.value == null ? "border border-dashed border-muted-foreground" : s.value === 0 ? "border-2 border-rose-500" : "bg-emerald-500",
                  )}
                />
                <span className="flex-1 truncate">{s.label}</span>
                <b className="tabular-nums">{s.value ?? "—"}</b>
              </div>
            ))}
          </div>
        ) : null}
        {a.paused ? (
          <p className="text-xs text-muted-foreground">La mesure ne compte pas ces jours.</p>
        ) : a.finished ? (
          <p className="flex flex-wrap items-center gap-1.5 text-xs">
            {verdict ? (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 font-semibold",
                  verdict === "WORKING" ? "bg-emerald-100 text-emerald-700" : verdict === "MIXED" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700",
                )}
              >
                {verdict === "WORKING" ? "Ça marche" : verdict === "MIXED" ? "Mitigé" : "Ne marche pas"}
              </span>
            ) : (
              <span className="font-medium text-primary">Dis si ça a marché</span>
            )}
            {net != null ? <span className="text-muted-foreground">{net >= 0 ? "+" : ""}{Math.round(net)} DT net</span> : null}
          </p>
        ) : step ? (
          <p className="text-xs text-muted-foreground">
            Prochaine étape : <b className="font-medium text-foreground">{step}</b>
          </p>
        ) : null}
        {a.paused ? (
          <Button
            size="sm"
            className="h-7"
            onClick={(e) => {
              e.stopPropagation();
              update.mutate({ id: a.id, data: { paused: false }, msg: "Reprise : la mesure continue" });
            }}
          >
            <Play className="mr-1 h-3.5 w-3.5" /> Reprendre
          </Button>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <b className="text-foreground">Idée</b> <ChevronRight className="h-3.5 w-3.5" /> « Je commence »
        <ChevronRight className="h-3.5 w-3.5" /> <b className="text-foreground">En cours</b> : l&apos;app mesure
        <ChevronRight className="h-3.5 w-3.5" /> <b className="text-foreground">Terminé</b> : tu dis si ça marche · une idée qui ne te va pas → « Pas pour moi »
      </p>

      {nextUp.length ? (
        <section className="space-y-2.5 rounded-xl border bg-card p-4" aria-label="À faire cette semaine">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">À faire cette semaine</h2>
            <Button size="sm" variant="outline" onClick={onNew}>
              <Plus className="mr-1.5 h-4 w-4" /> J&apos;ai fait quelque chose
            </Button>
          </div>
          <ol className="grid gap-2 md:grid-cols-3">
            {nextUp.map((n, i) => (
              <li key={n.key}>
                <button
                  type="button"
                  onClick={n.open}
                  className="flex w-full items-start gap-2.5 rounded-lg bg-muted/60 p-2.5 text-left transition-colors hover:bg-primary/10"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
                  <span className="min-w-0">
                    <b className="block text-sm font-medium leading-snug">{n.step}</b>
                    <span className="block truncate text-xs text-muted-foreground">{n.title}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Column title="À essayer" hint="idées du conseiller" count={todo.length}>
          {todo.length ? (
            todo.map((t, i) => {
              const title = t.kind === "advice" ? t.rec.title : t.idea.title;
              const cat = t.kind === "advice" ? t.rec.category : ((t.idea.plan as { category?: AdvisorCategory }).category ?? "NEW_REVENUE");
              const ui = CATEGORY_UI[cat] ?? CATEGORY_UI.OPERATIONS;
              const rules = t.kind === "lever" || t.rec.source === "rules";
              const blocked = t.kind === "advice" ? blockedLabel(t.rec.category) : undefined;
              return (
                <div
                  key={t.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => setShown({ kind: "todo", key: t.key })}
                  onKeyDown={(e) => e.key === "Enter" && setShown({ kind: "todo", key: t.key })}
                  className={cn(cardClass, "space-y-1.5")}
                  style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", ui.tone)}>{ui.label}</span>
                    {t.gain > 0 ? <span className="text-xs font-bold text-emerald-600">≈ +{Math.round(t.gain)} DT/mois</span> : null}
                  </div>
                  <div className="text-sm font-semibold leading-snug">{title}</div>
                  {rules ? (
                    <p className="flex items-center gap-1 text-[11px] text-violet-700 dark:text-violet-300">
                      <Wand2 className="h-3 w-3" /> ajoutée par les règles : levier fort sans action
                    </p>
                  ) : null}
                  {blocked ? <p className="text-[11px] text-amber-700">{blocked}</p> : null}
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    <Button
                      size="sm"
                      className="h-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStart(draftFor(t));
                      }}
                    >
                      Je commence
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-muted-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShown({ kind: "todo", key: t.key });
                        setAsking(true);
                      }}
                    >
                      Pas pour moi
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            <Empty>Lance « Analyser » pour de nouvelles idées.</Empty>
          )}
        </Column>

        <Column title="En cours" hint="l'app mesure" count={doing.length}>
          {doing.length ? doing.map(actionCard) : <Empty>Clique « Je commence » sur une idée.</Empty>}
        </Column>

        <Column title="En pause" hint="la mesure est arrêtée" count={paused.length}>
          {paused.length ? paused.map(actionCard) : <Empty>Rien en pause.</Empty>}
        </Column>

        <Column title="Terminé" hint="résultat" count={done.length}>
          {done.length ? done.map(actionCard) : <Empty>—</Empty>}
          {refused.length || dropped.length ? (
            <details className="group">
              <summary className="cursor-pointer px-1 py-1 text-xs font-semibold text-muted-foreground">
                Pas pour moi · {refused.length + dropped.length}
              </summary>
              <ul className="mt-1 space-y-1.5">
                {dropped.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-dashed bg-background px-2.5 py-1.5 text-xs animate-in fade-in-0 motion-reduce:animate-none">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{a.title}</span>
                      <span className="text-muted-foreground">{a.dropped?.reason ?? "abandonnée"}</span>
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 shrink-0"
                      onClick={() => update.mutate({ id: a.id, data: { drop: null }, msg: "Remise dans « En cours »" })}
                    >
                      <RotateCcw className="mr-1 h-3.5 w-3.5" /> Remettre
                    </Button>
                  </li>
                ))}
                {refused.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-dashed bg-background px-2.5 py-1.5 text-xs animate-in fade-in-0 motion-reduce:animate-none">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{d.title}</span>
                      <span className="text-muted-foreground">{d.reason}</span>
                    </span>
                    <Button size="sm" variant="ghost" className="h-7 shrink-0" onClick={() => undismiss.mutate(d.id)}>
                      <RotateCcw className="mr-1 h-3.5 w-3.5" /> Remettre
                    </Button>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </Column>
      </div>

      <Sheet open={!!(shownTodo || shownAction)} onOpenChange={(o) => !o && close()}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {shownTodo ? (
            <>
              <SheetHeader className="text-left">
                <SheetTitle>{shownTodo.kind === "advice" ? shownTodo.rec.title : shownTodo.idea.title}</SheetTitle>
                <SheetDescription>
                  {shownTodo.kind === "lever" || shownTodo.rec.source === "rules"
                    ? "Ajoutée par les règles : tes chiffres poussent ce levier et aucune action n'est en cours."
                    : "Idée du conseiller, appuyée sur tes chiffres."}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                {shownTodo.kind === "advice" ? (
                  <ul>
                    <AdviceCard
                      defaultOpen
                      rec={shownTodo.rec}
                      index={0}
                      blockedBy={blockedLabel(shownTodo.rec.category)}
                      segmentCounts={segmentCounts}
                      onDone={() => {
                        onStart(draftFor(shownTodo));
                        close();
                      }}
                      onRelance={() => onRelance(shownTodo.rec)}
                      onOpenTracked={() => undefined}
                    />
                  </ul>
                ) : (
                  <div className="space-y-3">
                    <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm">{shownTodo.idea.why}</p>
                    <ol className="list-decimal space-y-1 pl-5 text-sm">
                      {shownTodo.idea.steps.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ol>
                    {shownTodo.gain > 0 ? <p className="text-sm font-semibold text-emerald-600">≈ +{Math.round(shownTodo.gain)} DT/mois si ça marche</p> : null}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 border-t pt-3">
                  <Button
                    onClick={() => {
                      onStart(draftFor(shownTodo));
                      close();
                    }}
                  >
                    Je commence
                  </Button>
                  <Button variant="outline" onClick={() => setAsking((v) => !v)}>
                    Pas pour moi
                  </Button>
                </div>
                {asking ? <Reasons busy={dismiss.isPending} onPick={(reason) => dismiss.mutate({ t: shownTodo, reason })} /> : null}
              </div>
            </>
          ) : shownAction ? (
            <>
              <SheetHeader className="text-left">
                <SheetTitle>{shownAction.title}</SheetTitle>
                <SheetDescription>
                  {shownAction.paused
                    ? `En pause depuis le ${day(shownAction.pausedSince!)} : ces jours ne comptent pas dans la mesure.`
                    : shownAction.finished
                      ? "Terminée : dis si ça a marché, le conseiller en tient compte."
                      : `En cours depuis le ${day(shownAction.startDate)} · ${shownAction.activeDays} jour${shownAction.activeDays > 1 ? "s" : ""} mesuré${shownAction.activeDays > 1 ? "s" : ""}${shownAction.pausedDays ? ` · ${shownAction.pausedDays} jour${shownAction.pausedDays > 1 ? "s" : ""} de pause non comptés` : ""}`}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                {!shownAction.dropped ? (
                  <div className="flex flex-wrap gap-2">
                    {shownAction.paused ? (
                      <Button
                        disabled={update.isPending}
                        onClick={() => update.mutate({ id: shownAction.id, data: { paused: false }, msg: "Reprise : la mesure continue" })}
                      >
                        <Play className="mr-1.5 h-4 w-4" /> Reprendre
                      </Button>
                    ) : !shownAction.finished ? (
                      <Button
                        variant="outline"
                        disabled={update.isPending}
                        onClick={() =>
                          update.mutate({ id: shownAction.id, data: { paused: true }, msg: "En pause : ces jours ne comptent pas dans la mesure" })
                        }
                      >
                        <Pause className="mr-1.5 h-4 w-4" /> Pause
                      </Button>
                    ) : null}
                    <Button variant="ghost" className="text-muted-foreground" onClick={() => setAsking((v) => !v)}>
                      Abandonner
                    </Button>
                  </div>
                ) : null}
                {asking ? (
                  <Reasons
                    busy={update.isPending}
                    onPick={(reason) =>
                      update.mutate({ id: shownAction.id, data: { drop: { reason } }, msg: `Abandonnée (${reason.toLowerCase()}) : rangée dans « Pas pour moi »` })
                    }
                  />
                ) : null}
                <form
                  className="flex flex-wrap items-end gap-2 rounded-xl border p-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    update.mutate({
                      id: shownAction.id,
                      data: { interested: interested === "" ? null : Number(interested) },
                      msg: "Intéressés enregistrés",
                    });
                  }}
                >
                  <label className="min-w-0 flex-1 space-y-1" htmlFor={`interested-${shownAction.id}`}>
                    <span className="block text-sm font-medium">Intéressés</span>
                    <span className="block text-xs text-muted-foreground">
                      Les personnes qui t&apos;ont dit oui (message, story, en personne), même sans inscription.
                    </span>
                  </label>
                  <Input
                    id={`interested-${shownAction.id}`}
                    type="number"
                    min={0}
                    inputMode="numeric"
                    className="w-24"
                    value={interested}
                    placeholder="—"
                    onChange={(e) => setInterested(e.target.value)}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    disabled={update.isPending || interested === (shownAction.interested != null ? String(shownAction.interested) : "")}
                  >
                    Enregistrer
                  </Button>
                </form>
                <ul>
                  <FollowUpCard key={shownAction.id} defaultOpen item={shownAction} index={0} review={reviews.get(shownAction.id)} />
                </ul>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
