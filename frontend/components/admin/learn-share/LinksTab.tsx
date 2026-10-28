"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Facebook, Link as LinkIcon, MessageCircle, QrCode, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { surveysApi } from "@/lib/api/resources";
import { cn } from "@/lib/utils";
import { LINK_PRESETS, surveyUrl, type LinkPresetKey, type SurveyDetail, type SurveyLink } from "@/lib/surveys";
import { CopyButton, QrDialog, selectClass, SourceTag } from "./shared";

export function LinksTab({ survey, orgSlug }: { survey: SurveyDetail; orgSlug: string }) {
  const qc = useQueryClient();
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const defaultCampaign = `${survey.slug.replace(/-/g, "_")}_${new Date().getFullYear()}`;
  const [preset, setPreset] = useState<LinkPresetKey>("instagram_story");
  const [label, setLabel] = useState("");
  const [campaign, setCampaign] = useState(defaultCampaign);
  const [fresh, setFresh] = useState<string | null>(null);
  const [qr, setQr] = useState<{ title: string; url: string; sub?: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const refresh = (links: SurveyLink[]) => {
    qc.setQueryData(["survey", survey.id], (old: SurveyDetail | undefined) => (old ? { ...old, links } : old));
    qc.invalidateQueries({ queryKey: ["survey-dashboard", survey.id] });
  };

  const create = useMutation({
    mutationFn: () => surveysApi.createLink(survey.id, { preset, label: label.trim() || undefined, campaign: campaign.trim() || undefined }),
    onSuccess: (links) => {
      const newest = links.reduce((a, b) => (a.createdAt > b.createdAt ? a : b), links[0]);
      setFresh(newest?.id ?? null);
      refresh(links);
      setLabel("");
      toast.success("Lien créé");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (linkId: string) => surveysApi.deleteLink(survey.id, linkId),
    onSuccess: (links) => {
      refresh(links);
      setConfirmDelete(null);
      toast.success("Lien supprimé. Les réponses gardent leur source.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const base = surveyUrl(origin, orgSlug, survey.slug);
  const notLive = survey.status !== "PUBLISHED";

  return (
    <div className="space-y-4">
      {notLive ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Le sondage n’est pas publié : les liens afficheront « introuvable » ou « fermé » tant qu’il n’est pas publié.
        </p>
      ) : null}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">Nouveau lien</h2>
            <p className="text-xs text-muted-foreground">
              Chaque lien a son code. Une personne reste comptée pour le premier lien ouvert pendant {survey.settings.attributionDays} jours.
            </p>
          </div>
          <form
            className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)_auto] md:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <label className="space-y-1 text-xs font-semibold text-muted-foreground" htmlFor="nl-preset">
              Source
              <select id="nl-preset" className={cn(selectClass, "w-full font-normal text-foreground")} value={preset} onChange={(e) => setPreset(e.target.value as LinkPresetKey)}>
                {LINK_PRESETS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs font-semibold text-muted-foreground" htmlFor="nl-label">
              Nom du lien
              <Input id="nl-label" className="h-9 font-normal" placeholder={preset === "club" ? "Ex. Club IEEE ENIT" : "Ex. Story semaine 2"} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} />
            </label>
            <label className="space-y-1 text-xs font-semibold text-muted-foreground" htmlFor="nl-campaign">
              Campagne (utm_campaign)
              <Input id="nl-campaign" className="h-9 font-mono text-xs font-normal" value={campaign} onChange={(e) => setCampaign(e.target.value)} maxLength={80} />
            </label>
            <Button type="submit" disabled={create.isPending}>
              <LinkIcon className="h-4 w-4" /> Créer le lien
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <h2 className="font-semibold">Liens ({survey.links.length})</h2>
            <span className="text-xs text-muted-foreground">Le lien simple, sans code, compte en direct_or_unknown</span>
          </div>
          <div className="divide-y">
            {survey.links.map((l) => {
              const url = surveyUrl(origin, orgSlug, survey.slug, l);
              const share = `${survey.title} : 2 minutes, sans compte. ${url}`;
              return (
                <div key={l.id} className={cn("grid gap-2 py-4 md:grid-cols-[minmax(0,1fr)_auto]", fresh === l.id && "ls-enter")}>
                  <div className="flex flex-wrap items-center gap-2">
                    <b>{l.label || l.code}</b>
                    <span className="rounded-md bg-muted px-1.5 py-0.5"><SourceTag source={l.source ?? l.channel} medium={l.medium} /></span>
                    {fresh === l.id ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Nouveau</span> : null}
                  </div>
                  <div className="flex gap-5 text-right tabular-nums md:row-span-1">
                    {(
                      [
                        [l.opens, "clics"],
                        [l.visitors, "visiteurs"],
                        [l.responses, "réponses"],
                      ] as const
                    ).map(([n, t]) => (
                      <span key={t} className="text-xs text-muted-foreground">
                        <b className="block text-lg text-foreground">{n}</b>
                        {t}
                      </span>
                    ))}
                  </div>
                  <p className="break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs md:col-span-2">{url}</p>
                  <div className="flex flex-wrap gap-2 md:col-span-2">
                    <CopyButton text={url} />
                    <Button variant="outline" size="sm" onClick={() => setQr({ title: l.label || "QR du lien", url, sub: `${l.source ?? ""} · ${l.medium ?? ""}` })}>
                      <QrCode className="h-4 w-4" /> QR
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="h-4 w-4" /> Partager WhatsApp
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">
                        <Facebook className="h-4 w-4" /> Partager Facebook
                      </a>
                    </Button>
                    <span className="flex-1" />
                    {confirmDelete === l.id ? (
                      <span className="ls-enter flex items-center gap-2 text-xs">
                        Supprimer ce lien ?
                        <Button variant="destructive" size="sm" disabled={remove.isPending} onClick={() => remove.mutate(l.id)}>Supprimer</Button>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(null)}>Annuler</Button>
                      </span>
                    ) : (
                      <Button variant="ghost" size="sm" aria-label="Supprimer le lien" onClick={() => setConfirmDelete(l.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {!survey.links.length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Aucun lien. Créez-en un par endroit où vous partagez (story, groupe, affiche…).</p>
            ) : null}
          </div>
          <div className="mt-2 space-y-2 border-t pt-4">
            <p className="text-sm font-semibold">Lien simple</p>
            <p className="break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs">{base}</p>
            <div className="flex gap-2">
              <CopyButton text={base} />
              <Button variant="outline" size="sm" onClick={() => setQr({ title: "QR du sondage", url: base, sub: "Lien simple : les réponses comptent en direct_or_unknown." })}>
                <QrCode className="h-4 w-4" /> QR
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <QrDialog open={!!qr} onClose={() => setQr(null)} title={qr?.title ?? ""} subtitle={qr?.sub} url={qr?.url ?? ""} />
    </div>
  );
}
