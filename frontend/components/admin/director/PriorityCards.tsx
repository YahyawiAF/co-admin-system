"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Check, Eye, Hammer, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CampaignDialog, type CampaignDraft } from "@/components/admin/OutreachCampaigns";
import { prepareHref, TOOL_UI } from "@/components/admin/advisor/conseil-ui";
import {
  DIRECTOR_KEY,
  directorApi,
  type DirectorLeg,
  type DirectorNeed,
  type DirectorPriority,
  type DirectorWatch,
} from "@/lib/api/director";
import type { CampaignSegment } from "@/lib/types";
import { cn } from "@/lib/utils";

const ENTER = "animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both duration-300 motion-reduce:animate-none";
const num = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const signed = (n: number, unit: string) => `${n > 0 ? "+" : ""}${num(n)} ${unit}`;

function useDirectorAction<T>(fn: (x: T) => Promise<unknown>, done?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      if (done) toast.success(done);
      qc.invalidateQueries({ queryKey: DIRECTOR_KEY });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** One number the app follows: before (same weekdays) → since the start, its split and the drafts' sales. */
export function WatchLine({ w }: { w: DirectorWatch }) {
  const stop = useDirectorAction(() => directorApi.stopWatch(w.id));
  const r = w.result;
  const ratio = w.aggregate === "ratio";
  const unit = ratio ? "%" : w.unit;
  const progress = !r
    ? "œil inconnu"
    : w.stopped
      ? "arrêté"
      : r.status === "waiting"
        ? "commence demain"
        : r.status === "done"
          ? `terminé · ${r.length} jours`
          : `jour ${r.daysMeasured} sur ${r.length}`;
  const up = r?.change != null && r.change > 0;
  const down = r?.change != null && r.change < 0;
  return (
    <div className="space-y-1.5 rounded-xl bg-slate-50 px-3.5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-slate-800">
          <Eye className="h-4 w-4 shrink-0 text-indigo-600" aria-hidden />
          {w.label}
        </p>
        <span className="text-[13px] text-slate-500">{progress}</span>
      </div>
      {r && r.status !== "waiting" && r.before != null && r.after != null ? (
        <p className="text-sm tabular-nums">
          <span className="text-slate-600">
            {num(r.before)} {unit} avant
          </span>
          <span className="mx-1.5 text-slate-400">→</span>
          <b>
            {num(r.after)} {unit}
          </b>
          {r.change != null ? (
            <span className={cn("ml-2 rounded-full px-2 py-0.5 text-xs font-bold", up ? "bg-emerald-100 text-emerald-800" : down ? "bg-orange-100 text-orange-900" : "bg-slate-200 text-slate-700")}>
              {signed(r.change, r.changeUnit)}
            </span>
          ) : null}
        </p>
      ) : null}
      {r?.splits.length ? (
        <p className="flex flex-wrap gap-1.5">
          {r.splits.slice(0, 4).map((s) => (
            <span key={s.key} className="rounded-full bg-white px-2.5 py-0.5 text-xs text-slate-700 ring-1 ring-slate-200 tabular-nums">
              {s.key} {num(s.before)} → <b>{num(s.after)}</b>
            </span>
          ))}
        </p>
      ) : null}
      {r?.sales ? (
        <p className="text-[13px] text-emerald-800">
          {r.sales.count} vente{r.sales.count > 1 ? "s" : ""} grâce aux brouillons validés · {num(r.sales.revenue)} DT
        </p>
      ) : null}
      {r?.periods.length ? (
        <p className="flex items-center gap-1 text-[13px] text-amber-900">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          Pendant la mesure : {r.periods.join(", ")}. La comparaison peut être faussée.
        </p>
      ) : null}
      {r && r.status !== "done" ? (
        <button type="button" onClick={() => stop.mutate(undefined)} className="min-h-8 text-[13px] font-semibold text-slate-500 hover:text-slate-800">
          {w.stopped ? "Reprendre le suivi" : "Arrêter le suivi"}
        </button>
      ) : null}
    </div>
  );
}

function LegButton({ p, leg, onCampaign }: { p: DirectorPriority; leg: DirectorLeg; onCampaign: (p: DirectorPriority, leg: DirectorLeg) => void }) {
  const router = useRouter();
  const skip = useDirectorAction(() => directorApi.setLeg(p.id, leg.index, { status: leg.status === "SKIPPED" ? "DRAFT" : "SKIPPED" }));
  const ui = TOOL_UI[leg.kind];
  const Icon = ui.icon;
  if (leg.status === "DONE")
    return (
      <span className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-50 px-3.5 text-sm font-semibold text-emerald-800">
        <Check className="h-4 w-4" aria-hidden />
        {ui.label} créée : ses ventes comptent
      </span>
    );
  if (leg.status === "SKIPPED")
    return (
      <button type="button" onClick={() => skip.mutate(undefined)} className="min-h-11 rounded-xl px-3 text-sm text-slate-500 line-through hover:text-slate-800">
        {leg.label}
      </button>
    );
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Button
        className="h-11 rounded-xl font-bold"
        onClick={() =>
          leg.kind === "CAMPAIGN"
            ? onCampaign(p, leg)
            : router.push(prepareHref({ i: "", s: null, a: null, p: p.id, l: leg.index, k: leg.kind, d: leg.draft }))
        }
      >
        <Icon className="mr-1.5 h-4 w-4" aria-hidden />
        {leg.label}
      </Button>
      <Button variant="ghost" className="h-11 rounded-xl text-slate-500" onClick={() => skip.mutate(undefined)}>
        Passer
      </Button>
    </span>
  );
}

/** The brain's priorities: why, the owner's steps, drafts to approve, and what the app measures by itself. */
export function PriorityCards({ list, cornerName }: { list: DirectorPriority[]; cornerName: (id: string) => string }) {
  const [campaign, setCampaign] = useState<{ priorityId: string; index: number; draft: CampaignDraft } | null>(null);
  const step = useDirectorAction(({ id, index, done }: { id: string; index: number; done: boolean }) => directorApi.setStep(id, index, done));
  const close = useDirectorAction(
    ({ id, status }: { id: string; status: DirectorPriority["status"] }) => directorApi.setPriority(id, status),
    "Priorité rangée : ses suivis continuent jusqu’au bout",
  );
  const linkCampaign = useDirectorAction(
    ({ id, index, targetId }: { id: string; index: number; targetId: string }) => directorApi.setLeg(id, index, { targetId, status: "DONE" }),
    "Relance créée : elle compte pour la priorité",
  );
  const active = list.filter((p) => p.status === "ACTIVE");
  const closed = list.filter((p) => p.status !== "ACTIVE");

  return (
    <div className="space-y-3">
      <ol className="space-y-3">
        {active.map((p, k) => (
          <li key={p.id} className={cn("overflow-hidden rounded-2xl border bg-white", ENTER)} style={{ animationDelay: `${k * 50}ms` }}>
            <div className="flex flex-wrap items-start gap-3 border-b bg-indigo-950 px-4 py-3.5 text-white sm:px-5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15 text-sm font-extrabold">{k + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-bold uppercase tracking-wider text-indigo-200">
                  {cornerName(p.corner)} · depuis le {p.startDate.split("-").reverse().slice(0, 2).join("/")}
                </p>
                <h3 className="text-lg font-extrabold leading-snug">{p.title}</h3>
              </div>
            </div>
            <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-2">
              <div className="space-y-3">
                {p.why ? (
                  <p className="text-sm text-slate-700">
                    <b className="text-indigo-700">Pourquoi : </b>
                    {p.why}
                  </p>
                ) : null}
                {p.steps.length ? (
                  <ul className="space-y-1.5">
                    {p.steps.map((s, i) => (
                      <li key={i}>
                        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl px-2 py-2 transition-colors duration-150 hover:bg-slate-50 motion-reduce:transition-none">
                          <input
                            type="checkbox"
                            className="mt-0.5 h-5 w-5 shrink-0 accent-indigo-600"
                            checked={s.done}
                            onChange={(e) => step.mutate({ id: p.id, index: i, done: e.target.checked })}
                          />
                          <span className={cn("text-[15px] leading-snug transition-colors duration-200", s.done && "text-slate-400 line-through")}>{s.text}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {p.legs.length ? (
                  <div className="space-y-1.5">
                    <p className="text-[12px] font-bold uppercase tracking-wider text-slate-500">Prêt, à valider</p>
                    <div className="flex flex-wrap gap-2">
                      {p.legs.map((l) => (
                        <LegButton
                          key={l.index}
                          p={p}
                          leg={l}
                          onCampaign={(pr, leg) => {
                            const d = leg.draft as { title?: string; message?: string; segment?: string };
                            setCampaign({
                              priorityId: pr.id,
                              index: leg.index,
                              draft: { title: d.title || pr.title, message: d.message ?? "", segment: (d.segment as CampaignSegment) || undefined, trackAsInitiative: false },
                            });
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="space-y-2">
                <p className="text-[12px] font-bold uppercase tracking-wider text-slate-500">L’app mesure toute seule</p>
                {p.watches.length ? (
                  p.watches.map((w) => <WatchLine key={w.id} w={w} />)
                ) : (
                  <p className="rounded-xl border border-dashed p-3 text-[13px] text-slate-500">Pas de chiffre suivi pour cette priorité.</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t px-4 py-3 sm:px-5">
              <Button variant="ghost" className="h-11 rounded-xl text-slate-500" onClick={() => close.mutate({ id: p.id, status: "DROPPED" })}>
                Abandonner
              </Button>
              <Button className="h-11 rounded-xl bg-emerald-600 font-bold hover:bg-emerald-700" onClick={() => close.mutate({ id: p.id, status: "DONE" })}>
                <Check className="mr-1.5 h-4 w-4" />
                C’est fait
              </Button>
            </div>
          </li>
        ))}
      </ol>

      {closed.length ? (
        <details className="group rounded-2xl border bg-white">
          <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-semibold text-slate-600">
            Terminées ces 30 jours · {closed.length} (leurs suivis continuent)
          </summary>
          <div className="space-y-3 px-4 pb-4">
            {closed.map((p) => (
              <div key={p.id} className="space-y-2 border-t pt-3">
                <p className="text-sm">
                  <b>{p.title}</b> <span className="text-slate-500">· {p.status === "DROPPED" ? "abandonnée" : "faite"}</span>
                </p>
                {p.watches.map((w) => (
                  <WatchLine key={w.id} w={w} />
                ))}
              </div>
            ))}
          </div>
        </details>
      ) : null}

      <CampaignDialog
        draft={campaign?.draft ?? null}
        onClose={() => setCampaign(null)}
        onCreated={(c) => {
          if (campaign) linkCampaign.mutate({ id: campaign.priorityId, index: campaign.index, targetId: c.id });
        }}
      />
    </div>
  );
}

/** What the brain can't see or do: the owner decides whether it gets coded. */
export function NeedsCard({ needs }: { needs: DirectorNeed[] }) {
  const set = useDirectorAction(({ key, stage }: { key: string; stage: "APPROVED" | "DEFERRED" | "REJECTED" }) => directorApi.setNeed(key, stage));
  const open = needs.filter((n) => n.stage === "SUGGESTED");
  const approved = needs.filter((n) => n.stage === "APPROVED" || n.stage === "TICKET_READY");
  if (!needs.length) return null;
  return (
    <section className={cn("space-y-3 rounded-2xl border bg-white p-4 sm:p-5", ENTER)}>
      <div>
        <h2 className="flex items-center gap-2 text-base font-extrabold">
          <Hammer className="h-4 w-4 text-indigo-600" aria-hidden />
          Le directeur a besoin de…
        </h2>
        <p className="text-[13px] text-slate-500">Ce que l’app ne voit pas ou ne sait pas faire encore. Il faut le coder : à toi de décider.</p>
      </div>
      {open.map((n) => (
        <div key={n.key} className={cn("space-y-2 rounded-xl border p-3.5", ENTER)}>
          <p className="font-bold">{n.title}</p>
          {n.problem ? <p className="text-sm text-slate-700">{n.problem}</p> : null}
          {n.capability ? (
            <p className="text-[13px] text-slate-500">
              <Sparkles className="mr-1 inline h-3.5 w-3.5 text-indigo-600" aria-hidden />À coder : {n.capability}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button className="h-11 rounded-xl font-bold" onClick={() => set.mutate({ key: n.key, stage: "APPROVED" })}>
              Oui, à coder
            </Button>
            <Button variant="outline" className="h-11 rounded-xl" onClick={() => set.mutate({ key: n.key, stage: "DEFERRED" })}>
              Plus tard
            </Button>
            <Button variant="ghost" className="h-11 rounded-xl text-slate-500" onClick={() => set.mutate({ key: n.key, stage: "REJECTED" })}>
              Non
            </Button>
          </div>
        </div>
      ))}
      {approved.length ? (
        <p className="text-[13px] text-slate-600">
          Acceptés, à coder : {approved.map((n) => n.title).join(" · ")}
        </p>
      ) : null}
    </section>
  );
}
