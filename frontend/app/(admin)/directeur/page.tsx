"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, Brain, Download, FileUp, Loader2, Pencil, Plus, Sparkles, Target, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ListPager, usePaged } from "@/components/ui/list-pager";
import { ConseilView } from "@/components/admin/advisor/ConseilView";
import { ClaudeUpdateDialog, useExportForClaude } from "@/components/admin/director/ClaudeRoundTrip";
import { NeedsCard, PriorityCards, WatchLine } from "@/components/admin/director/PriorityCards";
import { CornerDialog, EntryDialog, GoalDialog, ImportDialog, KINDS } from "@/components/admin/director/DirectorDialogs";
import { advisorApi } from "@/lib/api/resources";
import { DIRECTOR_KEY, directorApi, type DirectorCorner, type DirectorEntry, type DirectorOverview, type DirectorStatus } from "@/lib/api/director";
import type { BusinessInitiative } from "@/lib/types";
import { cn } from "@/lib/utils";

const ENTER = "animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both duration-300 motion-reduce:animate-none";
const TABS = [
  { id: "semaine", label: "Cette semaine" },
  { id: "memoire", label: "Mémoire" },
  { id: "coins", label: "Coins du business" },
  { id: "conseils", label: "Conseils" },
  { id: "tests", label: "Tests" },
] as const;
type TabId = (typeof TABS)[number]["id"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

const dt = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} DT`;
const shortDay = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return `${d} ${MONTHS[m - 1].slice(0, 4).replace(/\.$/, "")}${y !== new Date().getFullYear() ? ` ${y}` : ""}`;
};

const STATUS: Record<DirectorStatus, { pill: string; dot: string }> = {
  red: { pill: "bg-rose-100 text-rose-800", dot: "bg-rose-500" },
  orange: { pill: "bg-amber-100 text-amber-900", dot: "bg-amber-500" },
  green: { pill: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500" },
  grey: { pill: "bg-slate-100 text-slate-700", dot: "bg-slate-400" },
};
const KIND_PILL: Record<string, string> = {
  DECISION: "bg-indigo-100 text-indigo-800",
  FACT: "bg-slate-100 text-slate-700",
  LESSON: "bg-emerald-100 text-emerald-800",
  TEST: "bg-sky-100 text-sky-800",
};

function GoalBand({ d, onEdit }: { d: DirectorOverview; onEdit: () => void }) {
  const pct = d.month.profit != null ? Math.max(0, Math.min(100, Math.round((d.month.profit / d.goal.profit) * 100))) : 0;
  return (
    <section aria-label="Objectif" className={cn("grid gap-4 rounded-2xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4 sm:p-5", ENTER)}>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Objectif</p>
        <p className="mt-1 text-2xl font-extrabold tabular-nums">{dt(d.goal.profit)}</p>
        <button type="button" onClick={onEdit} className="inline-flex min-h-8 items-center gap-1 text-[13px] text-slate-600 hover:text-indigo-700">
          de bénéfice par mois · {d.goal.date ? `pour le ${shortDay(d.goal.date)}` : "date à fixer"}
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Revenu {MONTHS[d.month.month - 1]}</p>
        <p className="mt-1 text-2xl font-extrabold tabular-nums">≈ {dt(d.month.income)}</p>
        <Link href="/finance" className="text-[13px] text-slate-600 hover:text-indigo-700">prévu · Prévision</Link>
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Dépenses du mois</p>
        <p className={cn("mt-1 text-2xl font-extrabold tabular-nums", d.month.charges <= 0 && "text-amber-800")}>
          {d.month.charges > 0 ? dt(d.month.charges) : "?"}
        </p>
        <Link href="/finance" className="text-[13px] font-semibold text-indigo-700 hover:underline">
          {d.month.charges > 0 ? "Voir dans Finance" : "Ajouter dans Finance"}
        </Link>
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Bénéfice</p>
        <p className="mt-1 text-2xl font-extrabold tabular-nums">{d.month.profit != null ? dt(d.month.profit) : "—"}</p>
        <span className="mt-1.5 block h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
          <span className="block h-full rounded-full bg-indigo-600 transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
        </span>
        <p className="mt-1 text-[13px] text-slate-600">
          {d.month.profit != null ? `${pct} % de l’objectif` : "Impossible à calculer sans les dépenses"}
        </p>
      </div>
    </section>
  );
}

function WeekTab({
  d,
  running,
  onCorner,
  onGoal,
}: {
  d: DirectorOverview;
  running: BusinessInitiative[];
  onCorner: (id: string) => void;
  onGoal: () => void;
}) {
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const answer = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => advisorApi.answerQuestion(id, { answer: text }),
    onSuccess: () => {
      toast.success("Réponse gardée : Claude la lira");
      qc.invalidateQueries({ queryKey: DIRECTOR_KEY });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const cornerName = (id: string) => d.corners.find((c) => c.id === id)?.name ?? id;
  const brief = d.brief && Date.now() - new Date(`${d.brief.date}T12:00:00`).getTime() < 14 * 86_400_000 ? d.brief : null;
  const fromClaude = (brief?.priorities ?? []).map((p) => ({
    key: `claude-${p.title}`,
    title: p.title,
    sub: `${cornerName(p.corner)} · ${p.why}`,
    href: null as string | null,
    action: "",
  }));
  const priorities = fromClaude.length ? fromClaude : [
    ...running.slice(0, 3).map((i) => ({
      key: i.id,
      title: i.title,
      sub: `En cours · jour ${i.activeDays} sur ${i.windowDays} · ${i.result?.gain != null ? `${i.result.gain >= 0 ? "+" : ""}${dt(i.result.gain)}` : "pas encore mesuré"}`,
      href: "/directeur?tab=tests",
      action: "Suivre",
    })),
    ...d.suggestions.map((s) => ({
      key: s.title,
      title: s.title,
      sub: `${cornerName(s.corner)} · ${s.why}${s.gain ? ` · ≈ +${dt(s.gain)}/mois` : ""}`,
      href: s.href,
      action: "Voir",
    })),
  ].slice(0, 3);
  const a = d.alert;
  const fromBrain = d.priorities.some((p) => p.status === "ACTIVE");

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {a?.status ? (
        <section
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-4 lg:col-span-3",
            a.status === "red" ? "border-orange-300 bg-orange-50 text-orange-950" : "border-amber-200 bg-amber-50 text-amber-950",
            ENTER,
          )}
        >
          <div className="flex min-w-0 items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-extrabold">
                Alerte : l’argent a baissé de {Math.abs(a.moneyPct)} % ces 7 jours
                {a.startedOn ? ` (depuis le ${shortDay(a.startedOn)})` : ""}
              </p>
              <p className="text-sm">
                {dt(a.moneyNow)} par jour contre {dt(a.moneyBefore)} d’habitude · {a.clientsNow} clients par jour contre {a.clientsBefore}
              </p>
            </div>
          </div>
          <Button variant="outline" className="h-11 rounded-xl bg-white" onClick={() => onCorner("clients")}>
            Noter une cause
          </Button>
        </section>
      ) : null}

      <section className={cn("space-y-3 rounded-2xl border bg-white p-4 sm:p-5 lg:col-span-2", ENTER)}>
        <div>
          <h2 className="text-base font-extrabold">3 priorités cette semaine</h2>
          <p className="text-[13px] text-slate-500">
            {brief ? (
              <>
                <Sparkles className="mr-1 inline h-3.5 w-3.5 text-indigo-600" />
                Par Claude le {shortDay(brief.date)}
              </>
            ) : (
              "Calculées par les règles. Jamais plus de 3, pour finir ce qu’on commence."
            )}
          </p>
        </div>
        {brief?.summary ? <p className="rounded-xl bg-indigo-50 px-3.5 py-2.5 text-sm text-indigo-950">{brief.summary}</p> : null}
        {fromBrain || d.priorities.length ? <PriorityCards list={d.priorities} cornerName={cornerName} /> : null}
        {d.watches.length ? (
          <div className="space-y-2">
            <p className="text-[12px] font-bold uppercase tracking-wider text-slate-500">Autres chiffres suivis</p>
            {d.watches.map((w) => (
              <WatchLine key={w.id} w={w} />
            ))}
          </div>
        ) : null}
        {fromBrain ? null : priorities.length ? (
          <ol className="space-y-2.5">
            {priorities.map((p, k) => (
              <li key={p.key} className="flex items-center gap-3 rounded-xl border p-3.5 transition-shadow duration-200 hover:shadow-md motion-reduce:transition-none">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-indigo-100 text-sm font-extrabold text-indigo-700">{k + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{p.title}</p>
                  <p className="text-[13px] text-slate-500">{p.sub}</p>
                </div>
                {p.href ? (
                  <Button asChild variant="outline" className="h-11 shrink-0 rounded-xl">
                    <Link href={p.href}>{p.action}</Link>
                  </Button>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-xl border border-dashed p-4 text-sm text-slate-600">
            Rien d’urgent selon les règles. Demande un bilan à Claude pour de nouvelles idées.
          </p>
        )}
      </section>

      <section className={cn("space-y-3 rounded-2xl border bg-white p-4 sm:p-5", ENTER)}>
        <h2 className="text-base font-extrabold">Claude te demande</h2>
        {!d.goal.date ? (
          <div className="rounded-xl border p-3.5">
            <p className="text-sm font-semibold">{dt(d.goal.profit)} de bénéfice : pour quand ?</p>
            <Button variant="outline" className="mt-2 h-11 w-full rounded-xl" onClick={onGoal}>
              <Target className="mr-1.5 h-4 w-4" />
              Fixer la date
            </Button>
          </div>
        ) : null}
        {d.questions.map((q) => (
          <div key={q.id} className="rounded-xl border p-3.5">
            <label htmlFor={`q-${q.id}`} className="text-sm font-semibold">
              {q.question}
            </label>
            <div className="mt-2 flex gap-2">
              <Input
                id={`q-${q.id}`}
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers((x) => ({ ...x, [q.id]: e.target.value }))}
                className="h-11"
              />
              <Button
                className="h-11 rounded-xl"
                disabled={!answers[q.id]?.trim() || answer.isPending}
                onClick={() => answer.mutate({ id: q.id, text: answers[q.id] })}
              >
                OK
              </Button>
            </div>
          </div>
        ))}
        {d.goal.date && !d.questions.length ? <p className="text-sm text-slate-600">Pas de question en attente.</p> : null}
        <p className="text-[13px] text-slate-500">Chaque réponse est lue par Claude au prochain bilan.</p>
      </section>
      {d.needs.length ? (
        <div className="lg:col-start-3">
          <NeedsCard needs={d.needs} />
        </div>
      ) : null}
    </div>
  );
}

function MemoryTab({
  d,
  corner,
  setCorner,
  onAdd,
  onEdit,
  onImport,
}: {
  d: DirectorOverview;
  corner: string;
  setCorner: (c: string) => void;
  onAdd: () => void;
  onEdit: (e: DirectorEntry) => void;
  onImport: () => void;
}) {
  const used = d.corners.filter((c) => c.notes > 0);
  const list = useMemo(() => d.memory.filter((m) => corner === "all" || m.corner === corner), [d.memory, corner]);
  const paged = usePaged(list, 20, corner);
  const cornerName = (id: string) => d.corners.find((c) => c.id === id)?.name ?? id;
  const chip = (on: boolean) =>
    cn(
      "min-h-9 rounded-full border px-3 text-[13px] font-semibold transition-colors duration-150 motion-reduce:transition-none",
      on ? "border-indigo-600 bg-indigo-600 text-white" : "bg-white text-slate-700 hover:border-indigo-300",
    );
  return (
    <section className={cn("space-y-3", ENTER)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-semibold text-slate-500">Coin :</span>
        <button type="button" className={chip(corner === "all")} onClick={() => setCorner("all")}>
          Tous · {d.memory.length}
        </button>
        {used.map((c) => (
          <button key={c.id} type="button" className={chip(corner === c.id)} onClick={() => setCorner(c.id)}>
            {c.name} · {c.notes}
          </button>
        ))}
        {corner !== "all" && !used.some((c) => c.id === corner) ? (
          <button type="button" className={chip(true)}>
            {cornerName(corner)} · 0
          </button>
        ) : null}
        <span className="flex-1" />
        <Button variant="outline" className="h-11 rounded-xl" onClick={onImport}>
          <Upload className="mr-1.5 h-4 w-4" />
          Importer
        </Button>
        <Button className="h-11 rounded-xl font-bold" onClick={onAdd}>
          <Plus className="mr-1.5 h-4 w-4" />
          Noter
        </Button>
      </div>
      <div className="overflow-hidden rounded-2xl border bg-white">
        {paged.pageItems.length ? (
          <ul>
            {paged.pageItems.map((m, k) => (
              <li key={m.id} className={cn("border-b last:border-b-0", ENTER)} style={{ animationDelay: `${Math.min(k, 8) * 25}ms` }}>
                <button
                  type="button"
                  onClick={() => onEdit(m)}
                  className="grid w-full gap-x-4 gap-y-1 px-4 py-3 text-left transition-colors duration-150 hover:bg-slate-50 motion-reduce:transition-none sm:grid-cols-[80px_100px_minmax(0,1fr)_160px] sm:items-center"
                >
                  <span className="text-[13px] font-semibold text-slate-500">{shortDay(m.date)}</span>
                  <span>
                    <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-bold", KIND_PILL[m.kind])}>{m.kindLabel}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold">{m.text}</span>
                    {m.detail ? <span className="block text-[13px] text-slate-500">{m.detail}</span> : null}
                  </span>
                  <span className="text-[13px] text-slate-500">
                    {cornerName(m.corner)}
                    {m.source === "CLAUDE" ? " · Claude" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-6 text-sm text-slate-600">
            Rien de noté{corner !== "all" ? " dans ce coin" : ""}. Note chaque décision le jour même : « Tarif 1h supprimé », « Règlement à chaque check-in »…
          </p>
        )}
        <ListPager page={paged.page} lastPage={paged.lastPage} total={paged.total} onPage={paged.setPage} />
      </div>
      <p className="text-[13px] text-slate-500">
        Types : {KINDS.map((k) => `${k.label} (${k.hint})`).join(" · ")}. Claude lit tout avant chaque bilan.
      </p>
    </section>
  );
}

function CornersTab({ d, onOpen, onAdd }: { d: DirectorOverview; onOpen: (c: DirectorCorner) => void; onAdd: () => void }) {
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: (id: string) => directorApi.removeCorner(id),
    onSuccess: () => {
      toast.success("Coin retiré");
      qc.invalidateQueries({ queryKey: DIRECTOR_KEY });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <section className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(270px,1fr))]">
      {d.corners.map((c, k) => (
        <div key={c.id} className={cn("relative", ENTER)} style={{ animationDelay: `${Math.min(k, 8) * 35}ms` }}>
          <button
            type="button"
            onClick={() => onOpen(c)}
            className="flex h-full w-full flex-col gap-2 rounded-2xl border bg-white p-4 text-left transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            <span className="flex w-full items-center justify-between gap-2 pr-6">
              <span className="flex items-center gap-2 text-[15px] font-extrabold">
                <span className={cn("h-2.5 w-2.5 rounded-full", STATUS[c.status].dot)} aria-hidden />
                {c.name}
              </span>
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", STATUS[c.status].pill)}>{c.statusLabel}</span>
            </span>
            <span className="text-sm text-slate-700">{c.fact}</span>
            <span className="mt-auto text-[13px] font-semibold text-indigo-700">
              {c.notes} note{c.notes > 1 ? "s" : ""} dans la mémoire →
            </span>
          </button>
          {c.custom && !c.notes ? (
            <button
              type="button"
              aria-label={`Retirer le coin ${c.name}`}
              onClick={() => remove.mutate(c.id)}
              className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className={cn(
          "min-h-32 rounded-2xl border-2 border-dashed border-slate-300 text-sm font-bold text-indigo-700 transition-colors duration-150 hover:border-indigo-400 hover:bg-white motion-reduce:transition-none",
          ENTER,
        )}
      >
        + Ajouter un coin
      </button>
    </section>
  );
}

function TestsTab({ list }: { list: BusinessInitiative[] }) {
  const sorted = useMemo(
    () => [...list].filter((i) => !i.dropped).sort((a, b) => Number(a.finished) - Number(b.finished) || b.startDate.localeCompare(a.startDate)),
    [list],
  );
  const paged = usePaged(sorted, 20);
  if (!sorted.length)
    return (
      <p className={cn("rounded-2xl border border-dashed bg-white p-6 text-sm text-slate-600", ENTER)}>
        Aucun test pour l’instant. Lance une solution depuis « Conseils » : l’app la mesure contre une comparaison.
      </p>
    );
  return (
    <section className={cn("space-y-3", ENTER)}>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
        {paged.pageItems.map((i) => {
          const gain = i.result?.gain;
          return (
            <article key={i.id} className="space-y-1.5 rounded-2xl border bg-white p-4">
              <p className={cn("text-[11px] font-bold uppercase tracking-wider", i.finished ? "text-slate-500" : "text-sky-700")}>
                {i.finished ? "Terminé" : i.paused ? "En pause" : `En cours · jour ${i.activeDays} sur ${i.windowDays}`}
              </p>
              <h3 className="font-extrabold">{i.title}</h3>
              <p className="text-sm tabular-nums">
                <b className={cn(gain != null && gain < 0 ? "text-rose-700" : "text-emerald-700")}>
                  {gain != null ? `${gain >= 0 ? "+" : ""}${dt(gain)}` : "pas encore mesuré"}
                </b>
                {i.goalAmount ? <span className="text-slate-500"> sur +{dt(i.goalAmount)} visés</span> : null}
              </p>
              {i.ownerVerdict ? <p className="text-[13px] text-slate-600">Ton avis : {i.ownerVerdict.replace(/_/g, " ").toLowerCase()}</p> : null}
            </article>
          );
        })}
      </div>
      <div className="overflow-hidden rounded-2xl border bg-white empty:hidden">
        <ListPager page={paged.page} lastPage={paged.lastPage} total={paged.total} onPage={paged.setPage} />
      </div>
    </section>
  );
}

export default function DirecteurPage() {
  const [tab, setTab] = useState<TabId>("semaine");
  const [corner, setCorner] = useState("all");
  const [entry, setEntry] = useState<{ open: boolean; entry: DirectorEntry | null }>({ open: false, entry: null });
  const [importOpen, setImportOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [cornerOpen, setCornerOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const exportFile = useExportForClaude();

  const overview = useQuery({ queryKey: DIRECTOR_KEY, queryFn: directorApi.overview });
  const initiatives = useQuery({ queryKey: ["advisor", "initiatives"], queryFn: advisorApi.initiatives });
  const running = useMemo(() => (initiatives.data ?? []).filter((i) => !i.finished && !i.dropped), [initiatives.data]);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t && TABS.some((x) => x.id === t)) setTab(t as TabId);
  }, []);
  const go = (t: TabId) => {
    setTab(t);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", t);
    if (t !== "conseils") url.searchParams.delete("area");
    window.history.replaceState(null, "", url);
  };
  const openCorner = (id: string) => {
    setCorner(id);
    go("memoire");
  };

  const d = overview.data;
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold">
            <Brain className="h-6 w-6 text-indigo-600" />
            Directeur
          </h1>
          <p className="text-sm text-slate-600">Tout ce qu’on sait du business. Le cerveau : Claude. Les conseils sortent d’ici.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-11 rounded-xl" onClick={() => setEntry({ open: true, entry: null })}>
            <Plus className="mr-1.5 h-4 w-4" />
            Noter un changement
          </Button>
          <Button variant="outline" className="h-11 rounded-xl" disabled={exportFile.isPending} onClick={() => exportFile.mutate()}>
            {exportFile.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
            Exporter pour Claude
          </Button>
          <Button className="h-11 rounded-xl font-bold" onClick={() => setUpdateOpen(true)}>
            <FileUp className="mr-1.5 h-4 w-4" />
            Importer la réponse
          </Button>
        </div>
      </header>

      {d ? <GoalBand d={d} onEdit={() => setGoalOpen(true)} /> : overview.isError ? null : <Skeleton className="h-28 rounded-2xl" />}
      {overview.isError ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{(overview.error as Error).message}</p>
      ) : null}

      <div role="tablist" aria-label="Sections du Directeur" className="flex flex-wrap gap-1.5 border-b pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => go(t.id)}
            className={cn(
              "min-h-11 rounded-xl px-4 text-sm font-semibold transition-colors duration-150 motion-reduce:transition-none",
              tab === t.id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100",
            )}
          >
            {t.label}
            {t.id === "memoire" && d ? <span className="ml-1.5 tabular-nums opacity-70">{d.memory.length}</span> : null}
            {t.id === "tests" && running.length ? <span className="ml-1.5 tabular-nums opacity-70">{running.length}</span> : null}
          </button>
        ))}
      </div>

      <div key={tab} className={ENTER}>
        {tab === "conseils" ? (
          <ConseilView />
        ) : tab === "tests" ? (
          <TestsTab list={initiatives.data ?? []} />
        ) : !d ? (
          <Skeleton className="h-64 rounded-2xl" />
        ) : tab === "semaine" ? (
          <WeekTab d={d} running={running} onCorner={openCorner} onGoal={() => setGoalOpen(true)} />
        ) : tab === "memoire" ? (
          <MemoryTab
            d={d}
            corner={corner}
            setCorner={setCorner}
            onAdd={() => setEntry({ open: true, entry: null })}
            onEdit={(e) => setEntry({ open: true, entry: e })}
            onImport={() => setImportOpen(true)}
          />
        ) : (
          <CornersTab d={d} onOpen={(c) => openCorner(c.id)} onAdd={() => setCornerOpen(true)} />
        )}
      </div>

      {tab !== "conseils" ? (
        <p className="flex flex-wrap items-center gap-1 text-[13px] text-slate-500">
          Sans clé API : « Exporter pour Claude », donne le fichier à Claude, puis « Importer la réponse ».
          <button type="button" className="inline-flex items-center font-semibold text-indigo-700 hover:underline" onClick={() => go("conseils")}>
            Voir les conseils <ArrowRight className="ml-0.5 h-3.5 w-3.5" />
          </button>
        </p>
      ) : null}

      <EntryDialog
        open={entry.open}
        entry={entry.entry}
        corner={corner !== "all" ? corner : null}
        corners={d?.corners ?? []}
        onClose={() => setEntry({ open: false, entry: null })}
      />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
      <GoalDialog open={goalOpen} goal={d?.goal ?? null} onClose={() => setGoalOpen(false)} />
      <CornerDialog open={cornerOpen} onClose={() => setCornerOpen(false)} />
      <ClaudeUpdateDialog
        open={updateOpen}
        onClose={() => setUpdateOpen(false)}
        memory={d?.memory ?? []}
        cornerName={(id) => d?.corners.find((c) => c.id === id)?.name ?? id}
      />
    </div>
  );
}
