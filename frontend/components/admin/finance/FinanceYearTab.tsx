"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ListPager, usePaged } from "@/components/ui/list-pager";
import { cn } from "@/lib/utils";
import { analyticsApi } from "@/lib/api/resources";
import { dt } from "@/lib/finance-queries";
import type { SchoolYear, SchoolYearWeek, UnusualDays } from "@/lib/types";
import { InfoButton, InfoCalc, ProgressBar } from "./InfoModal";

/** Calendar kinds, in a fixed order (validated palette: amber, sky, rose, violet). */
const KINDS: Array<{ id: string; label: string; color: string; match: (t: string) => boolean }> = [
  { id: "exams", label: "Examens / révisions", color: "#d97706", match: (t) => t === "exams" },
  { id: "vacation", label: "Vacances", color: "#0284c7", match: (t) => t === "vacation" },
  { id: "holiday", label: "Jour férié", color: "#e11d48", match: (t) => t === "holiday" || t.startsWith("holiday") },
  { id: "other", label: "Ramadan / événement", color: "#7c3aed", match: () => true },
];
const kindOf = (t: string | null) => (t ? KINDS.find((k) => k.match(t.split(":")[0])) ?? KINDS[3] : null);

const pct = (f: number) => `${f >= 1 ? "+" : "−"}${Math.abs(Math.round((f - 1) * 100))} %`;

function YearChart({ y }: { y: SchoolYear }) {
  const [hover, setHover] = useState<SchoolYearWeek | null>(null);
  const max = Math.max(1, ...y.weeks.map((w) => Math.max(w.actual ?? 0, w.expected, w.normal)));
  const shown = hover ?? y.weeks.find((w) => w.current) ?? null;
  const usedKinds = KINDS.filter((k) => y.weeks.some((w) => kindOf(w.periodType)?.id === k.id));
  return (
    <div>
      <div className="mb-2 min-h-10 text-sm" aria-live="polite">
        {shown ? (
          <>
            <b>Semaine du {format(new Date(`${shown.from}T12:00:00`), "d MMMM", { locale: fr })}</b>
            {" · "}
            {shown.actual != null ? <>réel {dt(shown.actual)}</> : null}
            {shown.actual != null && shown.expected > 0 ? " + " : ""}
            {shown.expected > 0 ? <>prévu {dt(shown.expected)}</> : null}
            {" · semaine normale "}
            {dt(shown.normal)}
            {shown.period ? <span className="text-muted-foreground"> · {shown.period}{shown.known ? "" : " (effet pas encore mesuré)"}</span> : null}
          </>
        ) : (
          <span className="text-muted-foreground">Survolez une semaine pour voir le détail.</span>
        )}
      </div>
      <div className="flex h-48 items-end gap-[2px]" onMouseLeave={() => setHover(null)}>
        {y.weeks.map((w) => {
          const k = kindOf(w.periodType);
          const a = w.actual ?? 0;
          return (
            <button
              key={w.from}
              type="button"
              aria-label={`Semaine du ${w.label}`}
              onMouseEnter={() => setHover(w)}
              onFocus={() => setHover(w)}
              className="group relative flex h-full min-w-0 flex-1 flex-col justify-end"
            >
              <div className="flex flex-col-reverse overflow-hidden rounded-t-[4px]" style={{ height: `${((a + w.expected) / max) * 100}%` }}>
                <div className="bg-primary transition-[height] duration-500 motion-reduce:transition-none" style={{ height: `${a + w.expected > 0 ? (a / (a + w.expected)) * 100 : 0}%` }} />
                <div className="flex-1 bg-primary/30" />
              </div>
              <div className="mt-[2px] h-1 rounded-sm" style={{ background: k?.color ?? "transparent" }} />
              <div className={cn("absolute inset-x-0 bottom-0 top-0 rounded-sm transition-colors duration-150", hover === w ? "bg-foreground/5" : "group-hover:bg-foreground/5", w.current && "ring-1 ring-foreground/40")} />
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex gap-[2px] text-[10px] text-muted-foreground">
        {y.months.map((m) => {
          const weeks = y.weeks.filter((w) => w.from.slice(0, 7) === m.key).length;
          const ok = m.rent ? m.rentPaid >= m.rent - 1 : null;
          return (
            <div key={m.key} className="min-w-0 border-l pl-1" style={{ flex: weeks || 1 }}>
              <div className="truncate capitalize">{m.label}</div>
              {m.rent ? (
                <div className={cn("truncate font-semibold", ok ? "text-emerald-700" : m.past ? "text-rose-700" : "text-muted-foreground")}>
                  loyer {ok ? "✓" : m.past ? "à payer" : "·"}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" />Réel</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary/30" />Prévu</span>
        {usedKinds.map((k) => (
          <span key={k.id} className="inline-flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-sm" style={{ background: k.color }} />{k.label}</span>
        ))}
      </div>
    </div>
  );
}

function UnusualCard({ u }: { u: UnusualDays }) {
  const qc = useQueryClient();
  const paged = usePaged(u.days, 20);
  const answer = useMutation({
    mutationFn: (v: { day: string; reason: string }) => analyticsApi.answerUnusualDay(v),
    onSuccess: () => {
      toast.success("Merci, c’est noté");
      qc.invalidateQueries({ queryKey: ["unusual-days"] });
      qc.invalidateQueries({ queryKey: ["school-year"] });
      qc.invalidateQueries({ queryKey: ["performance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card className="shadow-none">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">
            Jours inhabituels {u.toAnswer ? <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{u.toAnswer} à expliquer</span> : null}
          </h2>
          <InfoButton title="Comment un jour est signalé">
            <p>Un jour est signalé quand il fait <b>au moins +{u.rules.up} %</b> ou <b>{u.rules.down} %</b> par rapport à un jour normal du même jour de semaine, et au moins {u.rules.minAbs} DT d’écart.</p>
            <p>Jour normal = moyenne des mêmes jours de semaine des 4 semaines d’avant (les plus récents comptent plus), sans les jours du calendrier.</p>
            <p>Les jours fermés et les jours déjà dans le calendrier (examens, fériés…) ne sont pas signalés.</p>
            <p><b>Changement durable</b> : 3 jours inhabituels de suite dans le même sens. Ce n’est plus un pic, c’est le nouveau niveau.</p>
            <p>Votre réponse « examens », « vacances » ou « événement » entre dans le calendrier : la prévision apprend l’effet pour la prochaine fois.</p>
          </InfoButton>
        </div>
        {u.lasting.map((l) => (
          <div key={l.from} className="rounded-xl bg-sky-50 px-4 py-2.5 text-sm text-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
            <b>Changement durable</b> : {l.days} jours {l.direction === "up" ? "au-dessus" : "en dessous"} de la normale, du{" "}
            {format(new Date(`${l.from}T12:00:00`), "d MMM", { locale: fr })} au {format(new Date(`${l.to}T12:00:00`), "d MMM", { locale: fr })}.
          </div>
        ))}
        {u.days.length ? (
          <div className="text-sm">
            {paged.pageItems.map((d) => (
              <div key={d.key} className="flex flex-col gap-2 border-b py-3 last:border-0 animate-in fade-in-0 duration-200 motion-reduce:animate-none">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium capitalize">{d.label}</span>
                  <span className={cn("font-semibold tabular-nums", d.direction === "up" ? "text-emerald-700" : "text-rose-700")}>
                    {dt(d.actual)} au lieu de ≈ {dt(d.expected)} ({d.changePct > 0 ? "+" : ""}{d.changePct} %)
                  </span>
                </div>
                {d.answer ? (
                  <span className="self-start rounded-full bg-muted px-2.5 py-1 text-xs">Raison : {d.answer.label}</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {u.reasons.map((r) => (
                      <button
                        key={r.code}
                        type="button"
                        disabled={answer.isPending}
                        onClick={() => answer.mutate({ day: d.key, reason: r.code })}
                        className="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-200 hover:border-primary hover:bg-primary/5"
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <ListPager page={paged.page} lastPage={paged.lastPage} total={paged.total} onPage={paged.setPage} className="px-0" />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Aucun jour inhabituel ces 60 derniers jours.</p>
        )}
      </CardContent>
    </Card>
  );
}

/** Finance › Année: the school year as one curve. Exams, holidays and summer move the business; months pay the rent. */
export function FinanceYearTab() {
  const y = useQuery({ queryKey: ["school-year"], queryFn: () => analyticsApi.schoolYear() });
  const u = useQuery({ queryKey: ["unusual-days"], queryFn: () => analyticsApi.unusualDays() });
  if (y.isLoading) return <Skeleton className="h-96 rounded-xl" />;
  if (!y.data) return <p className="text-sm text-destructive">Année indisponible : {y.error?.message}</p>;
  const d = y.data;
  const who = d.who;
  const whoTotal = Math.max(1, who.total);
  const share = (n: number) => Math.round((n / whoTotal) * 100);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="shadow-none">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Réserve d’été</span>
              <InfoButton title="La réserve d’été">
                <p>En juillet et août, peu d’élèves et d’étudiants viennent, mais le loyer reste à payer.</p>
                <InfoCalc>
                  But = 2 mois de loyer = {d.summer.goal != null ? dt(d.summer.goal) : "?"}
                  <br />
                  {d.summer.weeksLeft} semaines avant le 1er juillet → {d.summer.perWeek != null ? dt(d.summer.perWeek) : "?"} à mettre de côté par semaine
                </InfoCalc>
                <p>Des formations l’été baissent ce besoin : chaque formation payée compte dans juillet / août.</p>
                {d.summer.rentPerMonth == null ? <p>Le loyer n’est pas encore une charge mensuelle : ajoutez-le dans Dépenses → « Charge mensuelle ».</p> : null}
              </InfoButton>
            </div>
            <div className="text-2xl font-bold tabular-nums">{d.summer.perWeek != null ? `${dt(d.summer.perWeek)} / sem.` : "—"}</div>
            <div className="text-xs text-muted-foreground">
              {d.summer.goal != null ? `pour ${dt(d.summer.goal)} au 1er juillet · ${d.summer.weeksLeft} semaines` : "ajoutez le loyer comme charge mensuelle"}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Semaine normale</span>
              <InfoButton title="Qu’est-ce qu’une semaine normale">
                <p>Une semaine sans examens, vacances ni férié : la somme d’un jour normal pour chaque jour de semaine.</p>
                <p>Jour normal = moyenne du mois dernier pour ce jour de semaine, les derniers jours comptant jusqu’à 3 fois plus que les premiers.</p>
                <InfoCalc>
                  Aujourd’hui : {dt(d.normalWeek.now)} par semaine
                  {d.normalWeek.first != null ? (
                    <>
                      <br />
                      Première semaine normale de l’année ({format(new Date(`${d.normalWeek.firstFrom}T12:00:00`), "d MMM", { locale: fr })}) : {dt(d.normalWeek.first)}
                    </>
                  ) : null}
                </InfoCalc>
              </InfoButton>
            </div>
            <div className="text-2xl font-bold tabular-nums">{dt(d.normalWeek.now)}</div>
            <div className="text-xs text-muted-foreground">
              {d.normalWeek.first != null ? `début d’année : ${dt(d.normalWeek.first)}` : "passes + café, sans période spéciale"}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Année {d.label}</span>
              <InfoButton title="La courbe de l’année">
                <p>Chaque barre est une semaine. Le foncé est encaissé (passes, café, abonnements, événements), le clair est prévu.</p>
                <InfoCalc>Semaine prévue = semaine normale × effet de sa période</InfoCalc>
                <p>L’effet d’une période (examens, vacances, férié) est mesuré la dernière fois qu’elle a eu lieu. Jamais vue : effet 0 %, à confirmer.</p>
                <p>Les mois servent seulement au loyer : ✓ quand il est payé pour ce mois.</p>
              </InfoButton>
            </div>
            <div className="text-2xl font-bold tabular-nums">{dt(d.year.done)}</div>
            <ProgressBar value={d.year.done} max={d.year.total} label="Année encaissée" />
            <div className="text-xs text-muted-foreground">sur ≈ {dt(d.year.total)} prévus de septembre à août</div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-none">
        <CardContent className="p-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Septembre → août, semaine par semaine</h2>
            <Link href="/conseiller" className="text-sm font-medium text-primary hover:underline">Dates d’examens manquantes ? Conseil IA → Contexte</Link>
          </div>
          <YearChart y={d} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-none">
          <CardContent className="space-y-2 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Ce que le calendrier fait</h2>
              <InfoButton title="L’effet d’une période">
                <p>Passes + café pendant la période ÷ les mêmes jours de semaine normaux autour (jusqu’à 4, à moins de 5 semaines).</p>
                <InfoCalc>Révisions : 190 DT un samedi au lieu de 120 → effet +58 %</InfoCalc>
                <p>La veille et le lendemain sont mesurés à part.</p>
              </InfoButton>
            </div>
            {d.effects.length ? (
              d.effects.map((e) => (
                <div key={e.type} className="flex items-center justify-between gap-2 border-b py-2 text-sm last:border-0">
                  <span className="min-w-0 truncate">{e.label}</span>
                  <span className={cn("shrink-0 font-semibold tabular-nums", e.factor >= 1 ? "text-emerald-700" : "text-rose-700")}>
                    {pct(e.factor)} <span className="text-xs font-normal text-muted-foreground">· {e.days} j mesurés</span>
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Pas encore d’effet mesuré : ajoutez vos périodes dans Conseil IA → Contexte.</p>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="space-y-3 p-5">
            <h2 className="text-base font-semibold">Qui vient · 30 derniers jours</h2>
            <div className="flex h-3 gap-[2px] overflow-hidden rounded-full bg-muted">
              {(
                [
                  ["PUPIL", "#d97706"],
                  ["STUDENT", "#0284c7"],
                  ["PRO", "#7c3aed"],
                ] as const
              ).map(([k, c]) => (
                <div key={k} className="h-full transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${share(who[k])}%`, background: c }} />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              {(
                [
                  ["PUPIL", "Lycée", "#d97706"],
                  ["STUDENT", "Université", "#0284c7"],
                  ["PRO", "Pros", "#7c3aed"],
                  ["UNKNOWN", "Pas renseigné", "transparent"],
                ] as const
              ).map(([k, l, c]) => (
                <div key={k}>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-sm border" style={{ background: c }} />
                    {l}
                  </div>
                  <div className="font-semibold tabular-nums">{who[k]} · {share(who[k])} %</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{who.total} membres venus. Le profil se remplit dans la fiche membre ou l’app visiteur.</p>
          </CardContent>
        </Card>
      </div>

      {u.data ? <UnusualCard u={u.data} /> : <Skeleton className="h-40 rounded-xl" />}
    </div>
  );
}
