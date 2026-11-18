"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Check, FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { DIALOG_CLASS } from "@/components/admin/OutreachCampaigns";
import { DIRECTOR_KEY, directorApi, type DirectorEntry, type DirectorUpdatePlan } from "@/lib/api/director";
import { domainLabel } from "@/components/admin/director/LessonsPanel";
import { cn } from "@/lib/utils";

/** Downloads the Directeur file for a Claude chat (memory + numbers + answer format). */
export function useExportForClaude() {
  return useMutation({
    mutationFn: directorApi.exportForClaude,
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `directeur-${data.exportedAt.slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Fichier prêt : donne-le à Claude, puis importe sa réponse ici");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

const COUNT = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
const VERDICT_UI: Record<DirectorUpdatePlan["lessons"][number]["verdict"], { label: string; pill: string }> = {
  ADOPT: { label: "Adoptée", pill: "bg-emerald-100 text-emerald-800" },
  ADAPT: { label: "Adaptée", pill: "bg-indigo-100 text-indigo-800" },
  TEST: { label: "À tester", pill: "bg-amber-100 text-amber-900" },
  REJECT: { label: "Refusée", pill: "bg-rose-100 text-rose-800" },
  SAME: { label: "Déjà connue", pill: "bg-slate-100 text-slate-700" },
};

/** Paste or open Claude's answer, see what changes, then save it. */
export function ClaudeUpdateDialog({
  open,
  onClose,
  memory,
  cornerName,
}: {
  open: boolean;
  onClose: () => void;
  memory: DirectorEntry[];
  cornerName: (id: string) => string;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [plan, setPlan] = useState<DirectorUpdatePlan | null>(null);
  useEffect(() => {
    if (!open) {
      setText("");
      setPlan(null);
    }
  }, [open]);

  const preview = useMutation({
    mutationFn: () => directorApi.previewUpdate(text),
    onSuccess: setPlan,
    onError: (e: Error) => toast.error(e.message),
  });
  const apply = useMutation({
    mutationFn: () => directorApi.applyUpdate(text),
    onSuccess: (r) => {
      toast.success(
        [
          r.added && COUNT(r.added, "note ajoutée", "notes ajoutées"),
          r.updated && COUNT(r.updated, "note modifiée", "notes modifiées"),
          r.removed && COUNT(r.removed, "note retirée", "notes retirées"),
          r.corners && COUNT(r.corners, "coin ajouté", "coins ajoutés"),
          r.questions && COUNT(r.questions, "question", "questions"),
          r.priorities && COUNT(r.priorities, "priorité", "priorités"),
          r.drafts && COUNT(r.drafts, "brouillon à valider", "brouillons à valider"),
          r.watches && COUNT(r.watches, "chiffre suivi", "chiffres suivis"),
          r.looks && COUNT(r.looks, "demande de données", "demandes de données"),
          r.needs && COUNT(r.needs, "besoin à coder", "besoins à coder"),
          r.lessons && COUNT(r.lessons, "idée jugée", "idées jugées"),
          r.confidence && COUNT(r.confidence, "confiance mise à jour", "confiances mises à jour"),
          r.replies && COUNT(r.replies, "réponse à ta contestation", "réponses à tes contestations"),
          !r.priorities && r.brief && "priorités de la semaine",
        ]
          .filter(Boolean)
          .join(" · ") || "Rien à changer",
      );
      qc.invalidateQueries({ queryKey: DIRECTOR_KEY });
      qc.invalidateQueries({ queryKey: ["advisor"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const textOf = (id: string) => memory.find((m) => m.id === id)?.text ?? id;
  const stale = plan?.basedOn && Date.now() - new Date(plan.basedOn).getTime() > 7 * 86_400_000;
  const empty =
    plan && !plan.add.length && !plan.update.length && !plan.remove.length && !plan.corners.length && !plan.questions.length && !plan.priorities.length && !plan.summary && !plan.look.length && !plan.needs.length && !plan.lessons.length && !plan.confidence.length && !plan.replies.length;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(DIALOG_CLASS, "max-w-3xl")}>
        <div className="shrink-0 bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 px-6 pb-5 pt-5 text-white">
          <DialogTitle className="pr-10 text-xl font-extrabold text-white">Importer la réponse de Claude</DialogTitle>
          <DialogDescription className="mt-1 text-[13px] text-indigo-100">
            Colle le JSON « directeur-update/v2 ». L’app vérifie tout et te montre les changements avant d’enregistrer.
          </DialogDescription>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
          {!plan ? (
            <>
              <Textarea
                aria-label="Réponse de Claude"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={12}
                placeholder='{ "format": "directeur-update/v2", … }'
                className="font-mono text-[13px]"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl border bg-white px-4 text-sm font-semibold hover:border-indigo-300">
                  <FileUp className="h-4 w-4" />
                  Ouvrir un fichier .json
                  <input
                    type="file"
                    accept="application/json,.json,.txt"
                    className="sr-only"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) setText(await f.text());
                    }}
                  />
                </label>
                <Button className="h-11 rounded-xl px-5 font-bold" disabled={!text.trim() || preview.isPending} onClick={() => preview.mutate()}>
                  {preview.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                  Vérifier
                </Button>
              </div>
            </>
          ) : (
            <div className="animate-in fade-in-0 slide-in-from-bottom-1 space-y-4 duration-300 motion-reduce:animate-none">
              {stale ? (
                <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  Cette réponse part d’un export de plus de 7 jours. Les chiffres ont pu changer.
                </p>
              ) : null}
              {plan.summary || plan.priorities.length ? (
                <section className="space-y-2 rounded-2xl border bg-white p-4">
                  <h3 className="font-extrabold">Priorités de la semaine</h3>
                  {plan.summary ? <p className="text-sm text-slate-700">{plan.summary}</p> : null}
                  <ol className="list-decimal space-y-2 pl-5 text-sm">
                    {plan.priorities.map((p) => (
                      <li key={p.title}>
                        <b>{p.title}</b> <span className="text-slate-500">· {cornerName(p.corner)}</span>
                        {p.legs.length || p.watch.length ? (
                          <span className="block text-[13px] text-slate-600">
                            {[
                              p.legs.length && `À valider : ${p.legs.map((l) => l.label).join(", ")}`,
                              p.watch.length && `L’app suit : ${p.watch.map((w) => w.label ?? w.eye).join(", ")}`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                  {plan.priorities.length ? (
                    <p className="text-[13px] text-slate-500">Elles remplacent les priorités en cours (leurs suivis continuent).</p>
                  ) : null}
                </section>
              ) : null}
              {plan.add.length ? (
                <section className="space-y-2 rounded-2xl border bg-white p-4">
                  <h3 className="font-extrabold">{COUNT(plan.add.length, "note à ajouter", "notes à ajouter")}</h3>
                  <ul className="space-y-1 text-sm">
                    {plan.add.map((a, k) => (
                      <li key={k}>
                        <span className="text-slate-500">{a.date} · </span>
                        <b>{a.text}</b>
                        <span className="text-slate-500"> · {plan.corners.find((c) => c.id === a.corner)?.name ?? cornerName(a.corner)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {plan.update.length || plan.remove.length ? (
                <section className="space-y-2 rounded-2xl border bg-white p-4">
                  <h3 className="font-extrabold">Notes changées</h3>
                  <ul className="space-y-1 text-sm">
                    {plan.update.map((u) => (
                      <li key={u.id}>
                        Modifiée : <b>{textOf(u.id)}</b>
                        {u.text ? <span className="text-slate-500"> → {u.text}</span> : null}
                      </li>
                    ))}
                    {plan.remove.map((id) => (
                      <li key={id} className="text-rose-800">
                        Retirée : <b>{textOf(id)}</b>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {plan.lessons.length ? (
                <section className="space-y-2 rounded-2xl border bg-white p-4">
                  <h3 className="font-extrabold">Ce que le directeur a jugé</h3>
                  <ul className="space-y-2">
                    {plan.lessons.map((v) => (
                      <li key={v.ref} className="space-y-1 rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", VERDICT_UI[v.verdict].pill)}>{VERDICT_UI[v.verdict].label}</span>
                          <span className="text-xs text-slate-500">{domainLabel(v.domain)}</span>
                        </span>
                        {v.claim !== v.rule ? <span className="block text-[13px] text-slate-500">Le texte dit : {v.claim}</span> : null}
                        <span className="block font-semibold">{v.verdict === "SAME" ? `Déjà connue : ${textOf(v.sameAs ?? "")}` : v.rule}</span>
                        {v.why ? <span className="block text-slate-700">{v.why}</span> : null}
                        {v.changed ? <span className="block text-slate-700">Changé : {v.changed}</span> : null}
                        {v.changeMind ? <span className="block text-slate-700">Me ferait changer d’avis : {v.changeMind}</span> : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {plan.confidence.length || plan.replies.length ? (
                <section className="space-y-1 rounded-2xl border bg-white p-4 text-sm">
                  {plan.confidence.map((c) => (
                    <p key={c.id}>
                      <b>Confiance {c.confidence} :</b> {textOf(c.id)} <span className="text-slate-500">· {c.why}</span>
                    </p>
                  ))}
                  {plan.replies.map((r) => (
                    <p key={r.id}>
                      <b>Réponse à ta contestation :</b> {textOf(r.id)} <span className="text-slate-500">· {r.reply}</span>
                    </p>
                  ))}
                </section>
              ) : null}
              {plan.look.length || plan.needs.length ? (
                <section className="space-y-1 rounded-2xl border bg-white p-4 text-sm">
                  {plan.look.map((l) => (
                    <p key={`${l.eye}${l.from}`}>
                      <b>Données au prochain export :</b> {l.eye} du {l.from} au {l.to}
                      {l.why ? <span className="text-slate-500"> · {l.why}</span> : null}
                    </p>
                  ))}
                  {plan.needs.map((n) => (
                    <p key={n.title}>
                      <b>Besoin à coder :</b> {n.title} <span className="text-slate-500">· {n.problem}</span>
                    </p>
                  ))}
                </section>
              ) : null}
              {plan.corners.length || plan.questions.length ? (
                <section className="space-y-1 rounded-2xl border bg-white p-4 text-sm">
                  {plan.corners.length ? (
                    <p>
                      <b>Nouveaux coins :</b> {plan.corners.map((c) => c.name).join(", ")}
                    </p>
                  ) : null}
                  {plan.questions.map((q) => (
                    <p key={q}>
                      <b>Question :</b> {q}
                    </p>
                  ))}
                </section>
              ) : null}
              {plan.warnings.length ? (
                <section className="space-y-1 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                  <h3 className="font-extrabold">Ignoré</h3>
                  {plan.warnings.map((w) => (
                    <p key={w}>{w}</p>
                  ))}
                </section>
              ) : null}
              {empty ? <p className="text-sm text-slate-600">Rien à changer dans cette réponse.</p> : null}
              <div className="flex flex-wrap justify-between gap-2">
                <Button variant="outline" className="h-11 rounded-xl" onClick={() => setPlan(null)}>
                  Modifier le texte
                </Button>
                <Button className="h-11 rounded-xl px-5 font-bold" disabled={!!empty || apply.isPending} onClick={() => apply.mutate()}>
                  {apply.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
                  Enregistrer
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

