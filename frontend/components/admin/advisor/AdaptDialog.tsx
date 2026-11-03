"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Sparkles, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { advisorApi } from "@/lib/api/resources";
import { DIALOG_CLASS } from "@/components/admin/OutreachCampaigns";
import type { BusinessInitiative, HealthSolution, ToolDraft } from "@/lib/types";
import { TOOL_UI } from "./conseil-ui";

type Fields = { title: string; why: string; steps: string[]; goalAmount: string; cost: string; tools: ToolDraft[] };

/** The initiative created when the owner starts a solution (one tap, or after « Adapter »). */
export function startPayload(s: HealthSolution, edits?: Partial<Omit<Fields, "goalAmount" | "cost">> & { goalAmount?: number; cost?: number }) {
  const t = s.target;
  const slot = t?.kind === "SLOT" && (t.days.length || (t.fromHour != null && t.toHour != null));
  const kind = slot ? "SLOT" : s.segment ? "LIST" : "ALL";
  const steps = (edits?.steps ?? s.steps).map((text) => text.trim()).filter(Boolean);
  return {
    title: (edits?.title ?? s.title).trim(),
    description: edits?.why ?? s.why ?? undefined,
    category: s.category,
    startDate: format(new Date(), "yyyy-MM-dd"),
    sourceReportId: s.reportId ?? undefined,
    // Kept to the original title so the bilan knows this idea is taken
    recommendationTitle: s.title,
    metric: s.metric ?? undefined,
    cost: edits?.cost ?? s.cost,
    targetKind: kind,
    targetDays: slot ? t!.days : [],
    targetFromHour: slot ? t!.fromHour : null,
    targetToHour: slot ? t!.toHour : null,
    targetSegment: kind === "LIST" ? s.segment : null,
    objective: s.objective,
    channels: s.channels,
    steps: steps.map((text) => ({ text, done: false })),
    goalAmount: edits?.goalAmount ?? s.goalAmount,
    area: s.area,
    leverId: s.leverId,
    tools: (edits?.tools ?? s.tools).filter((x) => x.step == null || x.step < steps.length),
  } as Parameters<typeof advisorApi.createInitiative>[0];
}

/** Starts a solution; an empty client list falls back to the whole space. */
export async function startSolution(payload: Parameters<typeof advisorApi.createInitiative>[0]) {
  try {
    return await advisorApi.createInitiative(payload);
  } catch (e) {
    if (payload.targetKind === "LIST" && /Personne dans cette liste/.test((e as Error).message)) {
      return advisorApi.createInitiative({ ...payload, targetKind: "ALL", targetSegment: null });
    }
    throw e;
  }
}

export type AdaptTarget = { mode: "start"; solution: HealthSolution } | { mode: "edit"; initiative: BusinessInitiative };

/**
 * « Adapter »: change a solution to suit you — by hand, or by telling the AI in one sentence.
 * Start mode creates the solution with the changes; edit mode saves them on the running one.
 */
export function AdaptDialog({
  target,
  full,
  onClose,
  onStarted,
}: {
  target: AdaptTarget | null;
  full: boolean;
  onClose: () => void;
  onStarted: (i: BusinessInitiative) => void;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState<Fields | null>(null);
  const [instruction, setInstruction] = useState("");
  const settings = useQuery({ queryKey: ["advisor", "settings"], queryFn: advisorApi.settings, enabled: !!target });

  useEffect(() => {
    if (!target) return;
    setInstruction("");
    if (target.mode === "start") {
      const s = target.solution;
      setF({ title: s.title, why: s.why, steps: [...s.steps], goalAmount: String(s.goalAmount), cost: String(s.cost), tools: s.tools });
    } else {
      const i = target.initiative;
      setF({
        title: i.title,
        why: i.description ?? "",
        steps: i.steps.map((s) => s.text),
        goalAmount: i.goalAmount != null ? String(i.goalAmount) : "",
        cost: i.cost != null ? String(i.cost) : "0",
        tools: i.tools,
      });
    }
  }, [target]);

  const set = (patch: Partial<Fields>) => setF((x) => (x ? { ...x, ...patch } : x));
  const num = (s: string) => Math.max(0, Number(s.replace(",", ".")) || 0);

  const ai = useMutation({
    mutationFn: () =>
      advisorApi.adapt({
        solution: { title: f!.title, why: f!.why, steps: f!.steps, cost: num(f!.cost), goalAmount: num(f!.goalAmount), tools: f!.tools },
        instruction,
      }),
    onSuccess: (r) => {
      set({ title: r.title, why: r.why, steps: r.steps, goalAmount: String(r.goalAmount), cost: String(r.cost), tools: r.tools });
      toast.success("Solution adaptée : relisez puis enregistrez");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: async () => {
      const x = f!;
      const steps = x.steps.map((s) => s.trim()).filter(Boolean);
      if (target!.mode === "start") {
        return startSolution(
          startPayload(target!.solution, { title: x.title, why: x.why, steps, goalAmount: num(x.goalAmount), cost: num(x.cost), tools: x.tools }),
        );
      }
      const i = target!.initiative;
      return advisorApi.updateInitiative(i.id, {
        title: x.title.trim(),
        description: x.why.trim() || null,
        // Keep what was already ticked when a step stays
        steps: steps.map((text) => i.steps.find((s) => s.text === text) ?? { text, done: false }),
        goalAmount: num(x.goalAmount) || null,
        cost: num(x.cost),
        tools: x.tools.filter((t) => t.step == null || t.step < steps.length),
      });
    },
    onSuccess: (i) => {
      qc.invalidateQueries({ queryKey: ["advisor"] });
      toast.success(target?.mode === "start" ? "C'est parti : la mesure commence aujourd'hui" : "Solution mise à jour");
      if (target?.mode === "start") onStarted(i);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const aiOn = settings.data?.enabled ?? false;
  const startMode = target?.mode === "start";

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(DIALOG_CLASS, "max-w-3xl")}>
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 px-6 pb-5 pt-5 text-white">
          <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" aria-hidden />
          <p className="relative text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-100">
            {startMode ? "Adapter avant de commencer" : "Modifier la solution"}
          </p>
          <DialogTitle className="relative mt-1 pr-10 text-xl font-extrabold leading-snug text-white">{f?.title || "Solution"}</DialogTitle>
          <DialogDescription className="relative mt-1 text-[13px] text-indigo-100">
            Changez ce qui ne vous va pas. L&apos;app mesure ensuite l&apos;argent que ça rapporte.
          </DialogDescription>
        </div>

        {f ? (
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
            <section className="space-y-2 rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
              <Label htmlFor="adapt-ai" className="flex items-center gap-1.5 text-sm font-bold text-violet-950">
                <Sparkles className="h-4 w-4" />
                Dites à l&apos;IA comment l&apos;adapter
              </Label>
              <Textarea
                id="adapt-ai"
                rows={2}
                maxLength={500}
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Ex. : plutôt le samedi, sans remise, avec un tournoi d'échecs"
                className="bg-white"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-violet-900">
                  {aiOn ? "L'IA réécrit les objectifs et prépare les outils. Rien n'est enregistré avant vous." : "IA non configurée : modifiez à la main ci-dessous."}
                </span>
                <Button
                  type="button"
                  disabled={!aiOn || !instruction.trim() || ai.isPending}
                  onClick={() => ai.mutate()}
                  className="rounded-xl bg-violet-600 font-bold hover:bg-violet-700"
                >
                  {ai.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Wand2 className="mr-1.5 h-4 w-4" />}
                  Adapter avec l&apos;IA
                </Button>
              </div>
            </section>

            <div className="space-y-1.5">
              <Label htmlFor="adapt-title">Titre</Label>
              <Input id="adapt-title" value={f.title} maxLength={200} onChange={(e) => set({ title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adapt-why">Pourquoi ça peut marcher</Label>
              <Input id="adapt-why" value={f.why} maxLength={300} onChange={(e) => set({ why: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Objectifs</Label>
              {f.steps.map((s, k) => {
                const tool = f.tools.find((t) => t.step === k);
                return (
                  <div key={k} className="flex items-center gap-2 animate-in fade-in-0 duration-200 motion-reduce:animate-none">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-extrabold text-slate-600">{k + 1}</span>
                    <Input
                      aria-label={`Objectif ${k + 1}`}
                      value={s}
                      maxLength={200}
                      onChange={(e) => set({ steps: f.steps.map((x, n) => (n === k ? e.target.value : x)) })}
                    />
                    {tool ? (
                      <span className="hidden shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 sm:inline">
                        {TOOL_UI[tool.kind].label}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      aria-label={`Retirer l'objectif ${k + 1}`}
                      onClick={() =>
                        set({
                          steps: f.steps.filter((_, n) => n !== k),
                          // Tools follow their objective
                          tools: f.tools
                            .filter((t) => t.step !== k)
                            .map((t) => (t.step != null && t.step > k ? { ...t, step: t.step - 1 } : t)),
                        })
                      }
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
              <Button type="button" variant="outline" size="sm" disabled={f.steps.length >= 6} onClick={() => set({ steps: [...f.steps, ""] })}>
                <Plus className="mr-1 h-4 w-4" />
                Ajouter un objectif
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="adapt-goal">Objectif en DT (4 semaines)</Label>
                <Input id="adapt-goal" inputMode="decimal" value={f.goalAmount} onChange={(e) => set({ goalAmount: e.target.value })} className="text-lg font-bold tabular-nums" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adapt-cost">Ça coûte (DT)</Label>
                <Input id="adapt-cost" inputMode="decimal" value={f.cost} onChange={(e) => set({ cost: e.target.value })} className="tabular-nums" />
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t px-6 py-3">
          {startMode && full ? <span className="mr-auto text-xs font-medium text-rose-700">3 solutions en cours : finissez-en une d&apos;abord</span> : null}
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={!f?.title.trim() || save.isPending || (startMode && full)}
            onClick={() => save.mutate()}
            className="rounded-xl bg-indigo-600 font-bold hover:bg-indigo-700"
          >
            {save.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            {startMode ? "Commencer avec ces changements" : "Enregistrer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
