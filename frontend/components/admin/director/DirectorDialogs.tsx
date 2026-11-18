"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DIALOG_CLASS } from "@/components/admin/OutreachCampaigns";
import { cn } from "@/lib/utils";
import {
  DIRECTOR_KEY,
  directorApi,
  type DirectorCorner,
  type DirectorEntry,
  type DirectorEntryKind,
  type DirectorOverview,
} from "@/lib/api/director";

export const KINDS: Array<{ id: DirectorEntryKind; label: string; hint: string }> = [
  { id: "DECISION", label: "Décision", hint: "ce que tu as choisi" },
  { id: "FACT", label: "Fait", hint: "ce qui s'est passé" },
  { id: "LESSON", label: "Leçon", hint: "ce qu'on a appris" },
  { id: "TEST", label: "Test", hint: "ce qu'on essaie" },
];

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function Shell({ open, onClose, title, sub, children }: { open: boolean; onClose: () => void; title: string; sub: string; children: React.ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(DIALOG_CLASS, "max-w-2xl")}>
        <div className="shrink-0 bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 px-6 pb-5 pt-5 text-white">
          <DialogTitle className="pr-10 text-xl font-extrabold text-white">{title}</DialogTitle>
          <DialogDescription className="mt-1 text-[13px] text-indigo-100">{sub}</DialogDescription>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

/** Add or change one memory note. */
export function EntryDialog({
  open,
  entry,
  corner,
  corners,
  onClose,
}: {
  open: boolean;
  entry: DirectorEntry | null;
  corner: string | null;
  corners: DirectorCorner[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayKey());
  const [kind, setKind] = useState<DirectorEntryKind>("DECISION");
  const [cornerId, setCornerId] = useState("clients");
  const [text, setText] = useState("");
  const [detail, setDetail] = useState("");
  useEffect(() => {
    if (!open) return;
    setDate(entry?.date ?? todayKey());
    setKind(entry?.kind ?? "DECISION");
    setCornerId(entry?.corner ?? corner ?? "clients");
    setText(entry?.text ?? "");
    setDetail(entry?.detail ?? "");
  }, [open, entry, corner]);

  const save = useMutation({
    mutationFn: () => {
      const data = { date, kind, corner: cornerId, text, detail: detail || null };
      return entry ? directorApi.updateEntry(entry.id, data) : directorApi.createEntry(data);
    },
    onSuccess: () => {
      toast.success(entry ? "Note modifiée" : "Noté dans la mémoire");
      qc.invalidateQueries({ queryKey: DIRECTOR_KEY });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: () => directorApi.deleteEntry(entry!.id),
    onSuccess: () => {
      toast.success("Note supprimée");
      qc.invalidateQueries({ queryKey: DIRECTOR_KEY });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Shell open={open} onClose={onClose} title={entry ? "Modifier la note" : "Noter un changement"} sub="Claude lit chaque note avant de conseiller. Note-le le jour même.">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Type de note">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            role="radio"
            aria-checked={kind === k.id}
            onClick={() => setKind(k.id)}
            className={cn(
              "min-h-11 rounded-xl border px-3.5 text-left text-sm transition-colors duration-150 motion-reduce:transition-none",
              kind === k.id ? "border-indigo-600 bg-indigo-600 text-white" : "bg-white hover:border-indigo-300",
            )}
          >
            <b>{k.label}</b> <span className={kind === k.id ? "text-indigo-100" : "text-slate-500"}>· {k.hint}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="entry-date">Date</Label>
          <Input id="entry-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="entry-corner">Coin du business</Label>
          <select
            id="entry-corner"
            value={cornerId}
            onChange={(e) => setCornerId(e.target.value)}
            className="h-11 w-full rounded-md border bg-white px-3 text-sm"
          >
            {corners.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="entry-text">Quoi ?</Label>
        <Input id="entry-text" value={text} maxLength={300} onChange={(e) => setText(e.target.value)} placeholder="ex. Tarif 1h supprimé" className="h-11" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="entry-detail">Détail (facultatif)</Label>
        <Textarea id="entry-detail" value={detail} maxLength={500} onChange={(e) => setDetail(e.target.value)} placeholder="Pourquoi, combien, ce que ça change" rows={3} />
      </div>
      <div className="flex flex-wrap justify-between gap-2 pt-1">
        {entry ? (
          <Button variant="outline" className="h-11 rounded-xl text-rose-700" disabled={remove.isPending} onClick={() => remove.mutate()}>
            Supprimer
          </Button>
        ) : (
          <span />
        )}
        <Button className="h-11 rounded-xl px-5 font-bold" disabled={!text.trim() || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          {entry ? "Enregistrer" : "Noter"}
        </Button>
      </div>
    </Shell>
  );
}

/** Paste many notes at once (one per line), e.g. from the analysis doc. */
export function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const run = useMutation({
    mutationFn: () => directorApi.importEntries(text),
    onSuccess: (r) => {
      toast.success(
        `${r.added} note${r.added > 1 ? "s" : ""} ajoutée${r.added > 1 ? "s" : ""}` +
          (r.newCorners.length ? ` · nouveaux coins : ${r.newCorners.map((c) => c.name).join(", ")}` : "") +
          (r.skipped.length ? ` · ${r.skipped.length} ligne${r.skipped.length > 1 ? "s" : ""} pas comprise${r.skipped.length > 1 ? "s" : ""}` : ""),
      );
      qc.invalidateQueries({ queryKey: DIRECTOR_KEY });
      if (!r.skipped.length) {
        setText("");
        onClose();
      } else setText(r.skipped.join("\n"));
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Shell open={open} onClose={onClose} title="Importer des notes" sub="Une note par ligne. Les lignes pas comprises restent ici pour être corrigées.">
      <p className="rounded-xl border bg-white px-3.5 py-2.5 font-mono text-[13px] text-slate-700">
        2026-11-10 | Décision | Prix &amp; offres | Tarif 1h supprimé | rapportait 39 DT/jour
      </p>
      <p className="text-[13px] text-slate-600">
        Date · type (Décision, Fait, Leçon, Test) · coin · quoi · détail facultatif. Un coin inconnu devient un de tes coins.
      </p>
      <Textarea aria-label="Notes à importer" value={text} onChange={(e) => setText(e.target.value)} rows={10} className="font-mono text-[13px]" />
      <div className="flex justify-end">
        <Button className="h-11 rounded-xl px-5 font-bold" disabled={!text.trim() || run.isPending} onClick={() => run.mutate()}>
          {run.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          Importer
        </Button>
      </div>
    </Shell>
  );
}

/** Profit goal per month and the date to reach it. */
export function GoalDialog({ open, goal, onClose }: { open: boolean; goal: DirectorOverview["goal"] | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [profit, setProfit] = useState("");
  const [date, setDate] = useState("");
  useEffect(() => {
    if (!open || !goal) return;
    setProfit(String(goal.profit));
    setDate(goal.date ?? "");
  }, [open, goal]);
  const save = useMutation({
    mutationFn: () => directorApi.setGoal({ profit: Number(profit), date: date || null }),
    onSuccess: (data) => {
      qc.setQueryData(DIRECTOR_KEY, data);
      toast.success("Objectif enregistré");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Shell open={open} onClose={onClose} title="Objectif de bénéfice" sub="Le Directeur mesure tout par rapport à cet objectif.">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="goal-profit">Bénéfice par mois (DT)</Label>
          <Input id="goal-profit" type="number" min={1} value={profit} onChange={(e) => setProfit(e.target.value)} className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="goal-date">À atteindre pour le</Label>
          <Input id="goal-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11" />
        </div>
      </div>
      <div className="flex justify-end">
        <Button className="h-11 rounded-xl px-5 font-bold" disabled={!Number(profit) || save.isPending} onClick={() => save.mutate()}>
          Enregistrer
        </Button>
      </div>
    </Shell>
  );
}

/** A corner of the business the owner wants to follow (partenariats, équipe…). */
export function CornerDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  useEffect(() => {
    if (open) setName("");
  }, [open]);
  const save = useMutation({
    mutationFn: () => directorApi.addCorner(name),
    onSuccess: (c) => {
      toast.success(`Coin « ${c.name} » ajouté`);
      qc.invalidateQueries({ queryKey: DIRECTOR_KEY });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Shell open={open} onClose={onClose} title="Ajouter un coin" sub="Un domaine du business à suivre : équipe, partenariats, salle de réunion…">
      <div className="space-y-1.5">
        <Label htmlFor="corner-name">Nom du coin</Label>
        <Input id="corner-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="ex. Partenariats" className="h-11" />
      </div>
      <div className="flex justify-end">
        <Button className="h-11 rounded-xl px-5 font-bold" disabled={!name.trim() || save.isPending} onClick={() => save.mutate()}>
          Ajouter
        </Button>
      </div>
    </Shell>
  );
}
