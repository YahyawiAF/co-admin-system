"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { managerApi } from "@/lib/api/manager";
import { QUESTIONS_KEY } from "./QuestionsTab";

export type ConseillerTab = "conseils" | "questions" | "argent";
const TABS: Array<[ConseillerTab, string]> = [
  ["conseils", "Conseils"],
  ["questions", "Questions"],
  ["argent", "Argent : garder ou investir"],
];

/** Conseiller tab bar; the tab is kept in the URL (?tab=argent) so it can be linked. */
export function ConseillerTabs({ tab, onChange }: { tab: ConseillerTab; onChange: (t: ConseillerTab) => void }) {
  const questions = useQuery({ queryKey: QUESTIONS_KEY, queryFn: managerApi.questions });
  const toAsk = questions.data?.toAsk ?? 0;

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t && TABS.some(([k]) => k === t)) onChange(t as ConseillerTab);
    // Read the URL once, on first render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = (t: ConseillerTab) => {
    onChange(t);
    const url = new URL(window.location.href);
    if (t === "conseils") url.searchParams.delete("tab");
    else url.searchParams.set("tab", t);
    window.history.replaceState(null, "", url);
  };

  return (
    <nav role="tablist" aria-label="Conseiller" className="-mt-1 flex gap-1 overflow-x-auto border-b">
      {TABS.map(([k, label]) => (
        <button
          key={k}
          type="button"
          role="tab"
          aria-selected={tab === k}
          onClick={() => select(k)}
          className={cn(
            "-mb-px flex items-center whitespace-nowrap border-b-2 px-3.5 py-2 text-sm font-medium transition-[color,border-color] duration-200",
            tab === k ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
          {k === "questions" && questions.data ? (
            <span
              className={cn(
                "ml-1.5 inline-grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums transition-colors duration-300",
                toAsk ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {toAsk}
            </span>
          ) : null}
        </button>
      ))}
      <span className="flex items-center whitespace-nowrap px-3.5 py-2 text-sm font-medium text-muted-foreground/60" aria-disabled>
        Légal Tunisie <span className="ml-1 text-[11px]">bientôt</span>
      </span>
    </nav>
  );
}
