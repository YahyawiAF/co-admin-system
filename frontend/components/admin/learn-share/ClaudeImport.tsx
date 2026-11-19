"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ClipboardCopy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { claudeSurveyRequest, IMPORT_TYPE_LABEL, type ImportResult } from "@/lib/survey-import";

/** « Depuis Claude »: copy a request, paste the survey Claude created, check it before creating. */
export function ClaudeImport({
  orgName,
  pasted,
  result,
  onPaste,
}: {
  orgName: string;
  pasted: string;
  result: ImportResult | null;
  onPaste: (text: string) => void;
}) {
  const [topic, setTopic] = useState("");
  const [copied, setCopied] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const request = claudeSurveyRequest(orgName, topic);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(request);
      toast.success("Demande copiée. Collez-la dans Claude.");
    } catch {
      setShowRequest(true);
      toast("Copiez la demande affichée (Ctrl+C).");
    }
    setCopied(true);
  };

  const fixes = result?.ok ? result.questions.filter((q) => q.fixes.length).length : 0;

  return (
    <div className="ls-enter space-y-3">
      <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">✨ Claude crée le sondage</span>
        <span className="text-muted-foreground">→</span>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">📥 Vous le collez ici</span>
        <span className="text-muted-foreground">→</span>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">📱 Les gens répondent</span>
      </div>

      <Step n={1} done={copied} title="Demandez à Claude de créer le sondage">
        <div className="space-y-1.5">
          <Label htmlFor="claude-topic">De quoi parle le sondage ?</Label>
          <Input id="claude-topic" value={topic} maxLength={300} placeholder="Ex. quels ateliers du samedi les étudiants veulent (anglais, code, CV…)" onChange={(e) => setTopic(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={copy}>
            <ClipboardCopy className="h-4 w-4" /> Copier la demande pour Claude
          </Button>
          <Button type="button" size="sm" variant="outline" asChild>
            <a href="https://claude.ai/new" target="_blank" rel="noopener noreferrer">
              Ouvrir Claude <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setShowRequest((v) => !v)}>
            {showRequest ? "Cacher la demande" : "Voir la demande"}
          </Button>
        </div>
        {showRequest ? (
          <pre className="ls-enter max-h-44 select-all overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-2.5 font-mono text-[11px] text-muted-foreground">{request}</pre>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Collez la demande dans Claude : il vous écrit le sondage. Vous pouvez lui demander de changer des questions. Quand il vous plaît, copiez le sondage qu’il a créé.
        </p>
      </Step>

      <Step n={2} done={!!pasted.trim()} title="Collez le sondage créé par Claude">
        <Textarea
          id="claude-paste"
          aria-label="Sondage créé par Claude"
          rows={5}
          value={pasted}
          onChange={(e) => onPaste(e.target.value)}
          placeholder="Collez ici le sondage que Claude a créé. Le texte autour ne gêne pas."
          className="font-mono text-xs"
        />
      </Step>

      <Step n={3} done={!!result?.ok} title="Vérifiez puis créez">
        {!result ? (
          <p className="text-xs text-muted-foreground">Les questions trouvées s’affichent ici dès que vous collez.</p>
        ) : !result.ok ? (
          <p role="alert" className="ls-enter flex gap-2 rounded-md bg-destructive/10 p-2.5 text-sm font-medium text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {result.error}
              <span className="block text-xs font-normal text-muted-foreground">{result.help}</span>
            </span>
          </p>
        ) : (
          <div className="ls-enter space-y-2">
            <p className="flex gap-2 rounded-md bg-emerald-50 p-2.5 text-sm font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {result.questions.length} questions trouvées · « {result.title} »
                <span className="block text-xs font-normal text-muted-foreground">
                  {fixes ? `${fixes} petite${fixes > 1 ? "s" : ""} correction${fixes > 1 ? "s" : ""}, en orange ci-dessous. ` : ""}
                  Le prénom et le WhatsApp sont demandés à la fin, comme d’habitude.
                  {result.cut ? " Seules les 30 premières questions sont gardées." : ""}
                </span>
              </span>
            </p>
            <ol className="ls-stagger max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {result.questions.map((q, k) => {
                const parent = q.showIf ? result.questions.findIndex((p) => p.id === q.showIf!.questionId) : -1;
                return (
                  <li key={q.id} style={{ ["--i" as string]: k }} className="space-y-1 rounded-md border p-2.5">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="w-4 text-xs tabular-nums text-muted-foreground">{k + 1}</span>
                      <b className="min-w-0 flex-1 text-sm">
                        {q.label}
                        {!q.required ? <span className="font-normal text-muted-foreground"> (optionnelle)</span> : null}
                      </b>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{IMPORT_TYPE_LABEL[q.type]}</span>
                      {parent >= 0 ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                          si Q{parent + 1} ={" "}
                          {result.questions[parent].options
                            ?.filter((o) => q.showIf!.anyOf.includes(o.value))
                            .map((o) => o.label)
                            .join(" / ")}
                        </span>
                      ) : null}
                    </div>
                    {q.options?.length ? (
                      <div className="flex flex-wrap gap-1 pl-6">
                        {q.options.map((o) => (
                          <span key={o.value} className="rounded-full border px-2 py-0.5 text-xs">
                            {o.emoji} {o.label}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {q.say ? <p className="pl-6 text-xs italic text-muted-foreground">Compagnon : « {q.say} »</p> : null}
                    {q.fixes.map((f) => (
                      <p key={f} className="pl-6 text-xs text-amber-700 dark:text-amber-400">Corrigé : {f}</p>
                    ))}
                  </li>
                );
              })}
            </ol>
            <p className="text-xs text-muted-foreground">Après « Créer » : publiez-le et partagez le lien. Vous pouvez tout modifier dans l’onglet Questions.</p>
          </div>
        )}
      </Step>
    </div>
  );
}

function Step({ n, done, title, children }: { n: number; done: boolean; title: string; children: React.ReactNode }) {
  return (
    <section className={cn("space-y-2.5 rounded-lg border p-3 transition-colors duration-200", done && "border-emerald-500/50")}>
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <span
          className={cn(
            "grid h-6 w-6 place-items-center rounded-full text-xs font-bold transition-colors duration-200",
            done ? "bg-emerald-600 text-white" : "bg-primary/10 text-primary"
          )}
        >
          {done ? "✓" : n}
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}
