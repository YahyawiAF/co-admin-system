"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, BookOpen, Download, GraduationCap, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ListPager, usePaged } from "@/components/ui/list-pager";
import { DIALOG_CLASS } from "@/components/admin/OutreachCampaigns";
import { DIRECTOR_KEY, directorApi, type DirectorLesson, type DirectorLessonStatus, type DirectorOverview } from "@/lib/api/director";
import { cn } from "@/lib/utils";

const ENTER = "animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both duration-300 motion-reduce:animate-none";

export const LESSON_STATUS: Record<DirectorLessonStatus, { label: string; pill: string }> = {
  ADOPTED: { label: "Adoptée", pill: "bg-emerald-100 text-emerald-800" },
  ADAPTED: { label: "Adaptée", pill: "bg-indigo-100 text-indigo-800" },
  TESTING: { label: "À tester", pill: "bg-amber-100 text-amber-900" },
  CANDIDATE: { label: "À juger", pill: "bg-slate-100 text-slate-700" },
  REJECTED: { label: "Refusée", pill: "bg-rose-100 text-rose-800" },
  RETIRED: { label: "Retirée", pill: "bg-slate-100 text-slate-500" },
};
export const domainLabel = (d: string) => (d === "*" ? "Tous métiers" : d === "coworking" ? "Coworking" : d);

const FILTERS = [
  { id: "all", label: "Toutes" },
  { id: "principes", label: "Principes" },
  { id: "testing", label: "À tester" },
  { id: "review", label: "À revoir" },
  { id: "rejected", label: "Refusées" },
] as const;
type Filter = (typeof FILTERS)[number]["id"];

function download(data: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: DIRECTOR_KEY });
}

/** Paste a book note, a video summary or an idea: it goes to the brain with the next export. */
function LearnDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [text, setText] = useState("");
  const invalidate = useInvalidate();
  useEffect(() => {
    if (!open) setText("");
  }, [open]);
  const save = useMutation({
    mutationFn: () => directorApi.addLearn(text),
    onSuccess: () => {
      toast.success("Gardé : le directeur le jugera au prochain « Exporter pour Claude »");
      invalidate();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(DIALOG_CLASS, "max-w-2xl")}>
        <div className="shrink-0 bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 px-6 pb-5 pt-5 text-white">
          <DialogTitle className="pr-10 text-xl font-extrabold text-white">Apprendre quelque chose au directeur</DialogTitle>
          <DialogDescription className="mt-1 text-[13px] text-indigo-100">
            Il ne l’accepte pas tel quel : il le découpe en idées, les compare à ce qu’il sait et à vos chiffres, puis adopte, adapte, teste ou refuse.
          </DialogDescription>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5 sm:p-6">
          <label htmlFor="learn-text" className="text-sm font-semibold">
            Résumé de livre, de vidéo, idée…
          </label>
          <Textarea id="learn-text" rows={10} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] text-slate-500 tabular-nums">{text.length.toLocaleString("fr-FR")} / 8 000</span>
            <Button className="h-11 rounded-xl px-5 font-bold" disabled={text.trim().length < 20 || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <GraduationCap className="mr-1.5 h-4 w-4" />}
              Donner au directeur
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** One lesson: why, where it came from, its results, the debate and its history. Contest once. */
function LessonDialog({ lesson, onClose, cornerName }: { lesson: DirectorLesson | null; onClose: () => void; cornerName: (id: string) => string }) {
  const [text, setText] = useState("");
  const invalidate = useInvalidate();
  useEffect(() => setText(""), [lesson?.id]);
  const contest = useMutation({
    mutationFn: () => directorApi.contestLesson(lesson!.id, text),
    onSuccess: () => {
      toast.success("Contestation gardée : le directeur répondra au prochain bilan");
      invalidate();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const l = lesson;
  return (
    <Dialog open={!!l} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(DIALOG_CLASS, "max-w-2xl")}>
        {l ? (
          <>
            <div className="shrink-0 bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 px-6 pb-5 pt-5 text-white">
              <p className="flex flex-wrap gap-1.5 pr-10">
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", LESSON_STATUS[l.status].pill)}>{LESSON_STATUS[l.status].label}</span>
                <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold">{domainLabel(l.domain)}</span>
                <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold">{cornerName(l.corner)}</span>
                <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold tabular-nums">Confiance {l.confidence}</span>
              </p>
              <DialogTitle className="mt-2 text-xl font-extrabold leading-snug text-white">{l.rule}</DialogTitle>
              {l.why ? <DialogDescription className="mt-1 text-sm text-indigo-100">{l.why}</DialogDescription> : <DialogDescription className="sr-only">Leçon du directeur</DialogDescription>}
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
              {l.flag === "review" ? (
                <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  Les résultats ne la soutiennent pas : le directeur va la réécrire ou la retirer.
                </p>
              ) : null}
              {l.origin ? (
                <p className="text-[13px] text-slate-500">
                  <b>D’où elle vient :</b> {l.origin}
                </p>
              ) : null}
              <section className="space-y-1.5">
                <h3 className="text-[12px] font-bold uppercase tracking-wider text-slate-500">Preuves</h3>
                {l.results.length || l.evidence.length ? (
                  <ul className="space-y-1.5 text-sm">
                    {l.results.map((r, k) => (
                      <li key={`r${k}`} className="rounded-xl bg-slate-50 px-3 py-2">
                        <b>{r.priority}</b> · {r.watch}{" "}
                        {r.change != null ? (
                          <span className={cn("font-bold tabular-nums", r.change > 0 ? "text-emerald-700" : r.change < 0 ? "text-orange-800" : "text-slate-600")}>
                            {r.change > 0 ? "+" : ""}
                            {r.change} {r.unit}
                          </span>
                        ) : null}
                        {r.sales ? <span className="text-slate-500"> · {r.sales} DT de ventes</span> : null}
                      </li>
                    ))}
                    {l.evidence.map((e, k) => (
                      <li key={`e${k}`} className="rounded-xl bg-slate-50 px-3 py-2">
                        <span className="text-slate-500">{e.date} · </span>
                        {e.text}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-600">Pas encore de résultat : elle bougera quand une priorité qui l’applique sera mesurée.</p>
                )}
              </section>
              {l.debate.length ? (
                <section className="space-y-1.5">
                  <h3 className="text-[12px] font-bold uppercase tracking-wider text-slate-500">Débat</h3>
                  {l.debate.map((d, k) => (
                    <p key={k} className={cn("rounded-xl px-3 py-2 text-sm", d.by === "OWNER" ? "bg-indigo-50 text-indigo-950" : "bg-slate-50")}>
                      <b>{d.by === "OWNER" ? "Vous" : "Le directeur"} :</b> {d.text}
                    </p>
                  ))}
                  {l.contested ? <p className="text-[13px] text-slate-500">Il répondra au prochain bilan.</p> : null}
                </section>
              ) : null}
              {l.canContest ? (
                <section className="space-y-2 rounded-2xl border p-4">
                  <label htmlFor="contest" className="text-sm font-semibold">
                    Pas d’accord ? Un argument ou un fait (une seule fois)
                  </label>
                  <Textarea id="contest" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
                  <Button className="h-11 rounded-xl font-bold" disabled={!text.trim() || contest.isPending} onClick={() => contest.mutate()}>
                    Contester
                  </Button>
                </section>
              ) : null}
              {l.history.length ? (
                <section className="space-y-1">
                  <h3 className="text-[12px] font-bold uppercase tracking-wider text-slate-500">Historique</h3>
                  <ul className="space-y-0.5 text-[13px] text-slate-600">
                    {l.history.map((h, k) => (
                      <li key={k}>
                        {h.date} · <b>{h.change}</b> · {h.why}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** Mémoire › Leçons: what the director knows, how sure he is, and « Apprendre ». */
export function LessonsPanel({ d, cornerName }: { d: DirectorOverview; cornerName: (id: string) => string }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [learnOpen, setLearnOpen] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const invalidate = useInvalidate();
  const removeLearn = useMutation({ mutationFn: (id: string) => directorApi.removeLearn(id), onSuccess: invalidate, onError: (e: Error) => toast.error(e.message) });
  const exportFile = useMutation({
    mutationFn: directorApi.lessonsFile,
    onSuccess: (data) => {
      download(data, `lecons-${data.exportedAt.slice(0, 10)}.json`);
      toast.success("Principes exportés : importe ce fichier dans l’autre projet");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const importFile = useMutation({
    mutationFn: (json: string) => directorApi.importLessonsFile(json),
    onSuccess: (r) => {
      toast.success(`${r.added} leçon${r.added > 1 ? "s" : ""} ajoutée${r.added > 1 ? "s" : ""} · ${r.skipped} déjà connue${r.skipped > 1 ? "s" : ""}`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = useMemo(
    () =>
      [...d.lessons]
        .filter((l) =>
          filter === "all"
            ? l.status !== "REJECTED" && l.status !== "RETIRED"
            : filter === "principes"
              ? l.domain === "*" && l.status !== "REJECTED"
              : filter === "testing"
                ? l.status === "TESTING"
                : filter === "review"
                  ? l.flag === "review" || l.contested
                  : l.status === "REJECTED" || l.status === "RETIRED",
        )
        .sort((a, b) => b.confidence - a.confidence),
    [d.lessons, filter],
  );
  const paged = usePaged(list, 20, filter);
  const chip = (on: boolean) =>
    cn(
      "min-h-9 rounded-full border px-3 text-[13px] font-semibold transition-colors duration-150 motion-reduce:transition-none",
      on ? "border-indigo-600 bg-indigo-600 text-white" : "bg-white text-slate-700 hover:border-indigo-300",
    );

  return (
    <section className={cn("space-y-3", ENTER)}>
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" className={chip(filter === f.id)} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
        <span className="flex-1" />
        <Button variant="outline" className="h-11 rounded-xl" disabled={exportFile.isPending} onClick={() => exportFile.mutate()}>
          <Download className="mr-1.5 h-4 w-4" />
          Exporter les principes
        </Button>
        <label className="inline-flex h-11 cursor-pointer items-center rounded-xl border bg-white px-4 text-sm font-medium hover:border-indigo-300">
          <Upload className="mr-1.5 h-4 w-4" />
          Importer des leçons
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) importFile.mutate(await f.text());
              e.target.value = "";
            }}
          />
        </label>
        <Button className="h-11 rounded-xl font-bold" onClick={() => setLearnOpen(true)}>
          <GraduationCap className="mr-1.5 h-4 w-4" />
          Apprendre
        </Button>
      </div>

      {d.learn.length ? (
        <div className={cn("space-y-2 rounded-2xl border border-indigo-200 bg-indigo-50 p-4", ENTER)}>
          <p className="text-sm font-bold text-indigo-950">
            {d.learn.length} texte{d.learn.length > 1 ? "s" : ""} pour le directeur : il les jugera au prochain « Exporter pour Claude »
          </p>
          {d.learn.map((l) => (
            <div key={l.id} className="flex items-start gap-2 rounded-xl bg-white px-3 py-2">
              <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" aria-hidden />
              <p className="line-clamp-2 min-w-0 flex-1 text-sm text-slate-700">{l.text}</p>
              <button
                type="button"
                aria-label="Retirer ce texte"
                onClick={() => removeLearn.mutate(l.id)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border bg-white">
        {paged.pageItems.length ? (
          <ul>
            {paged.pageItems.map((l, k) => (
              <li key={l.id} className={cn("border-b last:border-b-0", ENTER)} style={{ animationDelay: `${Math.min(k, 8) * 25}ms` }}>
                <button
                  type="button"
                  onClick={() => setOpen(l.id)}
                  className="grid w-full gap-x-4 gap-y-2 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-slate-50 motion-reduce:transition-none sm:grid-cols-[minmax(0,1fr)_200px] sm:items-center"
                >
                  <span className="min-w-0 space-y-1.5">
                    <span className="block font-semibold leading-snug">{l.rule}</span>
                    <span className="flex flex-wrap gap-1.5">
                      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", LESSON_STATUS[l.status].pill)}>{LESSON_STATUS[l.status].label}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">{domainLabel(l.domain)}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">{cornerName(l.corner)}</span>
                      {l.flag === "review" ? <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">À revoir</span> : null}
                      {l.contested ? <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-800">Contestée</span> : null}
                    </span>
                  </span>
                  <span className="space-y-1">
                    <span className="block text-[13px] text-slate-600 tabular-nums">
                      Confiance {l.confidence} · {l.results.length + l.evidence.length || "pas de"} preuve{l.results.length + l.evidence.length > 1 ? "s" : ""}
                    </span>
                    <span className="block h-2 overflow-hidden rounded-full bg-slate-200">
                      <span
                        className="block h-full rounded-full bg-indigo-600 transition-[width] duration-500 motion-reduce:transition-none"
                        style={{ width: `${l.confidence}%` }}
                      />
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-6 text-sm text-slate-600">
            {filter === "all" ? "Pas encore de leçon. « Apprendre » : collez un résumé, le directeur le jugera." : "Rien ici pour l’instant."}
          </p>
        )}
        <ListPager page={paged.page} lastPage={paged.lastPage} total={paged.total} onPage={paged.setPage} />
      </div>

      <LearnDialog open={learnOpen} onClose={() => setLearnOpen(false)} />
      <LessonDialog lesson={d.lessons.find((l) => l.id === open) ?? null} onClose={() => setOpen(null)} cornerName={cornerName} />
    </section>
  );
}
