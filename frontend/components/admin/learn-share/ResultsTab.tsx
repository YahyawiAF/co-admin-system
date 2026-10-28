"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { CheckCircle2, Lightbulb, MousePointerClick, PencilLine, Percent, Plus, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { surveysApi } from "@/lib/api/resources";
import { cn } from "@/lib/utils";
import { plural, pct, TYPE_LABEL, type RespondentType, type SurveyDashboard, type SurveyDetail, type SurveyFilters } from "@/lib/surveys";
import { Bar, selectClass, SourceTag } from "./shared";

type Period = "all" | "today" | "7d" | "30d";

function periodRange(p: Period): Pick<SurveyFilters, "from" | "to"> {
  const today = format(new Date(), "yyyy-MM-dd");
  if (p === "today") return { from: today };
  if (p === "7d") return { from: format(subDays(new Date(), 6), "yyyy-MM-dd") };
  if (p === "30d") return { from: format(subDays(new Date(), 29), "yyyy-MM-dd") };
  return {};
}

export function ResultsTab({
  survey,
  onCreateSession,
}: {
  survey: SurveyDetail;
  onCreateSession: (subject: { value: string; label: string }) => void;
}) {
  const [linkId, setLinkId] = useState("");
  const [source, setSource] = useState("");
  const [period, setPeriod] = useState<Period>("all");
  const [type, setType] = useState<RespondentType | "">("");
  const filters: SurveyFilters = useMemo(
    () => ({ ...(linkId && { linkId }), ...(source && { source }), ...(type && { type }), ...periodRange(period) }),
    [linkId, source, type, period]
  );
  const filtered = !!(linkId || source || type || period !== "all");

  const { data, isLoading } = useQuery({
    queryKey: ["survey-dashboard", survey.id, filters],
    queryFn: () => surveysApi.dashboard(survey.id, filters),
    placeholderData: (prev) => prev,
  });
  const sources = useMemo(() => {
    const s = new Set<string>(survey.links.map((l) => l.source).filter(Boolean) as string[]);
    data?.campaigns.forEach((c) => s.add(c.source));
    return [...s].sort();
  }, [survey.links, data?.campaigns]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Filter label="Lien">
          <select id="f-link" className={cn(selectClass, "min-w-44")} value={linkId} onChange={(e) => setLinkId(e.target.value)}>
            <option value="">Tous les liens</option>
            {survey.links.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label || l.code}
              </option>
            ))}
          </select>
        </Filter>
        <Filter label="Source">
          <select id="f-source" className={cn(selectClass, "min-w-36")} value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">Toutes</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Filter>
        <Filter label="Période">
          <select id="f-period" className={cn(selectClass, "min-w-40")} value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
            <option value="all">Depuis le début</option>
            <option value="30d">30 derniers jours</option>
            <option value="7d">7 derniers jours</option>
            <option value="today">Aujourd’hui</option>
          </select>
        </Filter>
        <Filter label="Répondant">
          <select id="f-type" className={cn(selectClass, "min-w-36")} value={type} onChange={(e) => setType(e.target.value as RespondentType | "")}>
            <option value="">Tous</option>
            {(Object.keys(TYPE_LABEL) as RespondentType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </Filter>
        {filtered ? (
          <Button
            variant="ghost"
            size="sm"
            className="ls-enter"
            onClick={() => {
              setLinkId("");
              setSource("");
              setType("");
              setPeriod("all");
            }}
          >
            <X className="h-4 w-4" /> Effacer les filtres
          </Button>
        ) : null}
      </div>

      {isLoading || !data ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <Results data={data} typeFiltered={!!type} onCreateSession={onCreateSession} />
      )}
    </div>
  );
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {label}
      <span className="normal-case tracking-normal">{children}</span>
    </label>
  );
}

function Kpi({ icon: Icon, label, value, hint, accent, dim }: { icon: typeof Users; label: string; value: string; hint: string; accent?: boolean; dim?: boolean }) {
  return (
    <Card className={cn("transition-opacity duration-200", accent && "border-primary/40", dim && "opacity-60")}>
      <CardContent className="p-4">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </p>
        <p className={cn("mt-1 text-[28px] font-bold tabular-nums tracking-tight", accent && "text-primary")}>{value}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function Results({
  data,
  typeFiltered,
  onCreateSession,
}: {
  data: SurveyDashboard;
  typeFiltered: boolean;
  onCreateSession: (subject: { value: string; label: string }) => void;
}) {
  const k = data.kpis;
  const maxSubject = Math.max(1, ...data.subjects.map((s) => Math.max(s.learners, s.volunteers)));
  const slotMax = Math.max(1, ...data.volunteerSlots.flatMap((d) => d.times.map((t) => t.count)));
  let best: { day: string; time: string; count: number } | null = null;
  for (const d of data.volunteerSlots) for (const t of d.times) if (t.count && (!best || t.count > best.count)) best = { day: d.label, time: t.label, count: t.count };
  const rolesTotal = data.roles.LEARN + data.roles.SHARE + data.roles.BOTH;
  const intentTotal = data.attend.reduce((a, x) => a + x.count, 0);
  const f = data.funnel;
  const bestCampaign = [...data.campaigns]
    .filter((c) => c.visitors >= 10 && c.source !== data.directSource)
    .sort((a, b) => b.responses / b.visitors - a.responses / a.visitors)[0];

  return (
    <div className="ls-enter space-y-4">
      <div className="ls-stagger grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi icon={MousePointerClick} label="Clics" value={String(k.clicks)} hint="Ouvertures des liens suivis" dim={typeFiltered} />
        <Kpi icon={Users} label="Visiteurs uniques" value={String(k.visitors)} hint="Navigateurs distincts" dim={typeFiltered} />
        <Kpi icon={PencilLine} label="Commencés" value={String(k.started)} hint="Ont appuyé sur « Commencer »" dim={typeFiltered} />
        <Kpi icon={CheckCircle2} label="Réponses" value={String(k.responses)} hint="Sondages envoyés" accent />
        <Kpi
          icon={Percent}
          label="Taux de complétion"
          value={typeFiltered || k.completionRate == null ? "—" : `${k.completionRate} %`}
          hint={typeFiltered ? "Non calculé par type" : "Réponses ÷ commencés"}
        />
      </div>
      {typeFiltered ? (
        <p className="-mt-1 text-xs text-muted-foreground">Clics, visiteurs et commencés ne connaissent pas le type de répondant : ils restent tous types.</p>
      ) : null}
      {k.flagged ? (
        <p className="-mt-1 text-xs text-muted-foreground">
          {k.flagged} réponse{k.flagged > 1 ? "s" : ""} suspecte{k.flagged > 1 ? "s" : ""} (robot ou envoi trop rapide) mise{k.flagged > 1 ? "s" : ""} de côté.
        </p>
      ) : null}

      {k.responses === 0 ? (
        <Card>
          <CardContent className="space-y-1 p-8 text-center">
            <p className="font-semibold">Pas encore de réponse{typeFiltered || k.visitors ? " pour ces filtres" : ""}.</p>
            <p className="text-sm text-muted-foreground">Créez un lien dans l’onglet Liens et partagez-le en story, en bio ou dans un groupe WhatsApp.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <Card>
              <CardContent className="p-4">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-semibold">Sujets demandés</h2>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" />Veulent apprendre</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />Peuvent partager</span>
                  </div>
                </div>
                <div className="ls-stagger divide-y">
                  {data.subjects.filter((s) => s.learners || s.volunteers).map((s, i) => {
                    const tag =
                      s.learners > 0 && s.volunteers === 0
                        ? ["Aucun volontaire", "text-amber-700"]
                        : s.volunteers && s.learners / s.volunteers > 8
                          ? ["Peu de volontaires", "text-amber-700"]
                          : s.learners >= 5 && s.volunteers > 0
                            ? ["Prêt à lancer", "text-emerald-700"]
                            : null;
                    return (
                      <div key={s.value} style={{ ["--i" as string]: i }} className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-3 py-2.5 md:grid-cols-[20px_minmax(170px,240px)_minmax(0,1fr)_130px_auto]">
                        <span className="text-center text-xs font-semibold text-muted-foreground">{i + 1}</span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{s.label}</p>
                          {tag ? <p className={cn("text-[11px] font-medium", tag[1])}>{tag[0]}</p> : null}
                          {s.others?.length ? <p className="truncate text-[11px] text-muted-foreground" title={s.others.join(", ")}>{s.others.join(", ")}</p> : null}
                        </div>
                        <div className="col-span-3 space-y-1 md:col-span-1">
                          <Bar value={s.learners} max={maxSubject} />
                          <Bar value={s.volunteers} max={maxSubject} tone="bg-emerald-600" />
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          <b className="tabular-nums text-foreground">{s.learners}</b> {s.learners > 1 ? "apprenants" : "apprenant"}
                          {s.committed ? <> · <b className="tabular-nums text-foreground">{s.committed}</b> {s.committed > 1 ? "sûrs" : "sûr"}</> : null}
                          <br />
                          <b className="tabular-nums text-foreground">{s.volunteers}</b> {s.volunteers > 1 ? "volontaires" : "volontaire"}
                        </p>
                        <Button size="sm" variant="outline" onClick={() => onCreateSession(s)}>
                          <Plus className="h-4 w-4" /> Créer une séance
                        </Button>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Plusieurs sujets possibles par réponse. « Sûrs » = ont répondu « Oui, sûrement ». Les sujets que personne n’a choisis sont masqués.</p>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="font-semibold">Quand ils sont libres</h2>
                    <span className="text-xs text-muted-foreground">Tous les répondants</span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[data.days, data.times].map((rows, j) => {
                      const max = Math.max(1, ...rows.map((r) => r.count));
                      return (
                        <div key={j} className="space-y-2">
                          {rows.map((r) => (
                            <div key={r.value} className="grid grid-cols-[88px_minmax(0,1fr)_32px] items-center gap-2 text-sm">
                              <span className="truncate">{r.label}</span>
                              <Bar value={r.count} max={max} />
                              <b className="text-right tabular-nums">{r.count}</b>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <h2 className="font-semibold">Disponibilités des volontaires</h2>
                    {best ? <span className="text-xs text-muted-foreground">Meilleur : {best.day} {best.time.toLowerCase()}</span> : null}
                  </div>
                  {slotMax <= 1 && !best ? (
                    <p className="text-sm text-muted-foreground">Aucun volontaire n’a encore coché de créneau.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-separate border-spacing-1 text-center text-sm tabular-nums">
                        <thead>
                          <tr>
                            <th />
                            {data.volunteerSlots.map((d) => (
                              <th key={d.day} className="text-[11px] font-semibold text-muted-foreground">{d.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {data.volunteerSlots[0]?.times.map((t, ti) => (
                            <tr key={t.time}>
                              <th className="whitespace-nowrap pr-1 text-left text-[11px] font-semibold text-muted-foreground">{t.label}</th>
                              {data.volunteerSlots.map((d) => {
                                const c = d.times[ti].count;
                                const a = Math.round((c / slotMax) * 85) + 6;
                                return (
                                  <td
                                    key={d.day}
                                    className="h-9 rounded-md font-semibold transition-colors duration-300"
                                    style={{ background: `color-mix(in srgb, #059669 ${c ? a : 0}%, hsl(var(--muted)))`, color: a > 50 && c ? "white" : undefined }}
                                  >
                                    {c || ""}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-4 p-4">
                  <Split
                    title="Rôles"
                    hint={`${rolesTotal} réponses`}
                    parts={[
                      ["Apprendre", data.roles.LEARN, "bg-primary"],
                      ["Les deux", data.roles.BOTH, "bg-teal-500"],
                      ["Partager", data.roles.SHARE, "bg-emerald-600"],
                    ]}
                  />
                  <Split
                    title="Viendraient à une séance"
                    hint={intentTotal ? `${pct((data.attend[0]?.count ?? 0) + (data.attend[1]?.count ?? 0), intentTotal)} oui ou peut-être` : "apprenants"}
                    parts={data.attend.map((a, i) => [a.label, a.count, ["bg-primary", "bg-primary/50", "bg-muted-foreground/30"][i] ?? "bg-muted"])}
                  />
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Card className="min-w-0">
              <CardContent className="p-4">
                <div className="mb-3 flex items-baseline justify-between gap-2">
                  <h2 className="font-semibold">Campagnes</h2>
                  <span className="text-xs text-muted-foreground">Par source · medium</span>
                </div>
                <div className="-mx-4 overflow-x-auto px-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-3 font-semibold">Source · medium</th>
                        <th className="px-3 py-2 text-right font-semibold">Visiteurs</th>
                        <th className="px-3 py-2 text-right font-semibold">Commencés</th>
                        <th className="px-3 py-2 text-right font-semibold">Réponses</th>
                        <th className="px-3 py-2 text-right font-semibold">Complétion</th>
                        <th className="px-3 py-2 text-right font-semibold">Reliées</th>
                        <th className="px-3 py-2 text-right font-semibold">Inscrites</th>
                        <th className="px-3 py-2 text-right font-semibold">Venues</th>
                        <th className="py-2 pl-3 text-right font-semibold">Visites payées</th>
                      </tr>
                    </thead>
                    <tbody className="ls-stagger">
                      {data.campaigns.map((c, i) => (
                        <tr key={`${c.source}|${c.medium}`} style={{ ["--i" as string]: i }} className="border-t transition-colors hover:bg-muted/50">
                          <td className="py-2 pr-3">
                            <SourceTag source={c.source} medium={c.medium} />
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{c.visitors}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{c.started}</td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums">{c.responses}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{typeFiltered || c.completionRate == null ? "—" : `${c.completionRate} %`}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{c.linked}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{c.registered}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{c.attended}</td>
                          <td className="py-2 pl-3 text-right tabular-nums">{c.paidVisits}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Les colonnes Reliées → Visites payées ne comptent que les réponses reliées à une personne. Une réponse n’est jamais comptée comme client.
                </p>
                {bestCampaign && !typeFiltered ? (
                  <p className="mt-3 flex items-start gap-2 rounded-lg bg-primary/5 px-3 py-2 text-sm">
                    <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {bestCampaign.source}
                    {bestCampaign.medium ? ` · ${bestCampaign.medium}` : ""} convertit le mieux : {pct(bestCampaign.responses, bestCampaign.visitors)} des visiteurs répondent.
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <h2 className="font-semibold">Suivi des personnes reliées</h2>
                <p className="mb-4 mt-1 text-xs text-muted-foreground">
                  Client connecté, inscription à une séance ou association manuelle. Rien n’est deviné.
                </p>
                <div className="space-y-3">
                  {(
                    [
                      ["Réponses", f.responses, null],
                      ["Reliées à une personne", f.linked, pct(f.linked, f.responses) + " des réponses"],
                      ["Inscrites à une séance", f.registered, pct(f.registered, f.linked) + " des personnes reliées"],
                      ["Venues à la séance", f.attended, pct(f.attended, f.linked) + " des personnes reliées"],
                      ["Revenues au coworking", f.visited, pct(f.visited, f.linked) + " des personnes reliées"],
                      ["Visite payée", f.paid, pct(f.paid, f.linked) + " des personnes reliées"],
                      ["Abonnement", f.subscribed, pct(f.subscribed, f.linked) + " des personnes reliées"],
                    ] as const
                  ).map(([label, n, sub], i) => (
                    <div key={label} className="space-y-1">
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="font-medium">{label}</span>
                        <b className="tabular-nums">{n}</b>
                      </div>
                      <Bar value={n} max={Math.max(1, f.responses)} tone={i === 0 ? "bg-primary/30" : "bg-primary"} className="h-5 rounded-md" />
                      {sub ? <p className="text-[11px] text-muted-foreground">{sub}</p> : null}
                    </div>
                  ))}
                </div>
                {f.responses - f.linked > 0 ? (
                  <p className="mt-3 flex items-start gap-2 rounded-lg bg-primary/5 px-3 py-2 text-sm">
                    <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {plural(f.responses - f.linked, "réponse")} {f.responses - f.linked > 1 ? "ne sont reliées" : "n’est reliée"} à personne. Les « Connu » ont un WhatsApp : associez-les dans Réponses.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Split({ title, hint, parts }: { title: string; hint: string; parts: Array<readonly [string, number, string]> }) {
  const total = parts.reduce((a, p) => a + p[1], 0) || 1;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
      <div className="flex h-3.5 gap-0.5 overflow-hidden rounded-full">
        {parts.map(([label, n, tone]) => (
          <div key={label} title={`${label} : ${n}`} className={cn("ls-bar h-full", tone)} style={{ width: `${(n / total) * 100}%` }} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {parts.map(([label, n, tone]) => (
          <div key={label} className="text-xs text-muted-foreground">
            <span className={cn("mr-1 inline-block h-2 w-2 rounded-sm", tone)} />
            {label}
            <b className="block text-lg tabular-nums text-foreground">{n}</b>
          </div>
        ))}
      </div>
    </div>
  );
}
