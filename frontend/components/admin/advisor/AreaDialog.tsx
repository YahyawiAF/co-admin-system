"use client";

import { CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { BannerChip, DIALOG_CLASS } from "@/components/admin/OutreachCampaigns";
import type { BusinessInitiative, HealthArea, HealthSolution, ToolDraft, ToolKind } from "@/lib/types";
import { AREA_ICON, STATUS_TEXT, STATUS_UI, VERDICTS, signedDt } from "./conseil-ui";
import { IdleSolutionCard, RunningSolutionCard } from "./SolutionCards";

/** 8 weekly bars, the last one (this week) highlighted. */
function Trend({ area }: { area: HealthArea }) {
  const vals = area.trend.values;
  const max = Math.max(1, ...vals.map((v) => v ?? 0));
  return (
    <figure className="space-y-1.5">
      <div
        className="flex h-20 items-end gap-1.5"
        role="img"
        aria-label={`${area.trend.label} : ${vals.map((v) => (v == null ? "—" : `${v}${area.trend.unit}`)).join(", ")}`}
      >
        {vals.map((v, k) => (
          <div key={k} className="flex h-full flex-1 flex-col justify-end">
            <div
              title={v == null ? "pas assez de visites" : `${v}${area.trend.unit}`}
              className={cn(
                "rounded-t-md transition-[height] duration-500 ease-out motion-reduce:transition-none",
                v == null ? "h-1 bg-slate-200" : k === vals.length - 1 ? "bg-indigo-600" : "bg-indigo-200",
              )}
              style={v == null ? undefined : { height: `${Math.max(6, Math.round((v / max) * 100))}%` }}
            />
          </div>
        ))}
      </div>
      <figcaption className="flex justify-between text-[11px] text-slate-500">
        <span>il y a 8 semaines</span>
        <span className="font-medium text-slate-600">{area.trend.label}</span>
        <span>cette semaine</span>
      </figcaption>
    </figure>
  );
}

export function AreaDialog({
  area,
  running,
  max,
  full,
  startingKey,
  onClose,
  onStart,
  onAdapt,
  onEdit,
  onPrepare,
  onLinkExisting,
}: {
  area: HealthArea | null;
  running: BusinessInitiative[];
  max: number;
  full: boolean;
  startingKey: string | null;
  onClose: () => void;
  onStart: (s: HealthSolution) => void;
  onAdapt: (s: HealthSolution) => void;
  onEdit: (i: BusinessInitiative) => void;
  onPrepare: (i: BusinessInitiative, tool: ToolDraft) => void;
  onLinkExisting: (i: BusinessInitiative, kind: ToolKind | null, step: number | null) => void;
}) {
  const Icon = area ? AREA_ICON[area.id] : CheckCircle2;
  const verdictLabel = (v: string | null) => VERDICTS.find(([k]) => k === v)?.[1];
  return (
    <Dialog open={!!area} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(DIALOG_CLASS, "h-[92vh] max-w-6xl bg-slate-50")}>
        {area ? (
          <>
            <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 px-6 pb-5 pt-5 text-white">
              <div className="pointer-events-none absolute inset-0" aria-hidden>
                <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10" />
                <div className="absolute -bottom-14 left-1/3 h-32 w-32 rounded-full bg-white/10" />
              </div>
              <div className="relative pr-10">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-100">
                  Bilan · {area.name} · {area.statusLabel}
                </p>
                <DialogTitle className="mt-1 flex items-center gap-2 text-2xl font-extrabold leading-tight text-white">
                  <Icon className="h-6 w-6 shrink-0" />
                  {area.headline}
                </DialogTitle>
                <DialogDescription className="sr-only">{area.problem}</DialogDescription>
              </div>
              <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <BannerChip label={area.sub} value={area.big} />
                <BannerChip label={area.compare.label} value={area.compare.value} />
                <BannerChip label={area.lost?.label ?? "rien de perdu"} value={area.lost?.value ?? "—"} />
                <BannerChip label="en cours ici" value={String(running.length)} sub={`${max} au maximum en tout`} />
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-wrap items-start gap-5 overflow-y-auto p-5 sm:p-6">
              <div className="min-w-0 flex-[1_1_300px] space-y-4">
                <section className="space-y-3 rounded-2xl border bg-white p-4">
                  <h3 className="text-[15px] font-extrabold">Le problème</h3>
                  <p className="text-sm text-slate-700">{area.problem}</p>
                  <Trend area={area} />
                </section>

                <section className="space-y-2.5 rounded-2xl border bg-white p-4">
                  <h3 className="text-[15px] font-extrabold">Déjà fait ici</h3>
                  {area.history.length || area.alreadyDone.length ? (
                    <ul className="space-y-2">
                      {area.alreadyDone.map((d) => (
                        <li key={d.leverId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                          <span>
                            <b className="block">{d.title}</b>
                            <span className="text-xs text-slate-600">{d.note}</span>
                          </span>
                          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", d.working ? "bg-emerald-100 text-emerald-800" : "bg-indigo-100 text-indigo-800")}>
                            {d.working ? "Ça marche" : "En cours"}
                          </span>
                        </li>
                      ))}
                      {area.history.map((h) => (
                        <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                          <span>
                            <b className="block">{h.title}</b>
                            <span className="text-xs text-slate-600">
                              terminé le {new Date(`${h.when}T12:00:00`).toLocaleDateString("fr-FR")}
                              {h.status ? ` · ${STATUS_TEXT[h.status] ?? h.status}` : ""}
                            </span>
                          </span>
                          <span className="flex items-center gap-2">
                            {verdictLabel(h.verdict) ? (
                              <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-slate-700">{verdictLabel(h.verdict)}</span>
                            ) : null}
                            {h.netGain != null ? <b className="tabular-nums text-emerald-700">{signedDt(h.netGain)}</b> : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500">Rien essayé ici pour l&apos;instant.</p>
                  )}
                </section>

                <section className="rounded-2xl bg-indigo-50 p-4 text-sm text-indigo-950">
                  <b className="mb-1 block">Comment on mesure</b>
                  {area.how}
                </section>
              </div>

              <div className="min-w-0 flex-[1.5_1_420px] space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-base font-extrabold">
                    {running.length ? "En cours et à essayer" : area.solutions.length > 1 ? `${area.solutions.length} solutions` : "Solutions"}
                  </h3>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", STATUS_UI[area.status].pill)}>{area.statusLabel}</span>
                </div>

                {running.map((i) => (
                  <RunningSolutionCard
                    key={i.id}
                    i={i}
                    onEdit={() => onEdit(i)}
                    onPrepare={(t) => onPrepare(i, t)}
                    onLinkExisting={(kind, step) => onLinkExisting(i, kind, step)}
                  />
                ))}

                {area.solutions.map((s) => (
                  <IdleSolutionCard
                    key={s.key}
                    s={s}
                    max={max}
                    full={full}
                    starting={startingKey === s.key}
                    onStart={() => onStart(s)}
                    onAdapt={() => onAdapt(s)}
                    onDismissed={() => undefined}
                  />
                ))}

                {!running.length && !area.solutions.length ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
                    {area.status === "green"
                      ? "Ça va bien ici : rien à faire pour l'instant. Le bilan vous prévient si ça baisse."
                      : area.status === "grey"
                        ? "Pas encore assez de données pour proposer quelque chose ici."
                        : "Pas de nouvelle solution : ce qui est déjà en cours doit d'abord donner son résultat. « Refaire le bilan » demande de nouvelles idées à l'IA."}
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
