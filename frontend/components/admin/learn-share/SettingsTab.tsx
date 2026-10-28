"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { surveysApi } from "@/lib/api/resources";
import { cn } from "@/lib/utils";
import { surveyUrl, type ContactMode, type DuplicatePolicy, type SurveyDetail } from "@/lib/surveys";

const CONTACT: Array<[ContactMode, string, string]> = [
  ["NONE", "Aucun", "La section contact est masquée. Tout reste anonyme."],
  ["OPTIONAL", "Optionnel", "Prénom et WhatsApp proposés, jamais exigés."],
  ["REQUIRED", "Obligatoire", "WhatsApp exigé. Moins de réponses, plus de suivi."],
];
const DUPS: Array<[DuplicatePolicy, string, string]> = [
  ["LATEST_PER_BROWSER", "Dernière réponse par navigateur", "Si la même personne répond deux fois sur le même téléphone, seule la dernière compte. L’ancienne reste visible."],
  ["KEEP_ALL", "Garder tout", "Chaque envoi compte comme une réponse."],
];

function Segmented<T extends string>({ id, value, options, onChange }: { id: string; value: T; options: Array<[T, string, string]>; onChange: (v: T) => void }) {
  return (
    <div id={id} role="radiogroup" className="inline-flex flex-wrap gap-1 rounded-lg border bg-muted p-1">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-[background-color,color,box-shadow] duration-200",
            value === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function SettingsTab({ survey, orgSlug }: { survey: SurveyDetail; orgSlug: string }) {
  const qc = useQueryClient();
  const router = useRouter();
  const init = () => ({
    title: survey.title,
    slug: survey.slug,
    intro: survey.intro ?? "",
    closesAt: survey.closesAt ? survey.closesAt.slice(0, 10) : "",
    contactMode: survey.settings.contactMode,
    duplicatePolicy: survey.settings.duplicatePolicy,
    attributionDays: String(survey.settings.attributionDays),
    successMessage: survey.settings.successMessage,
  });
  const [f, setF] = useState(init);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => setF(init()), [survey]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: () =>
      surveysApi.update(survey.id, {
        title: f.title.trim(),
        slug: f.slug.trim(),
        intro: f.intro.trim(),
        closesAt: f.closesAt ? new Date(`${f.closesAt}T23:59:00`).toISOString() : null,
        settings: {
          contactMode: f.contactMode,
          duplicatePolicy: f.duplicatePolicy,
          attributionDays: Number(f.attributionDays) || 30,
          successMessage: f.successMessage.trim(),
        },
      }),
    onSuccess: (s) => {
      qc.setQueryData(["survey", survey.id], s);
      qc.invalidateQueries({ queryKey: ["surveys"] });
      toast.success("Réglages enregistrés");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: () => surveysApi.remove(survey.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["surveys"] });
      toast.success("Brouillon supprimé");
      router.replace("/learn-share");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const slugOk = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(f.slug);

  return (
    <Card>
      <CardContent className="p-5">
        <form
          className="grid gap-6 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!slugOk) return toast.error("Adresse : lettres minuscules, chiffres et tirets");
            save.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="s-title">Titre</Label>
            <Input id="s-title" value={f.title} maxLength={120} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-slug">Adresse</Label>
            <Input id="s-slug" value={f.slug} maxLength={60} onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase() })} aria-invalid={!slugOk} />
            <p className="break-all font-mono text-xs text-muted-foreground">{surveyUrl(origin, orgSlug, f.slug || "…")}</p>
            {survey.status !== "DRAFT" && f.slug !== survey.slug ? (
              <p className="text-xs font-medium text-amber-700">Les liens et QR déjà partagés ne marcheront plus.</p>
            ) : null}
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="s-intro">Introduction</Label>
            <Textarea id="s-intro" rows={3} maxLength={1000} value={f.intro} onChange={(e) => setF({ ...f, intro: e.target.value })} />
            <p className="text-xs text-muted-foreground">Premier écran du sondage. Deux phrases suffisent.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-close">Date de fermeture</Label>
            <Input id="s-close" type="date" className="w-48" value={f.closesAt} onChange={(e) => setF({ ...f, closesAt: e.target.value })} />
            <p className="text-xs text-muted-foreground">Optionnelle. Après cette date, le lien affiche « sondage fermé ». L’ouverture se fait avec « Publier ».</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-days">Durée d’attribution</Label>
            <div className="flex items-center gap-2">
              <Input id="s-days" type="number" min={1} max={180} className="w-24" value={f.attributionDays} onChange={(e) => setF({ ...f, attributionDays: e.target.value })} />
              <span className="text-sm">jours</span>
            </div>
            <p className="text-xs text-muted-foreground">Une personne reste comptée pour le premier lien ouvert pendant cette durée, même si elle revient par le lien simple.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-contact">Contact</Label>
            <Segmented id="s-contact" value={f.contactMode} options={CONTACT} onChange={(v) => setF({ ...f, contactMode: v })} />
            <p className="text-xs text-muted-foreground">{CONTACT.find((c) => c[0] === f.contactMode)?.[2]}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-dup">Doublons</Label>
            <Segmented id="s-dup" value={f.duplicatePolicy} options={DUPS} onChange={(v) => setF({ ...f, duplicatePolicy: v })} />
            <p className="text-xs text-muted-foreground">{DUPS.find((c) => c[0] === f.duplicatePolicy)?.[2]}</p>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="s-success">Message de remerciement</Label>
            <Input id="s-success" maxLength={300} value={f.successMessage} onChange={(e) => setF({ ...f, successMessage: e.target.value })} />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 md:col-span-2">
            {survey.status === "DRAFT" ? (
              confirmDelete ? (
                <span className="ls-enter mr-auto flex items-center gap-2 text-sm">
                  Supprimer ce brouillon ?
                  <Button type="button" variant="destructive" size="sm" disabled={remove.isPending} onClick={() => remove.mutate()}>Supprimer</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Annuler</Button>
                </span>
              ) : (
                <Button type="button" variant="ghost" size="sm" className="mr-auto text-muted-foreground" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-4 w-4" /> Supprimer le brouillon
                </Button>
              )
            ) : null}
            <Button type="submit" disabled={save.isPending}>
              <Check className="h-4 w-4" /> Enregistrer
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
