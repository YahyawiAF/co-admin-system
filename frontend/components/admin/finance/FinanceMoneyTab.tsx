"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { advisorApi } from "@/lib/api/resources";
import { managerApi, type MoneyIdea } from "@/lib/api/manager";
import type { AdviceMetric, AdvisorCategory } from "@/lib/types";
import { MoneyTab } from "./MoneyTab";
import { QUESTIONS_KEY, QuestionsTab } from "./MoneyQuestions";

/**
 * Finance › Argent: how much to keep, how much can be invested (caisse + coffre + banque
 * − charges − réserve), and the few answers that make the calculation right.
 */
export function FinanceMoneyTab() {
  const qc = useQueryClient();
  const [view, setView] = useState<"calcul" | "questions">("calcul");
  const questions = useQuery({ queryKey: QUESTIONS_KEY, queryFn: managerApi.questions });
  const toAsk = questions.data?.toAsk ?? 0;

  // An investment idea becomes a solution measured in Conseil IA (goal: pay back its cost)
  const start = useMutation({
    mutationFn: (idea: MoneyIdea) =>
      advisorApi.createInitiative({
        title: idea.title,
        description: idea.test,
        category: (idea.draft?.category as AdvisorCategory) ?? "NEW_REVENUE",
        startDate: format(new Date(), "yyyy-MM-dd"),
        metric: (idea.draft?.metric as AdviceMetric) ?? undefined,
        cost: idea.cost,
        steps: [{ text: idea.test, done: false }],
        goalAmount: Math.max(50, Math.round(idea.cost)),
        ...(idea.draft ? { targetKind: "SLOT" as const, targetDays: [], targetFromHour: idea.draft.fromHour, targetToHour: idea.draft.toHour } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["advisor"] });
      toast.success("Test lancé : suivez-le dans Conseil IA", {
        action: { label: "Ouvrir", onClick: () => window.location.assign("/conseiller") },
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-muted p-1 text-sm" role="tablist" aria-label="Argent">
          {(
            [
              ["calcul", "Garder ou investir"],
              ["questions", "Questions"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={view === k}
              onClick={() => setView(k)}
              className={cn(
                "inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3.5 font-semibold transition-[background-color,color,box-shadow] duration-200",
                view === k ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
              {k === "questions" && toAsk ? (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">{toAsk}</span>
              ) : null}
            </button>
          ))}
        </div>
        <Link href="/conseiller" className="text-sm font-medium text-indigo-700 hover:underline">
          Que faire de cet argent ? Conseil IA →
        </Link>
      </div>
      <div key={view} className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300 motion-reduce:animate-none">
        {view === "calcul" ? (
          <MoneyTab onAnswer={() => setView("questions")} onStartTest={(idea) => start.mutate(idea)} />
        ) : (
          <QuestionsTab onShowMoney={() => setView("calcul")} />
        )}
      </div>
    </div>
  );
}
