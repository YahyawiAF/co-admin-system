"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Activity, ArrowRight, LineChart, Loader2, Settings2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { advisorApi, analyticsApi, dailyExpensesApi } from "@/lib/api/resources";
import { managerApi } from "@/lib/api/manager";
import { MONEY_KEY } from "@/components/admin/finance/MoneyQuestions";
import { BannerChip, CampaignDialog, type CampaignDraft } from "@/components/admin/OutreachCampaigns";
import { AreaDialog } from "@/components/admin/advisor/AreaDialog";
import { AdaptDialog, startPayload, startSolution, type AdaptTarget } from "@/components/admin/advisor/AdaptDialog";
import { ContextDialog } from "@/components/admin/advisor/ContextDialog";
import { DataCheck } from "@/components/admin/advisor/DataCheck";
import { LinkToolDialog, type LinkTarget } from "@/components/admin/advisor/LinkToolDialog";
import { AREA_ICON, STATUS_UI, dt, prepareHref, signedDt } from "@/components/admin/advisor/conseil-ui";
import type { BusinessInitiative, CampaignSegment, HealthArea, HealthAreaId, HealthSolution } from "@/lib/types";

const ENTER = "animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both duration-300 motion-reduce:animate-none";
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** One line from Finance: the month's forecast, charges and money free to invest. */
function FinanceLine() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const forecast = useQuery({ queryKey: ["performance", "forecast", y, m], queryFn: () => analyticsApi.performanceForecast(y, m) });
  const charges = useQuery({ queryKey: ["expenses-month", y, m], queryFn: () => dailyExpensesApi.month(y, m) });
  const money = useQuery({ queryKey: MONEY_KEY, queryFn: managerApi.money });
  const total = charges.data ? charges.data.totals.chargesPaid + charges.data.totals.chargesRemaining : null;
  const invest = money.data?.plan.invest;
  return (
    <section className={cn("flex flex-wrap items-center gap-3 rounded-2xl border bg-white px-4 py-3", ENTER)} aria-label="Côté Finance">
      <LineChart className="h-5 w-5 shrink-0 text-indigo-600" />
      <p className="min-w-0 flex-[1_1_320px] text-sm text-slate-700">
        <b className="capitalize">{MONTHS[now.getMonth()]}</b>, côté Finance :{" "}
        <b className="tabular-nums">{forecast.data ? dt(Math.round(forecast.data.expected.total / 50) * 50) : "…"}</b> prévus ·{" "}
        <b className="tabular-nums">{total != null ? dt(total) : "…"}</b> de charges ·{" "}
        {invest != null ? (
          <>
            vous pouvez investir <b className="tabular-nums text-emerald-700">{dt(invest)}</b>
          </>
        ) : (
          <>argent à investir : à calculer</>
        )}
        .
      </p>
      <Button asChild variant="outline" className="rounded-xl">
        <Link href="/finance?tab=argent">
          Voir Finance <ArrowRight className="ml-1 h-4 w-4" />
        </Link>
      </Button>
    </section>
  );
}

function AreaCard({ a, running, onOpen }: { a: HealthArea; running: BusinessInitiative[]; onOpen: () => void }) {
  const Icon = AREA_ICON[a.id];
  const ui = STATUS_UI[a.status];
  const first = running[0];
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full flex-col gap-2.5 rounded-2xl border p-4 text-left transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-[0_12px_26px_-16px_rgba(79,70,229,0.5)] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        ui.card,
      )}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className="flex items-center gap-2.5 text-[15px] font-bold">
          <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", ui.dot)} aria-hidden />
          <Icon className="h-4 w-4 text-slate-500" />
          {a.name}
        </span>
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", ui.pill)}>{a.statusLabel}</span>
      </span>
      <span>
        <span className="text-[32px] font-extrabold leading-none tracking-tight tabular-nums">{a.big}</span>{" "}
        <span className="text-sm text-slate-600">{a.sub}</span>
      </span>
      <span className="text-[13px] text-slate-500">
        {a.compare.label === "visé" ? `Visé : ${a.compare.value}` : `${a.compare.value} ${a.compare.label}`}
      </span>
      {first ? (
        <span className="inline-flex w-fit max-w-full truncate rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-800">
          En cours : {first.title} · {signedDt(first.result?.gain ?? 0)}
        </span>
      ) : null}
      <span className="text-[13px] font-bold text-indigo-700">
        {a.solutions.length
          ? `${a.solutions.length} solution${a.solutions.length > 1 ? "s" : ""} →`
          : running.length
            ? "Suivre →"
            : "Voir →"}
      </span>
    </button>
  );
}

function RunningStrip({ list, areaName, onOpen, max }: { list: BusinessInitiative[]; areaName: (i: BusinessInitiative) => string; onOpen: (i: BusinessInitiative) => void; max: number }) {
  if (!list.length) return null;
  return (
    <section className={cn("space-y-2.5 rounded-2xl border bg-white p-4", ENTER)} aria-label="Solutions en cours">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-extrabold">
          En cours <span className="font-semibold text-slate-500">· {list.length} / {max}</span>
        </h2>
        <span className="text-[13px] text-slate-500">{max} au maximum, pour bien mesurer chacune</span>
      </div>
      <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
        {list.map((i) => {
          const goal = i.goalAmount ?? 0;
          const gained = i.result?.gain ?? 0;
          const pct = goal > 0 ? Math.max(0, Math.min(100, Math.round((gained / goal) * 100))) : 0;
          const done = i.steps.filter((s) => s.done).length;
          return (
            <button
              key={i.id}
              type="button"
              onClick={() => onOpen(i)}
              className="flex flex-col gap-2 rounded-xl border p-3.5 text-left transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md motion-reduce:transition-none"
            >
              <span className="flex w-full justify-between gap-2 text-xs text-slate-500">
                <span>{areaName(i)}</span>
                <span>{i.paused ? "en pause" : i.activeDays === 0 ? "commence aujourd'hui" : `jour ${i.activeDays} sur ${i.windowDays}`}</span>
              </span>
              <span className="font-bold">{i.title}</span>
              <span className="block h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <span className="block h-full rounded-full bg-emerald-500 transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
              </span>
              <span className="text-sm tabular-nums">
                <b className="text-emerald-700">{signedDt(gained)}</b>{" "}
                <span className="text-slate-500">sur +{dt(goal)} · {done} / {i.steps.length} objectifs</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function ConseillerPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const [openArea, setOpenArea] = useState<HealthAreaId | null>(null);
  const [contextOpen, setContextOpen] = useState(false);
  const [adapt, setAdapt] = useState<AdaptTarget | null>(null);
  const [linkTarget, setLinkTarget] = useState<LinkTarget | null>(null);
  const [campaign, setCampaign] = useState<{ draft: CampaignDraft; initiativeId: string; step: number | null } | null>(null);
  const [startingKey, setStartingKey] = useState<string | null>(null);

  const health = useQuery({ queryKey: ["advisor", "health"], queryFn: advisorApi.health });
  const initiatives = useQuery({ queryKey: ["advisor", "initiatives"], queryFn: advisorApi.initiatives });
  const settings = useQuery({ queryKey: ["advisor", "settings"], queryFn: advisorApi.settings });
  const dataCheck = useQuery({ queryKey: ["advisor", "data-check"], queryFn: advisorApi.dataCheck });
  const reports = useQuery({
    queryKey: ["advisor", "reports"],
    queryFn: advisorApi.reports,
    refetchInterval: (q) => (q.state.data?.some((r) => r.status === "PENDING") ? 4000 : false),
  });

  // Coming back from « Préparer » (or a shared link): reopen that point
  useEffect(() => {
    const a = new URLSearchParams(window.location.search).get("area");
    if (a) setOpenArea(a as HealthAreaId);
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (openArea) url.searchParams.set("area", openArea);
    else url.searchParams.delete("area");
    window.history.replaceState(null, "", url);
  }, [openArea]);

  // A finished AI analysis brings new solutions into the bilan
  const latest = reports.data?.[0];
  const pending = reports.data?.find((r) => r.status === "PENDING");
  useEffect(() => {
    if (latest?.status === "DONE") qc.invalidateQueries({ queryKey: ["advisor", "health"] });
  }, [latest?.id, latest?.status, qc]);

  const h = health.data;
  const max = h?.max ?? 3;
  const running = useMemo(
    () => (initiatives.data ?? []).filter((i) => !i.finished && !i.dropped),
    [initiatives.data],
  );
  const full = running.length >= max;
  const runningIn = (a: HealthArea) => running.filter((i) => a.running.includes(i.id));
  const areaOfInitiative = (i: BusinessInitiative) => h?.areas.find((a) => a.running.includes(i.id));
  const area = h?.areas.find((a) => a.id === openArea) ?? null;
  const runningGain = running.reduce((s, i) => s + (i.result?.gain ?? 0), 0);

  const generate = useMutation({
    mutationFn: () => advisorApi.generate(30),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["advisor", "reports"] });
      toast.success("L'IA refait le bilan avec vos derniers chiffres (1 à 2 minutes)");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const refresh = () => {
    if (settings.data?.enabled) generate.mutate();
    else {
      qc.invalidateQueries({ queryKey: ["advisor"] });
      toast.success("Bilan recalculé. Pour des idées de l'IA sans clé API : Mon contexte → copier-coller.");
    }
  };

  const start = useMutation({
    mutationFn: (s: HealthSolution) => startSolution(startPayload(s)),
    onMutate: (s) => setStartingKey(s.key),
    onSuccess: () => {
      toast.success("C'est parti : la mesure commence aujourd'hui");
      qc.invalidateQueries({ queryKey: ["advisor"] });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setStartingKey(null),
  });

  const linkCampaign = useMutation({
    mutationFn: ({ initiativeId, id, step }: { initiativeId: string; id: string; step: number | null }) =>
      advisorApi.addTool(initiativeId, { kind: "CAMPAIGN", targetId: id, stepIndex: step }),
    onSuccess: () => {
      toast.success("Relance liée : ceux qui reviennent comptent pour la solution");
      qc.invalidateQueries({ queryKey: ["advisor"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lastAnalysis = reports.data?.find((r) => r.status === "DONE");
  const failed = latest?.status === "FAILED" ? latest : null;

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 px-5 pb-5 pt-5 text-white sm:px-6">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10" />
          <div className="absolute -bottom-16 left-1/3 h-36 w-36 rounded-full bg-white/10" />
        </div>
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-100">
              Bilan du {format(new Date(), "EEEE d MMMM", { locale: fr })}
              {lastAnalysis ? ` · idées de l'IA ${formatDistanceToNow(new Date(lastAnalysis.createdAt), { locale: fr, addSuffix: true })}` : ""}
            </p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold">
              <Activity className="h-6 w-6" />
              Conseil IA
            </h1>
            <p className="mt-1 text-[13px] text-indigo-100">
              Ce qui va, ce qui coince, et quoi faire. L&apos;app compte les DT que chaque solution rapporte.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setContextOpen(true)}
              className="rounded-xl border-white/40 bg-white/10 font-semibold text-white hover:bg-white/20 hover:text-white"
            >
              <Settings2 className="mr-1.5 h-4 w-4" />
              Mon contexte
            </Button>
            <Button
              onClick={refresh}
              disabled={!!pending || generate.isPending}
              className="rounded-xl bg-white font-bold text-indigo-700 shadow-lg transition-transform duration-150 hover:-translate-y-0.5 hover:bg-white motion-reduce:hover:translate-y-0"
            >
              {pending || generate.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
              {pending ? "L'IA réfléchit…" : "Refaire le bilan"}
            </Button>
          </div>
        </div>
        <div className="relative mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <BannerChip label="points à régler" value={h ? `${h.toFix} sur ${h.areas.length}` : "…"} />
          <BannerChip label="solutions en cours" value={`${running.length} / ${max}`} sub={`${signedDt(runningGain)} pour l'instant`} />
          <BannerChip
            label="gagnés avec les solutions terminées"
            value={h ? signedDt(h.gainedTotal) : "…"}
            sub={h ? `${h.finishedCount} terminée${h.finishedCount > 1 ? "s" : ""}, coûts déduits` : undefined}
          />
        </div>
      </section>

      {failed && !pending ? (
        <p className={cn("rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900", ENTER)}>
          <b>La dernière analyse de l&apos;IA a échoué.</b>{" "}
          {/credit balance/i.test(failed.error ?? "")
            ? "Crédit Anthropic épuisé : rechargez le compte, ou utilisez le copier-coller dans « Mon contexte »."
            : failed.error}{" "}
          Le bilan ci-dessous reste calculé par les règles.
        </p>
      ) : null}

      <DataCheck issues={dataCheck.data ?? []} />
      <FinanceLine />

      <section aria-label="Bilan" className="space-y-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-extrabold">Le bilan de votre espace</h2>
          <span className="flex flex-wrap gap-3.5 text-[13px] text-slate-500">
            {(["red", "orange", "green"] as const).map((s) => (
              <span key={s} className="inline-flex items-center gap-2">
                <span className={cn("h-2.5 w-2.5 rounded-full", STATUS_UI[s].dot)} aria-hidden />
                {s === "red" ? "À régler" : s === "orange" ? "À surveiller" : "Ça va"}
              </span>
            ))}
          </span>
        </div>
        {h ? (
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(270px,1fr))]">
            {h.areas.map((a, k) => (
              <div key={a.id} className={ENTER} style={{ animationDelay: `${Math.min(k, 6) * 40}ms` }}>
                <AreaCard a={a} running={runningIn(a)} onOpen={() => setOpenArea(a.id)} />
              </div>
            ))}
          </div>
        ) : health.isError ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{(health.error as Error).message}</p>
        ) : (
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(270px,1fr))]">
            {Array.from({ length: 6 }, (_, k) => (
              <Skeleton key={k} className="h-44 rounded-2xl" />
            ))}
          </div>
        )}
      </section>

      <RunningStrip
        list={running}
        max={max}
        areaName={(i) => areaOfInitiative(i)?.name ?? "Autre"}
        onOpen={(i) => {
          const a = areaOfInitiative(i);
          if (a) setOpenArea(a.id);
        }}
      />

      {h?.other.length ? (
        <section className="rounded-2xl border border-dashed bg-white p-4 text-sm">
          <h2 className="mb-1.5 font-bold">À régler aussi</h2>
          <ul className="space-y-1">
            {h.other.map((o) => (
              <li key={o.title}>
                <b>{o.title}</b> <span className="text-slate-600">{o.why}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <AreaDialog
        area={area}
        running={area ? runningIn(area) : []}
        max={max}
        full={full}
        startingKey={startingKey}
        onClose={() => setOpenArea(null)}
        onStart={(s) => start.mutate(s)}
        onAdapt={(s) => setAdapt({ mode: "start", solution: s })}
        onEdit={(i) => setAdapt({ mode: "edit", initiative: i })}
        onLinkExisting={(i, kind, step) => setLinkTarget({ initiativeId: i.id, kind, step })}
        onPrepare={(i, tool) => {
          if (tool.kind === "CAMPAIGN") {
            const d = tool.draft as { title?: string; message?: string; segment?: string };
            setCampaign({
              initiativeId: i.id,
              step: tool.step,
              draft: {
                title: d.title && d.title !== "Relance" ? d.title : i.title,
                message: d.message ?? "",
                segment: (d.segment as CampaignSegment) || undefined,
                trackAsInitiative: false,
              },
            });
            return;
          }
          router.push(prepareHref({ i: i.id, s: tool.step, a: openArea, k: tool.kind, d: tool.draft }));
        }}
      />
      <AdaptDialog target={adapt} full={full} onClose={() => setAdapt(null)} onStarted={() => undefined} />
      <LinkToolDialog target={linkTarget} onClose={() => setLinkTarget(null)} />
      <CampaignDialog
        draft={campaign?.draft ?? null}
        onClose={() => setCampaign(null)}
        onCreated={(c) => {
          if (campaign) linkCampaign.mutate({ initiativeId: campaign.initiativeId, id: c.id, step: campaign.step });
        }}
      />
      <ContextDialog
        open={contextOpen}
        onClose={() => setContextOpen(false)}
        onImported={() => qc.invalidateQueries({ queryKey: ["advisor"] })}
      />
    </div>
  );
}
