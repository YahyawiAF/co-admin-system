"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { managerApi, type AnswerBody, type ManagerQuestion } from "@/lib/api/manager";

export const QUESTIONS_KEY = ["advisor", "manager", "questions"] as const;
export const MONEY_KEY = ["advisor", "manager", "money"] as const;

const chip = "inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold";

function QuestionCard({
  q,
  index,
  total,
  saving,
  onAnswer,
  onLater,
}: {
  q: ManagerQuestion;
  index: number;
  total: number;
  saving: boolean;
  onAnswer: (body: AnswerBody) => void;
  onLater: (() => void) | null;
}) {
  const [exact, setExact] = useState("");
  const submitExact = (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseFloat(exact.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(v) || v < 0) {
      toast.error("Entrez un montant en DT, par ex. 4300");
      return;
    }
    onAnswer({ value: v, note: "montant exact" });
  };
  return (
    <Card key={q.key} className="advisor-in border-primary/70 shadow-[0_6px_24px_-14px_hsl(var(--primary))]">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-2 text-xs font-semibold text-primary">
          <span className="h-2 w-2 rounded-full bg-primary" />
          Le Conseiller demande · {index + 1}/{total}
          {q.reason === "STALE" ? <span className={cn(chip, "bg-amber-100 text-amber-800")}>à mettre à jour</span> : null}
          {q.reason === "UNKNOWN" ? <span className={cn(chip, "bg-amber-100 text-amber-800")}>vous aviez dit « je ne sais pas »</span> : null}
        </div>
        <div>
          <p className="text-balance text-lg font-semibold leading-snug">{q.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{q.why}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {q.choices.map((c) => (
            <button
              key={c.label}
              type="button"
              disabled={saving}
              onClick={() => onAnswer({ value: c.value, label: c.label, note: c.note ?? null })}
              className={cn(
                "rounded-lg border bg-background px-3.5 py-2.5 text-sm font-medium transition-[background-color,border-color,transform] duration-200 hover:border-primary hover:bg-primary/5 active:scale-[0.98] disabled:opacity-60",
                c.recommended && "border-primary",
              )}
            >
              {c.label}
              {c.recommended ? <span className="ml-2 text-[11px] font-semibold text-primary">conseillé</span> : null}
            </button>
          ))}
        </div>
        {q.exactLabel ? (
          <form onSubmit={submitExact} className="flex flex-wrap items-center gap-2">
            <label htmlFor={`exact-${q.key}`} className="text-sm text-muted-foreground">
              {q.exactLabel}
            </label>
            <Input
              id={`exact-${q.key}`}
              inputMode="decimal"
              placeholder="ex. 4 300"
              value={exact}
              onChange={(e) => setExact(e.target.value)}
              className="h-9 w-32"
            />
            <span className="text-sm text-muted-foreground">DT</span>
            <Button type="submit" size="sm" disabled={saving || !exact.trim()}>
              Valider
            </Button>
          </form>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 border-t border-dashed pt-3">
          {q.unknownLabel ? (
            <Button variant="outline" size="sm" disabled={saving} onClick={() => onAnswer({ unknown: true, label: q.unknownLabel })}>
              {q.unknownLabel}
            </Button>
          ) : null}
          {onLater ? (
            <Button variant="outline" size="sm" disabled={saving} onClick={onLater}>
              Plus tard
            </Button>
          ) : null}
          {q.more ? (
            <Link href={q.more.href} className="text-sm font-medium text-primary hover:underline">
              {q.more.label}
            </Link>
          ) : null}
          {saving ? <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" /> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function QuestionsTab({ onShowMoney }: { onShowMoney: () => void }) {
  const qc = useQueryClient();
  const data = useQuery({ queryKey: QUESTIONS_KEY, queryFn: managerApi.questions });
  const [skipped, setSkipped] = useState<string[]>([]);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: ({ key, body }: { key: string; body: AnswerBody }) => managerApi.answer(key, body),
    onSuccess: (res, { key }) => {
      qc.setQueryData(QUESTIONS_KEY, res);
      qc.invalidateQueries({ queryKey: MONEY_KEY });
      setEditKey(null);
      setSkipped((s) => s.filter((k) => k !== key));
      setFresh(key);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (data.isLoading) return <Skeleton className="h-80 rounded-xl" />;
  if (!data.data) return <p className="text-sm text-destructive">Questions indisponibles : {data.error?.message}</p>;
  const d = data.data;

  const editing = editKey ? d.editable.find((q) => q.key === editKey) : undefined;
  const queue = d.pending.filter((q) => !skipped.includes(q.key));
  const current = editing ?? queue[0] ?? d.pending[0];
  const index = current ? Math.max(0, d.pending.findIndex((q) => q.key === current.key)) : 0;
  const rest = d.pending.filter((q) => q.key !== current?.key);

  return (
    <div className="advisor-in grid items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <Card className="shadow-none">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-3">
              <span className="whitespace-nowrap text-sm font-semibold tabular-nums">
                Il connaît {d.known} / {d.total} choses sur l&apos;espace
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                  style={{ width: `${(d.known / d.total) * 100}%` }}
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Une question à la fois. Il ne demande jamais ce que l&apos;app sait déjà.
            </p>
          </CardContent>
        </Card>

        {current ? (
          <QuestionCard
            key={`${current.key}-${editing ? "edit" : "ask"}`}
            q={current}
            index={editing ? d.editable.findIndex((q) => q.key === current.key) : index}
            total={editing ? d.editable.length : d.pending.length}
            saving={save.isPending}
            onAnswer={(body) => save.mutate({ key: current.key, body })}
            onLater={
              editing
                ? () => setEditKey(null)
                : d.pending.length > 1
                  ? () =>
                      setSkipped((s) => {
                        const next = [...s, current.key];
                        // Everything skipped: start the round again
                        return next.length >= d.pending.length ? [] : next;
                      })
                  : null
            }
          />
        ) : (
          <Card key="done" className="advisor-in border-primary/70">
            <CardContent className="flex flex-col items-start gap-3 p-5">
              <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                <span className="h-2 w-2 rounded-full bg-primary" />
                Conseiller
              </div>
              <p className="text-lg font-semibold">Merci, j&apos;ai ce qu&apos;il faut pour l&apos;argent.</p>
              <p className="text-sm text-muted-foreground">Les prochaines questions serviront à l&apos;onglet Légal.</p>
              <Button onClick={onShowMoney}>
                Voir combien garder et investir <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="font-medium">Vos réponses</div>
            <p className="mb-2 text-sm text-muted-foreground">Modifiables à tout moment. Chaque réponse est datée.</p>
            {d.answers.length ? (
              <ul className="divide-y">
                {d.answers.map((a) => (
                  <li key={a.key} className={cn("flex items-start justify-between gap-3 py-2.5", fresh === a.key && "advisor-in")}>
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{a.short}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.unknown ? (
                          <span className={cn(chip, "bg-amber-100 text-amber-800")}>à vérifier</span>
                        ) : (
                          <>
                            {a.label}
                            {a.note && a.note !== a.label ? ` · ${a.note}` : ""}
                          </>
                        )}{" "}
                        · {format(new Date(a.answeredAt), "d MMM", { locale: fr })}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 text-sm font-medium text-primary hover:underline"
                      onClick={() => {
                        setEditKey(a.key);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      Modifier
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Pas encore de réponse.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Déjà lu dans l&apos;app</div>
            <ul className="divide-y">
              {d.read.map((f) => (
                <li key={f.title} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{f.title}</div>
                    <div className="text-xs text-muted-foreground">{f.detail}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    {f.value ? <div className="text-sm font-semibold tabular-nums">{f.value}</div> : null}
                    <span className={cn(chip, f.warn ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground")}>
                      {f.source}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Questions à venir</div>
            <p className="mb-2 text-sm text-muted-foreground">Classées par ce qu&apos;elles changent à la décision.</p>
            <ul className="divide-y">
              {rest.map((q) => (
                <li key={q.key} className="flex items-center justify-between gap-3 py-2.5 text-sm font-medium">
                  {q.short}
                  <span className={cn(chip, "bg-primary/10 text-primary")}>change le montant</span>
                </li>
              ))}
              {d.later.map((l) => (
                <li key={l.title} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{l.title}</div>
                    <div className="text-xs text-muted-foreground">{l.detail}</div>
                  </div>
                  <span className={cn(chip, "bg-muted text-muted-foreground")}>pour Légal</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
