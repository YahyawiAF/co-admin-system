"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ClipboardPaste,
  Copy,
  HelpCircle,
  Loader2,
  Plus,
  Settings2,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { advisorApi, outreachApi } from "@/lib/api/resources";
import { AdvisorContextPanel } from "@/components/admin/advisor/AdvisorContextPanel";
import { AdviceCard } from "@/components/admin/advisor/AdviceCard";
import { DonePanel, type DoneDraft } from "@/components/admin/advisor/DonePanel";
import { FollowUpCard } from "@/components/admin/advisor/FollowUpCard";
import {
  CATEGORY_UI,
  copyText as copyRaw,
  gainAmount,
  signed,
} from "@/components/admin/advisor/advice-ui";
import { CampaignDialog, type CampaignDraft } from "@/components/admin/OutreachCampaigns";
import type {
  AdvisorCategory,
  AdvisorDataIssue,
  AdvisorResult,
  BusinessInitiative,
  CampaignSegment,
} from "@/lib/types";

const PERIODS = [14, 30, 60, 90];

async function copyText(text: string) {
  await copyRaw(text);
  toast.success("Copié dans le presse-papiers");
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors duration-200",
        active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function ContextCard({ value }: { value: string }) {
  const qc = useQueryClient();
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const save = useMutation({
    mutationFn: () => advisorApi.saveSettings({ businessContext: text }),
    onSuccess: () => {
      toast.success("Contexte enregistré");
      qc.invalidateQueries({ queryKey: ["advisor", "settings"] });
      qc.invalidateQueries({ queryKey: ["advisor", "missing"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card className="shadow-none" id="advisor-context">
      <CardContent className="space-y-2 p-4">
        <div>
          <div className="font-medium">Votre contexte</div>
          <p className="text-sm text-muted-foreground">
            Ce que l&apos;IA ne peut pas voir dans les chiffres : quartier, type de clients,
            concurrents et leurs prix, vos objectifs, ce que vous avez déjà essayé.
          </p>
        </div>
        <Textarea
          rows={4}
          value={text}
          maxLength={4000}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ex. : près de la fac, surtout des étudiants et des freelances. Un café à côté vend l'expresso 2,5 DT. Objectif : remplir les après-midis."
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            disabled={save.isPending || text === value}
            onClick={() => save.mutate()}
          >
            Enregistrer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Without an API key: copy the exact prompt, paste it into claude.ai, paste the JSON back. */
function ManualCard({ days, onImported }: { days: number; onImported: (id: string) => void }) {
  const qc = useQueryClient();
  const [view, setView] = useState<"chat" | "system" | "user" | "schema" | null>(null);
  const [answer, setAnswer] = useState("");
  const prompt = useQuery({
    queryKey: ["advisor", "prompt", days],
    queryFn: () => advisorApi.prompt(days),
    enabled: false,
  });
  const load = async () => (await prompt.refetch()).data;
  const importReport = useMutation({
    mutationFn: () => advisorApi.importReport(days, answer),
    onSuccess: (r) => {
      toast.success("Rapport enregistré");
      setAnswer("");
      qc.invalidateQueries({ queryKey: ["advisor", "reports"] });
      onImported(r.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const parts = prompt.data
    ? {
        chat: prompt.data.chat,
        system: prompt.data.system,
        user: prompt.data.user,
        schema: JSON.stringify(prompt.data.schema, null, 2),
      }
    : null;
  return (
    <Card className="shadow-none">
      <CardContent className="space-y-3 p-4">
        <div>
          <div className="font-medium">Sans clé API : copier-coller dans Claude</div>
          <p className="text-sm text-muted-foreground">
            1. Copiez le prompt ({days} jours) — ce sont exactement les instructions et les chiffres
            envoyés à l&apos;API. 2. Collez-le sur claude.ai (modèle Opus, réflexion étendue
            activée). 3. Collez la réponse JSON ci-dessous pour l&apos;afficher ici.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={prompt.isFetching}
            onClick={async () => {
              const d = await load();
              if (d) await copyText(d.chat);
            }}
          >
            {prompt.isFetching ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Copy className="mr-1.5 h-4 w-4" />
            )}
            Copier le prompt complet
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={prompt.isFetching}
            onClick={async () => {
              if (!parts) await load();
              setView(view ? null : "chat");
            }}
          >
            {view ? "Masquer" : "Voir les données"}
          </Button>
        </div>
        {view && parts ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ["chat", "Tout (chat)"],
                  ["system", "Prompt système"],
                  ["user", "Données (message)"],
                  ["schema", "Schéma JSON"],
                ] as const
              ).map(([k, label]) => (
                <FilterChip key={k} active={view === k} onClick={() => setView(k)}>
                  {label}
                </FilterChip>
              ))}
              <Button size="sm" variant="ghost" onClick={() => copyText(parts[view])}>
                <Copy className="mr-1.5 h-4 w-4" />
                Copier
              </Button>
              <span className="text-xs text-muted-foreground">
                {parts[view].length.toLocaleString("fr-FR")} caractères
              </span>
            </div>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-md border bg-muted/40 p-3 text-xs">
              {view === "user" ? JSON.stringify(prompt.data!.snapshot, null, 2) : parts[view]}
            </pre>
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="advisor-answer">Réponse de Claude (JSON)</Label>
          <Textarea
            id="advisor-answer"
            rows={4}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder='{"summary": "…", "highlights": […], "recommendations": […], …}'
            className="font-mono text-xs"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              disabled={!answer.trim() || importReport.isPending}
              onClick={() => importReport.mutate()}
            >
              <ClipboardPaste className="mr-1.5 h-4 w-4" />
              Enregistrer la réponse
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


/** Data problems that would make the advice wrong: shown before anything else. */
function DataCheck({ issues }: { issues: AdvisorDataIssue[] }) {
  const [open, setOpen] = useState(false);
  if (!issues.length) return null;
  const blocked = [...new Set(issues.flatMap((i) => i.blocks))].map((c) => CATEGORY_UI[c]?.label.toLowerCase() ?? c);
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3" aria-label="Contrôle des données">
      <div className="flex flex-wrap items-center gap-3">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
        <p className="min-w-[12rem] flex-1 text-sm">
          <b className="text-amber-800">
            {issues.length} problème{issues.length > 1 ? "s" : ""} dans vos données.
          </b>{" "}
          {blocked.length
            ? `Les conseils ${blocked.join(", ")} sont en pause tant que ce n'est pas corrigé.`
            : "Les conseils qui s'appuient sur ces chiffres peuvent être faux."}
        </p>
        <Button size="sm" variant="outline" className="bg-background" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? "Masquer" : "Voir"}
        </Button>
      </div>
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
        aria-hidden={!open}
      >
        <div className="min-h-0 overflow-hidden">
          <ul className="grid gap-2.5 pt-3 sm:grid-cols-2 xl:grid-cols-4">
            {issues.map((i) => (
              <li key={i.key} className="flex flex-col gap-1 rounded-lg border bg-card p-3">
                <span
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-wide",
                    i.severity === "blocking" ? "text-rose-700" : "text-amber-700",
                  )}
                >
                  {i.severity === "blocking" ? "Bloquant" : "À vérifier"}
                </span>
                <span className="font-semibold">{i.title}</span>
                <span className="text-sm text-muted-foreground">{i.detail}</span>
                <Link href={i.fixHref} className="mt-auto pt-1 text-sm font-medium text-primary hover:underline">
                  {i.fixLabel} →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("text-2xl font-bold tabular-nums tracking-tight", tone)}>{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function FilterChips({
  result,
  filter,
  onChange,
}: {
  result: AdvisorResult;
  filter: AdvisorCategory | "ALL";
  onChange: (f: AdvisorCategory | "ALL") => void;
}) {
  const counts: Partial<Record<AdvisorCategory, number>> = {};
  for (const r of result.recommendations) counts[r.category] = (counts[r.category] ?? 0) + 1;
  if (Object.keys(counts).length < 2) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      <FilterChip active={filter === "ALL"} onClick={() => onChange("ALL")}>
        Tous · {result.recommendations.length}
      </FilterChip>
      {(Object.keys(CATEGORY_UI) as AdvisorCategory[]).map((c) =>
        counts[c] ? (
          <FilterChip key={c} active={filter === c} onClick={() => onChange(c)}>
            {CATEGORY_UI[c].label} · {counts[c]}
          </FilterChip>
        ) : null,
      )}
    </div>
  );
}

function Highlights({ result }: { result: AdvisorResult }) {
  return (
    <div className="space-y-2">
      <p className="text-sm leading-relaxed">{result.summary}</p>
      {result.highlights.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {result.highlights.map((h, i) => {
            const Icon = h.trend === "up" ? ArrowUpRight : h.trend === "down" ? ArrowDownRight : ArrowRight;
            return (
              <li key={i} title={h.detail} className="flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-0.5 text-xs">
                <Icon
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    h.trend === "up" ? "text-emerald-600" : h.trend === "down" ? "text-rose-600" : "text-muted-foreground",
                  )}
                />
                {h.title}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export default function ConseillerPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const [days, setDays] = useState(30);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<AdvisorCategory | "ALL">("ALL");
  const [actionsTab, setActionsTab] = useState<"test" | "done">("test");
  const [contextOpen, setContextOpen] = useState(false);
  const [doneDraft, setDoneDraft] = useState<DoneDraft | null>(null);
  const [relanceDraft, setRelanceDraft] = useState<CampaignDraft | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  const settings = useQuery({ queryKey: ["advisor", "settings"], queryFn: advisorApi.settings });
  const dataCheck = useQuery({ queryKey: ["advisor", "data-check"], queryFn: advisorApi.dataCheck });
  const segments = useQuery({ queryKey: ["outreach-segments", null], queryFn: () => outreachApi.segments(null) });
  const reports = useQuery({
    queryKey: ["advisor", "reports"],
    queryFn: advisorApi.reports,
    refetchInterval: (q) => (q.state.data?.some((r) => r.status === "PENDING") ? 4000 : false),
  });
  const initiatives = useQuery({ queryKey: ["advisor", "initiatives"], queryFn: advisorApi.initiatives });

  const list = reports.data ?? [];
  const done = list.filter((r) => r.status === "DONE");
  const pending = list.find((r) => r.status === "PENDING");
  const latestDone = done[0];
  const latestFailed = list[0]?.status === "FAILED" ? list[0] : null;
  const shownId = selectedId ?? latestDone?.id ?? null;

  // A finished report brings new AI questions into the checklist
  useEffect(() => {
    if (!latestDone?.id) return;
    qc.invalidateQueries({ queryKey: ["advisor", "questions"] });
    qc.invalidateQueries({ queryKey: ["advisor", "missing"] });
  }, [latestDone?.id, qc]);

  const report = useQuery({
    queryKey: ["advisor", "report", shownId],
    queryFn: () => advisorApi.report(shownId!),
    enabled: !!shownId,
    staleTime: Infinity,
  });
  const result = report.data?.result ?? null;

  const generate = useMutation({
    mutationFn: () => advisorApi.generate(days),
    onSuccess: () => {
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["advisor", "reports"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const enabled = settings.data?.enabled ?? false;
  const issues = dataCheck.data ?? [];
  const blockedLabel = (c: AdvisorCategory) => {
    const issue = issues.find((i) => i.blocks.includes(c));
    return issue ? `${issue.title} : à corriger d'abord` : undefined;
  };
  const reviews = new Map((result?.initiativeReviews ?? []).map((r) => [r.initiativeId, r]));
  const actions = useMemo(
    () => [...(initiatives.data ?? [])].sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [initiatives.data],
  );
  const testing = actions.filter((a) => !a.finished);
  const finished = actions.filter((a) => a.finished);
  const shownActions = actionsTab === "test" ? testing : finished;

  const judged = finished.filter((a) => a.result && a.result.status !== "too_early");
  const netGain = judged.reduce((s, a) => s + (a.result?.netGain ?? 0), 0);
  const working = judged.filter(
    (a) => a.ownerVerdict === "WORKING" || a.result?.status === "goal_reached" || a.result?.status === "up",
  ).length;
  const possible = (result?.recommendations ?? []).reduce((s, r) => s + gainAmount(r.expectedImpact), 0);
  const recs = (result?.recommendations ?? []).filter((r) => filter === "ALL" || r.category === filter);

  // Jump to an action card and briefly highlight it
  useEffect(() => {
    if (!focusId) return;
    const t = setTimeout(() => {
      document.getElementById(`action-${focusId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    const clear = setTimeout(() => setFocusId(null), 2200);
    return () => {
      clearTimeout(t);
      clearTimeout(clear);
    };
  }, [focusId, actionsTab]);

  const openAction = (a: BusinessInitiative) => {
    setActionsTab(a.finished ? "done" : "test");
    setFocusId(a.id);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Sparkles className="h-6 w-6 text-primary" />
            Conseiller IA
          </h1>
          <p className="text-sm text-muted-foreground">
            Une idée → vous la faites → l&apos;app mesure ce qu&apos;elle rapporte vraiment.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {report.data ? (
            <span className="text-xs text-muted-foreground">
              Analyse du {format(new Date(report.data.createdAt), "d MMM", { locale: fr })} (
              {formatDistanceToNow(new Date(report.data.createdAt), { locale: fr, addSuffix: true })})
            </span>
          ) : null}
          {done.length > 1 ? (
            <select
              aria-label="Analyse affichée"
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={shownId ?? ""}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {done.map((r) => (
                <option key={r.id} value={r.id}>
                  {format(new Date(r.createdAt), "d MMM HH:mm", { locale: fr })}
                  {r.trigger === "WEEKLY" ? " (hebdo)" : r.trigger === "IMPORT" ? " (collé)" : ""}
                </option>
              ))}
            </select>
          ) : null}
          <Button variant="outline" onClick={() => setContextOpen(true)}>
            <Settings2 className="mr-1.5 h-4 w-4" />
            Mon contexte
          </Button>
          <select
            aria-label="Période analysée"
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {PERIODS.map((p) => (
              <option key={p} value={p}>
                {p} jours
              </option>
            ))}
          </select>
          <Button disabled={!enabled || !!pending || generate.isPending} onClick={() => generate.mutate()}>
            {pending || generate.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-4 w-4" />
            )}
            {pending ? "Analyse…" : "Analyser"}
          </Button>
        </div>
      </div>

      {settings.data && !enabled ? (
        <Alert>
          <AlertTitle>IA non configurée</AlertTitle>
          <AlertDescription>
            Ajoutez <code>ANTHROPIC_API_KEY</code> dans <code>backend/.env</code>, ou utilisez le copier-coller dans
            « Mon contexte ».
          </AlertDescription>
        </Alert>
      ) : null}
      {pending ? (
        <Alert className="advisor-in">
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertTitle>L&apos;IA relit vos chiffres et vos notes</AlertTitle>
          <AlertDescription>Une à deux minutes. Vous pouvez quitter la page.</AlertDescription>
        </Alert>
      ) : null}
      {latestFailed && !pending ? (
        <Alert variant="destructive" className="advisor-in">
          <AlertTitle>La dernière analyse a échoué</AlertTitle>
          <AlertDescription>
            {/credit balance/i.test(latestFailed.error ?? "")
              ? "Crédit Anthropic épuisé : rechargez le compte (Plans & Billing), ou utilisez le copier-coller dans « Mon contexte »."
              : latestFailed.error}
          </AlertDescription>
        </Alert>
      ) : null}

      <DataCheck issues={issues} />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Résumé">
        <Kpi
          label="Gain net mesuré"
          value={judged.length ? signed(Math.round(netGain), " DT") : "—"}
          sub="actions terminées, coûts déduits"
          tone={netGain > 0 ? "text-emerald-700" : netGain < 0 ? "text-rose-700" : undefined}
        />
        <Kpi label="Actions qui marchent" value={judged.length ? `${working} / ${judged.length}` : "—"} sub="parmi les actions terminées" />
        <Kpi label="En test" value={String(testing.length)} sub="mesure en cours" />
        <Kpi
          label="Gain possible"
          value={possible ? `+${Math.round(possible)} DT` : "—"}
          sub="si vous appliquez les conseils"
        />
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section className="flex min-w-0 flex-col gap-3" aria-label="Conseils">
          <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">
              Conseils de la semaine{" "}
              {result ? <span className="font-normal text-muted-foreground">· {result.recommendations.length}</span> : null}
            </h2>
            {result ? <FilterChips result={result} filter={filter} onChange={setFilter} /> : null}
          </div>
          {reports.isLoading || report.isLoading ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : result ? (
            <>
              <Highlights result={result} />
              <ul className="flex flex-col gap-2.5">
                {recs.map((r, i) => {
                  const tracked = actions.find((a) => a.recommendationTitle === r.title || a.title === r.title);
                  const seg =
                    r.outreach && r.outreach.segment !== "NONE" ? (r.outreach.segment as CampaignSegment) : undefined;
                  return (
                    <AdviceCard
                      key={`${filter}-${r.title}-${i}`}
                      rec={r}
                      index={i}
                      tracked={tracked}
                      blockedBy={blockedLabel(r.category)}
                      segmentCounts={segments.data}
                      onOpenTracked={() => tracked && openAction(tracked)}
                      onDone={() =>
                        setDoneDraft({
                          title: r.title,
                          hint: r.actions[0],
                          steps: r.actions,
                          category: r.category,
                          metric: r.metric,
                          targetPct: r.targetPct,
                          target: r.target,
                          segment: seg,
                          sourceReportId: report.data!.id,
                          recommendationTitle: r.title,
                        })
                      }
                      onRelance={() =>
                        setRelanceDraft({
                          title: r.title,
                          message: r.outreach?.message ?? "",
                          segment: seg,
                          sourceReportId: report.data!.id,
                          recommendationTitle: r.title,
                          category: r.category,
                          trackAsInitiative: true,
                        })
                      }
                    />
                  );
                })}
              </ul>
              {result.questions.length ? (
                <div className="flex flex-wrap items-start gap-3 rounded-xl border border-dashed p-3 text-sm">
                  <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">
                      {result.questions.length} question{result.questions.length > 1 ? "s" : ""} pour des conseils plus
                      précis :
                    </span>{" "}
                    <span className="text-muted-foreground">{result.questions.join(" · ")}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setContextOpen(true)}>
                    Répondre
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Pas encore d&apos;analyse. Cliquez sur « Analyser » pour vos premiers conseils.
            </div>
          )}
        </section>

        <section className="flex min-w-0 flex-col gap-3" aria-label="Mes actions">
          <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Mes actions</h2>
            <div className="flex items-center gap-2">
              <div role="tablist" className="inline-flex rounded-lg bg-muted p-0.5 text-sm">
                {(
                  [
                    ["test", `En test · ${testing.length}`],
                    ["done", `Terminées · ${finished.length}`],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={actionsTab === k}
                    onClick={() => setActionsTab(k)}
                    className={cn(
                      "rounded-md px-3 py-1 font-medium transition-[background-color,color,box-shadow] duration-200",
                      actionsTab === k
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                title="Suivre une autre action"
                onClick={() => setDoneDraft({ title: "", category: "NEW_REVENUE" })}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {initiatives.isLoading ? (
            <Skeleton className="h-48 rounded-xl" />
          ) : shownActions.length ? (
            <ul key={actionsTab} className="flex flex-col gap-2.5">
              {shownActions.map((a, i) => (
                <FollowUpCard key={a.id} item={a} index={i} review={reviews.get(a.id)} highlight={focusId === a.id} />
              ))}
            </ul>
          ) : (
            <div key={actionsTab} className="advisor-in rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              {actionsTab === "test"
                ? "Rien en test. Sur un conseil, cliquez « Je l'ai fait » : l'app mesurera ce qu'il rapporte."
                : "Aucune action terminée. Une action est terminée quand vous l'arrêtez ou après 28 jours de mesure."}
            </div>
          )}
        </section>
      </div>

      <Sheet open={contextOpen} onOpenChange={setContextOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader className="text-left">
            <SheetTitle>Mon contexte</SheetTitle>
            <SheetDescription>
              Ce que l&apos;IA ne voit pas dans les chiffres. Plus c&apos;est précis, plus les conseils collent à votre
              espace.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <AdvisorContextPanel />
            <ContextCard value={settings.data?.businessContext ?? ""} />
            <ManualCard
              days={days}
              onImported={(id) => {
                setSelectedId(id);
                setContextOpen(false);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      <DonePanel
        draft={doneDraft}
        onClose={() => setDoneDraft(null)}
        onSaved={(id) => {
          setActionsTab("test");
          setFocusId(id);
        }}
      />
      <CampaignDialog
        draft={relanceDraft}
        onClose={() => setRelanceDraft(null)}
        onCreated={() => router.push("/relances")}
      />
    </div>
  );
}
