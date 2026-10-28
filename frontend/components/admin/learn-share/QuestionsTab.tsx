"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Eye, GitBranch, Pencil, Plus, Save, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { surveysApi } from "@/lib/api/resources";
import { cn } from "@/lib/utils";
import { conditionLabel, OTHER, QUESTION_TYPE_LABEL, type QuestionType, type SurveyDetail, type SurveyQuestion } from "@/lib/surveys";
import { SurveyForm } from "@/components/visitor/survey/SurveyForm";
import { selectClass } from "./shared";

const slugId = (label: string, taken: Set<string>) => {
  const base =
    label
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 30) || "q";
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}_${n}`;
  return id;
};

export function QuestionsTab({ survey, orgName }: { survey: SurveyDetail; orgName: string }) {
  const qc = useQueryClient();
  const [list, setList] = useState<SurveyQuestion[]>(survey.questions);
  const [editing, setEditing] = useState<{ index: number; q: SurveyQuestion } | null>(null);
  const [preview, setPreview] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const positions = useRef<Map<string, number> | null>(null);
  const dirty = JSON.stringify(list) !== JSON.stringify(survey.questions);

  useEffect(() => setList(survey.questions), [survey.questions]);

  // Rows glide to their new place when moved (FLIP)
  useLayoutEffect(() => {
    const before = positions.current;
    positions.current = null;
    if (!before || !listRef.current || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    for (const el of Array.from(listRef.current.children) as HTMLElement[]) {
      const dy = (before.get(el.dataset.q ?? "") ?? 0) - el.getBoundingClientRect().top;
      if (dy) el.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 240, easing: "cubic-bezier(.2,.7,.2,1)" });
    }
  }, [list]);

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    positions.current = new Map(
      (Array.from(listRef.current?.children ?? []) as HTMLElement[]).map((el) => [el.dataset.q ?? "", el.getBoundingClientRect().top])
    );
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    setList(next);
  };

  const save = useMutation({
    mutationFn: () => surveysApi.update(survey.id, { questions: list }),
    onSuccess: (s) => {
      qc.setQueryData(["survey", survey.id], s);
      toast.success("Questions enregistrées");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sectionTitle = (id: string) => survey.settings.sections.find((s) => s.id === id)?.title ?? id;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">
            {list.length} questions · {survey.settings.sections.length} section{survey.settings.sections.length > 1 ? "s" : ""}, puis le contact
          </h2>
          <span className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setEditing({
                index: -1,
                q: { id: "", section: survey.settings.sections.at(-1)?.id ?? "main", type: "single", label: "", required: false, options: [{ value: "a", label: "" }, { value: "b", label: "" }] },
              })
            }
          >
            <Plus className="h-4 w-4" /> Ajouter une question
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPreview(true)}>
            <Eye className="h-4 w-4" /> Aperçu
          </Button>
        </div>
        {survey.status === "PUBLISHED" ? (
          <p className="text-xs text-muted-foreground">Le sondage est publié : les changements s’appliquent dès l’enregistrement. Les réponses déjà reçues gardent leurs valeurs.</p>
        ) : null}

        <div ref={listRef} className="divide-y">
          {list.map((q, i) => {
            const cond = conditionLabel(q, list);
            return (
              <div key={q.id} data-q={q.id} className="grid grid-cols-[auto_24px_minmax(0,1fr)_auto] items-center gap-3 bg-card py-2.5 xl:grid-cols-[auto_24px_minmax(0,1fr)_120px_120px_220px_auto]">
                <div className="flex flex-col gap-0.5">
                  <button type="button" aria-label="Monter" disabled={i === 0} onClick={() => move(i, -1)} className="grid h-5 w-6 place-items-center rounded border transition-colors hover:bg-muted disabled:opacity-30">
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" aria-label="Descendre" disabled={i === list.length - 1} onClick={() => move(i, 1)} className="grid h-5 w-6 place-items-center rounded border transition-colors hover:bg-muted disabled:opacity-30">
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
                <span className="text-center text-sm font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{sectionTitle(q.section)}</p>
                  <p className="font-semibold">{q.label}</p>
                  {cond ? (
                    <p className="inline-flex items-center gap-1 text-xs text-emerald-700 xl:hidden">
                      <GitBranch className="h-3.5 w-3.5" />
                      {cond}
                    </p>
                  ) : null}
                  {q.options?.length ? <p className="truncate text-xs text-muted-foreground">{q.options.map((o) => o.label).join(" · ")}</p> : null}
                </div>
                <span className="hidden xl:block"><span className="rounded-md bg-muted px-2 py-0.5 text-xs">{QUESTION_TYPE_LABEL[q.type]}</span></span>
                <label className="hidden items-center gap-2 text-xs text-muted-foreground xl:flex" htmlFor={`req-${q.id}`}>
                  <Switch id={`req-${q.id}`} checked={q.required} onCheckedChange={(v) => setList((l) => l.map((x, k) => (k === i ? { ...x, required: v } : x)))} />
                  Obligatoire
                </label>
                <span className="hidden text-xs xl:block">
                  {cond ? <span className="inline-flex items-center gap-1 text-emerald-700"><GitBranch className="h-3.5 w-3.5" />{cond}</span> : <span className="text-muted-foreground">Toujours</span>}
                </span>
                <span className="flex">
                  <Button variant="ghost" size="sm" aria-label="Modifier" onClick={() => setEditing({ index: i, q })}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Supprimer"
                    disabled={list.some((x) => x.showIf?.questionId === q.id)}
                    title={list.some((x) => x.showIf?.questionId === q.id) ? "D’autres questions dépendent de celle-ci" : undefined}
                    onClick={() => setList((l) => l.filter((_, k) => k !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </span>
              </div>
            );
          })}
          <div className="grid grid-cols-[auto_24px_minmax(0,1fr)] items-center gap-3 py-2.5 opacity-80">
            <span className="w-6" />
            <span className="text-center text-sm font-semibold text-muted-foreground">C</span>
            <div>
              <p className="font-semibold">Contact : prénom + WhatsApp, avec accord</p>
              <p className="text-xs text-muted-foreground">Réglé dans Réglages. Sauté si l’app connaît déjà la personne.</p>
            </div>
          </div>
        </div>

        {dirty ? (
          <div className="ls-enter sticky bottom-3 flex items-center justify-end gap-2 rounded-lg border bg-background/95 p-2 shadow-sm backdrop-blur">
            <span className="mr-auto pl-2 text-sm text-muted-foreground">Modifications non enregistrées</span>
            <Button variant="ghost" size="sm" onClick={() => setList(survey.questions)}>
              <Undo2 className="h-4 w-4" /> Annuler
            </Button>
            <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
              <Save className="h-4 w-4" /> Enregistrer
            </Button>
          </div>
        ) : null}
      </CardContent>

      <QuestionDialog
        survey={survey}
        list={list}
        editing={editing}
        onClose={() => setEditing(null)}
        onSave={(q) => {
          setList((l) => (editing && editing.index >= 0 ? l.map((x, k) => (k === editing.index ? q : x)) : [...l, q]));
          setEditing(null);
        }}
      />

      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="max-w-[420px] p-4">
          <DialogHeader>
            <DialogTitle>Aperçu (375 px)</DialogTitle>
            <DialogDescription>Rien n’est envoyé. Les modifications non enregistrées sont incluses.</DialogDescription>
          </DialogHeader>
          <div className="mx-auto h-[min(680px,calc(100dvh-170px))] w-full max-w-[375px] overflow-y-auto rounded-[28px] border-8 border-slate-900">
            <SurveyForm
              framed
              preview
              orgName={orgName}
              survey={{
                title: survey.title,
                intro: survey.intro,
                questions: list,
                settings: survey.settings,
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function QuestionDialog({
  survey,
  list,
  editing,
  onClose,
  onSave,
}: {
  survey: SurveyDetail;
  list: SurveyQuestion[];
  editing: { index: number; q: SurveyQuestion } | null;
  onClose: () => void;
  onSave: (q: SurveyQuestion) => void;
}) {
  const [q, setQ] = useState<SurveyQuestion | null>(null);
  const [optionsText, setOptionsText] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!editing) return;
    setQ(editing.q);
    setOptionsText((editing.q.options ?? []).map((o) => o.label).join("\n"));
    setError("");
  }, [editing]);
  if (!q) return null;

  const position = editing && editing.index >= 0 ? editing.index : list.length;
  const parents = list.slice(0, position).filter((p) => (p.type === "single" || p.type === "multi") && p.id !== q.id);
  const parent = parents.find((p) => p.id === q.showIf?.questionId);
  const needsOptions = q.type === "single" || q.type === "multi";

  const submit = () => {
    const label = q.label.trim();
    if (!label) return setError("Écrivez la question.");
    let options = q.options;
    if (needsOptions) {
      const labels = optionsText.split("\n").map((s) => s.trim()).filter(Boolean);
      if (labels.length < 2) return setError("Au moins 2 choix, un par ligne.");
      const old = q.options ?? [];
      const taken = new Set<string>();
      // Keep the stored value of a choice whose wording did not change, so old answers stay readable
      options = labels.map((l, k) => {
        const same = old.find((o) => o.label === l) ?? (old[k] && !labels.includes(old[k].label) ? old[k] : undefined);
        const value = same?.value && !taken.has(same.value) ? same.value : /^autre$/i.test(l) ? OTHER : slugId(l, taken);
        taken.add(value);
        return { value, label: l };
      });
    }
    const taken = new Set(list.filter((x) => x.id !== editing?.q.id).map((x) => x.id));
    const id = q.id || slugId(label, taken);
    onSave({
      ...q,
      id,
      label,
      help: q.help?.trim() || undefined,
      options: needsOptions ? options : undefined,
      allowOther: needsOptions && options?.some((o) => o.value === OTHER) ? q.allowOther : undefined,
      showIf: q.showIf?.questionId && q.showIf.anyOf.length ? q.showIf : undefined,
    });
  };

  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing && editing.index >= 0 ? "Modifier la question" : "Nouvelle question"}</DialogTitle>
          <DialogDescription>Elle s’affiche telle quelle sur le téléphone. Tutoyez, restez court.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="q-label">Question</Label>
            <Input id="q-label" value={q.label} maxLength={200} onChange={(e) => setQ({ ...q, label: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="q-help">Aide (optionnelle)</Label>
            <Input id="q-help" value={q.help ?? ""} maxLength={300} onChange={(e) => setQ({ ...q, help: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="q-type">Type</Label>
              <select id="q-type" className={cn(selectClass, "w-full")} value={q.type} onChange={(e) => setQ({ ...q, type: e.target.value as QuestionType })}>
                {(Object.keys(QUESTION_TYPE_LABEL) as QuestionType[]).map((t) => (
                  <option key={t} value={t}>{QUESTION_TYPE_LABEL[t]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="q-section">Section</Label>
              <select id="q-section" className={cn(selectClass, "w-full")} value={q.section} onChange={(e) => setQ({ ...q, section: e.target.value })}>
                {survey.settings.sections.map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </div>
          </div>
          {needsOptions ? (
            <div className="ls-enter space-y-1.5">
              <Label htmlFor="q-options">Choix (un par ligne)</Label>
              <Textarea id="q-options" rows={5} value={optionsText} onChange={(e) => setOptionsText(e.target.value)} />
              <label className="flex items-center gap-2 text-sm" htmlFor="q-other">
                <Switch id="q-other" checked={!!q.allowOther} onCheckedChange={(v) => setQ({ ...q, allowOther: v })} />
                Champ libre quand « Autre » est choisi
              </label>
            </div>
          ) : null}
          <label className="flex items-center gap-2 text-sm" htmlFor="q-required">
            <Switch id="q-required" checked={q.required} onCheckedChange={(v) => setQ({ ...q, required: v })} />
            Obligatoire
          </label>
          <div className="space-y-1.5">
            <Label htmlFor="q-cond">Afficher</Label>
            <select
              id="q-cond"
              className={cn(selectClass, "w-full")}
              value={q.showIf?.questionId ?? ""}
              onChange={(e) => setQ({ ...q, showIf: e.target.value ? { questionId: e.target.value, anyOf: [] } : undefined })}
            >
              <option value="">Toujours</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>Seulement si « {p.label} » =</option>
              ))}
            </select>
            {parent ? (
              <div className="ls-enter flex flex-wrap gap-1.5 pt-1">
                {(parent.options ?? []).map((o) => {
                  const on = q.showIf?.anyOf.includes(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() =>
                        setQ({
                          ...q,
                          showIf: { questionId: parent.id, anyOf: on ? q.showIf!.anyOf.filter((v) => v !== o.value) : [...(q.showIf?.anyOf ?? []), o.value] },
                        })
                      }
                      className={cn("rounded-full border px-3 py-1 text-xs transition-colors", on ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "hover:bg-muted")}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">Seules les questions placées avant peuvent servir de condition.</p>
          </div>
          {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={submit}>{editing && editing.index >= 0 ? "Appliquer" : "Ajouter"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
