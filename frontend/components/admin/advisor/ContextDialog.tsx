"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardPaste, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { advisorApi } from "@/lib/api/resources";
import { DIALOG_CLASS } from "@/components/admin/OutreachCampaigns";
import { AdvisorContextPanel } from "./AdvisorContextPanel";
import { copyText as copyRaw } from "./advice-ui";

async function copyText(text: string) {
  await copyRaw(text);
  toast.success("Copié dans le presse-papiers");
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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


/** « Mon contexte »: what the AI can't see in the numbers, and the copy/paste path without an API key. */
export function ContextDialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const settings = useQuery({ queryKey: ["advisor", "settings"], queryFn: advisorApi.settings, enabled: open });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(DIALOG_CLASS, "h-[92vh] max-w-5xl")}>
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 px-6 pb-5 pt-5 text-white">
          <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10" aria-hidden />
          <p className="relative text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-100">Conseil IA</p>
          <DialogTitle className="relative mt-1 text-2xl font-extrabold text-white">Mon contexte</DialogTitle>
          <DialogDescription className="relative mt-1 text-[13px] text-indigo-100">
            Ce que l&apos;IA ne voit pas dans les chiffres. Plus c&apos;est précis, plus les solutions collent à votre espace.
          </DialogDescription>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
          <AdvisorContextPanel />
          <ContextCard value={settings.data?.businessContext ?? ""} />
          <ManualCard
            days={30}
            onImported={() => {
              onImported();
              onClose();
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
