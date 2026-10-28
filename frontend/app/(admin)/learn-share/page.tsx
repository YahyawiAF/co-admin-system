"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Eye, FileText, GraduationCap, Lock, Pause, Play, Plus, QrCode, RotateCcw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { organizationsApi, surveysApi } from "@/lib/api/resources";
import { cn } from "@/lib/utils";
import { getAdminOrganizationId } from "@/lib/admin-org";
import { surveyUrl, type LearningSession, type SurveyDetail, type SurveyStatus } from "@/lib/surveys";
import { copyWithToast, QrDialog, selectClass, sessionUrl, StatusPill } from "@/components/admin/learn-share/shared";
import { ResultsTab } from "@/components/admin/learn-share/ResultsTab";
import { ResponsesTab } from "@/components/admin/learn-share/ResponsesTab";
import { LinksTab } from "@/components/admin/learn-share/LinksTab";
import { QuestionsTab } from "@/components/admin/learn-share/QuestionsTab";
import { SettingsTab } from "@/components/admin/learn-share/SettingsTab";
import { CreateSessionDialog, SessionsTab } from "@/components/admin/learn-share/SessionsTab";

const TABS = [
  ["resultats", "Résultats"],
  ["reponses", "Réponses"],
  ["liens", "Liens"],
  ["questions", "Questions"],
  ["reglages", "Réglages"],
  ["seances", "Séances"],
] as const;
type Tab = (typeof TABS)[number][0];

export default function LearnSharePage() {
  return (
    <Suspense fallback={<div className="text-muted-foreground">Chargement…</div>}>
      <LearnShare />
    </Suspense>
  );
}

function LearnShare() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const tabParam = params.get("tab");
  const tab: Tab = TABS.some(([k]) => k === tabParam) ? (tabParam as Tab) : "resultats";
  const [creating, setCreating] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [sessionFor, setSessionFor] = useState<string | null | undefined>(undefined);
  const [created, setCreated] = useState<LearningSession | null>(null);

  const { data: list, isLoading } = useQuery({ queryKey: ["surveys"], queryFn: surveysApi.list });
  const surveyId = params.get("survey") || list?.surveys[0]?.id || "";
  const { data: survey } = useQuery({
    queryKey: ["survey", surveyId],
    queryFn: () => surveysApi.get(surveyId),
    enabled: !!surveyId,
  });
  // Org slug for public links (the list answers it; fall back to the org record)
  const orgId = typeof window !== "undefined" ? getAdminOrganizationId() : null;
  const { data: orgs } = useQuery({ queryKey: ["organizations", "public"], queryFn: organizationsApi.list, staleTime: 300_000 });
  const orgSlug = list?.orgSlug || survey?.orgSlug || orgs?.find((o) => o.id === orgId)?.slug || "";
  const orgName = orgs?.find((o) => o.slug === orgSlug)?.name ?? "Collabora Hub";

  const go = (next: { survey?: string; tab?: Tab }) => {
    const q = new URLSearchParams();
    const s = next.survey ?? surveyId;
    const t = next.tab ?? tab;
    if (s) q.set("survey", s);
    if (t !== "resultats") q.set("tab", t);
    router.replace(`/learn-share${q.toString() ? `?${q}` : ""}`, { scroll: false });
  };

  const setStatus = useMutation({
    mutationFn: (status: SurveyStatus) => surveysApi.setStatus(surveyId, status),
    onSuccess: (s) => {
      qc.setQueryData(["survey", surveyId], s);
      qc.invalidateQueries({ queryKey: ["surveys"] });
      toast.success(
        { PUBLISHED: "Sondage publié : le lien est ouvert", PAUSED: "Sondage en pause : le lien affiche « fermé »", CLOSED: "Sondage fermé : plus de nouvelles réponses", DRAFT: "Repassé en brouillon" }[s.status]
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Dashboard data feeds the session dialog (subjects, volunteer slots)
  const { data: dash } = useQuery({
    queryKey: ["survey-dashboard", surveyId, {}],
    queryFn: () => surveysApi.dashboard(surveyId, {}),
    enabled: !!surveyId && sessionFor !== undefined,
  });

  useEffect(() => {
    if (!created || !orgSlug) return;
    const url = sessionUrl(orgSlug, created.id);
    toast.success(`Séance « ${created.title} » créée`, {
      description: created.status === "PUBLISHED" ? "Lien d’inscription prêt à partager." : "En brouillon dans Événements.",
      action: created.status === "PUBLISHED" ? { label: "Copier le lien", onClick: () => copyWithToast(url) } : undefined,
    });
    setCreated(null);
  }, [created, orgSlug]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const publicUrl = survey && orgSlug ? surveyUrl(origin, orgSlug, survey.slug) : "";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <div>
          <h1 className="text-2xl font-bold">Learn &amp; Share</h1>
          <p className="text-sm text-muted-foreground">Sondage public sans compte · séances gratuites entre étudiants</p>
        </div>
        {list?.surveys.length ? (
          <div className="flex flex-wrap items-center gap-2">
            <select id="survey-pick" aria-label="Sondage" className={cn(selectClass, "max-w-72")} value={surveyId} onChange={(e) => go({ survey: e.target.value })}>
              {list.surveys.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
            {survey ? <StatusPill status={survey.status} /> : null}
          </div>
        ) : null}
        <div className="ml-auto flex flex-wrap gap-2">
          {survey ? <StatusActions survey={survey} pending={setStatus.isPending} onStatus={(s) => setStatus.mutate(s)} /> : null}
          {survey && publicUrl ? (
            <>
              <Button variant="outline" size="sm" onClick={() => copyWithToast(publicUrl)}>
                <Copy className="h-4 w-4" /> Copier le lien
              </Button>
              <Button variant="outline" size="sm" onClick={() => setQrOpen(true)}>
                <QrCode className="h-4 w-4" /> QR
              </Button>
              <Button variant="ghost" size="sm" onClick={() => go({ tab: "questions" })} title="Aperçu dans l’onglet Questions">
                <Eye className="h-4 w-4" /> Aperçu
              </Button>
            </>
          ) : null}
          <Button variant={list?.surveys.length ? "ghost" : "default"} size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Nouveau sondage
          </Button>
        </div>
      </div>

      {!list?.surveys.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <GraduationCap className="h-10 w-10 text-primary" />
            <p className="text-lg font-semibold">Aucun sondage pour l’instant</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Partez du modèle Learn &amp; Share : ce que les étudiants veulent apprendre, qui peut partager, quand ils sont libres. Vous pourrez tout modifier avant de publier.
            </p>
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Créer le sondage
            </Button>
          </CardContent>
        </Card>
      ) : !survey ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <div role="tablist" aria-label="Sections" className="flex gap-1 overflow-x-auto border-b">
            {TABS.map(([k, label]) => {
              const count = k === "liens" ? survey.links.length : k === "questions" ? survey.questions.length : null;
              return (
                <button
                  key={k}
                  role="tab"
                  aria-selected={tab === k}
                  onClick={() => go({ tab: k })}
                  className={cn(
                    "-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                    tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                  {count != null ? <span className="rounded-full bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground">{count}</span> : null}
                </button>
              );
            })}
          </div>
          <div key={`${survey.id}-${tab}`} className="ls-enter">
            {tab === "resultats" ? <ResultsTab survey={survey} onCreateSession={(s) => setSessionFor(s.value)} /> : null}
            {tab === "reponses" ? <ResponsesTab survey={survey} /> : null}
            {tab === "liens" ? <LinksTab survey={survey} orgSlug={orgSlug} /> : null}
            {tab === "questions" ? <QuestionsTab survey={survey} orgName={orgName} /> : null}
            {tab === "reglages" ? <SettingsTab survey={survey} orgSlug={orgSlug} /> : null}
            {tab === "seances" ? <SessionsTab survey={survey} orgSlug={orgSlug} onCreate={() => setSessionFor(null)} /> : null}
          </div>
        </>
      )}

      <NewSurveyDialog
        open={creating}
        current={survey ?? null}
        onClose={(id) => {
          setCreating(false);
          if (id) go({ survey: id, tab: "questions" });
        }}
      />
      {survey && publicUrl ? (
        <QrDialog open={qrOpen} onClose={() => setQrOpen(false)} title="QR du sondage" subtitle="Lien simple : les réponses comptent en direct_or_unknown. Pour suivre une affiche, créez son lien dans Liens." url={publicUrl} />
      ) : null}
      {survey ? (
        <CreateSessionDialog
          survey={survey}
          subjects={dash?.subjects ?? []}
          slots={(dash?.volunteerSlots ?? []).flatMap((d) => d.times.map((t) => ({ day: d.day, time: t.time, count: t.count })))}
          initialSubject={sessionFor ?? null}
          open={sessionFor !== undefined && !!dash}
          onClose={(ev) => {
            setSessionFor(undefined);
            if (ev) {
              setCreated(ev);
              go({ tab: "seances" });
            }
          }}
        />
      ) : null}
    </div>
  );
}

function StatusActions({ survey, pending, onStatus }: { survey: SurveyDetail; pending: boolean; onStatus: (s: SurveyStatus) => void }) {
  const s = survey.status;
  if (s === "DRAFT")
    return (
      <Button size="sm" disabled={pending || !survey.questions.length} onClick={() => onStatus("PUBLISHED")}>
        <Send className="h-4 w-4" /> Publier
      </Button>
    );
  if (s === "CLOSED")
    return (
      <Button size="sm" variant="outline" disabled={pending} onClick={() => onStatus("PUBLISHED")}>
        <RotateCcw className="h-4 w-4" /> Rouvrir
      </Button>
    );
  return (
    <>
      {s === "PUBLISHED" ? (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => onStatus("PAUSED")}>
          <Pause className="h-4 w-4" /> Mettre en pause
        </Button>
      ) : (
        <Button size="sm" disabled={pending} onClick={() => onStatus("PUBLISHED")}>
          <Play className="h-4 w-4" /> Reprendre
        </Button>
      )}
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => onStatus("CLOSED")}>
        <Lock className="h-4 w-4" /> Fermer
      </Button>
    </>
  );
}

function NewSurveyDialog({ open, current, onClose }: { open: boolean; current: SurveyDetail | null; onClose: (id?: string) => void }) {
  const qc = useQueryClient();
  const [from, setFrom] = useState<"template" | "blank" | "copy">("template");
  const [title, setTitle] = useState("");
  const { data: templates = [] } = useQuery({ queryKey: ["survey-templates"], queryFn: surveysApi.templates, enabled: open });
  useEffect(() => {
    if (open) {
      setFrom("template");
      setTitle("");
    }
  }, [open]);
  const create = useMutation({
    mutationFn: () =>
      surveysApi.create({
        ...(from === "template" && { templateCode: templates[0]?.code ?? "learn_share" }),
        ...(from === "copy" && current && { duplicateOf: current.id }),
        ...(title.trim() && { title: title.trim() }),
      }),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["surveys"] });
      toast.success("Sondage créé en brouillon");
      onClose(s.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const options: Array<[typeof from, string, string, boolean]> = [
    ["template", templates[0]?.name ?? "Collabora Learn & Share", `Modèle prêt : ${templates[0]?.questions ?? 12} questions, rôle d’abord, contact WhatsApp optionnel.`, true],
    ["blank", "Sondage vierge", "Sans question. Vous ajoutez les vôtres.", true],
    ["copy", current ? `Copie de « ${current.title} »` : "Copier un sondage", "Mêmes questions et réglages, sans les réponses ni les liens.", !!current],
  ];
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau sondage</DialogTitle>
          <DialogDescription>Il est créé en brouillon : rien n’est visible tant que vous ne publiez pas.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {options.map(([k, label, hint, enabled]) => (
            <button
              key={k}
              type="button"
              disabled={!enabled}
              onClick={() => setFrom(k)}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors disabled:opacity-40",
                from === k ? "border-primary bg-primary/5" : "hover:border-primary/50"
              )}
            >
              <FileText className={cn("mt-0.5 h-4 w-4 shrink-0", from === k ? "text-primary" : "text-muted-foreground")} />
              <span>
                <b className="block text-sm">{label}</b>
                <span className="text-xs text-muted-foreground">{hint}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-title">Titre (optionnel)</Label>
          <Input id="new-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Learn & Share — Rentrée 2026" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose()}>Annuler</Button>
          <Button disabled={create.isPending} onClick={() => create.mutate()}>
            <Plus className="h-4 w-4" /> Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
