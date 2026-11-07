"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AdvisorDataIssue } from "@/lib/types";

/** Data problems that would make the advice wrong: shown before anything else. */
export function DataCheck({ issues }: { issues: AdvisorDataIssue[] }) {
  const [open, setOpen] = useState(false);
  if (!issues.length) return null;
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3" aria-label="Contrôle des données">
      <div className="flex flex-wrap items-center gap-3">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
        <p className="min-w-[12rem] flex-1 text-sm">
          <b className="text-amber-800">
            {issues.length} problème{issues.length > 1 ? "s" : ""} dans vos données.
          </b>{" "}
          Les chiffres touchés peuvent fausser le bilan : corrigez-les d&apos;abord.
        </p>
        <Button size="sm" variant="outline" className="bg-background" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? "Masquer" : "Voir"}
        </Button>
      </div>
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
        aria-hidden={!open}
      >
        <div className="min-h-0 overflow-hidden">
          <ul className="grid gap-2.5 pt-3 sm:grid-cols-2 xl:grid-cols-4">
            {issues.map((i) => (
              <li key={i.key} className="flex flex-col gap-1 rounded-lg border bg-card p-3">
                <span
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-wide",
                    i.severity === "blocking" ? "text-rose-700" : "text-amber-700",
                  )}
                >
                  {i.severity === "blocking" ? "Bloquant" : "À vérifier"}
                </span>
                <span className="font-semibold">{i.title}</span>
                <span className="text-sm text-muted-foreground">{i.detail}</span>
                <Link href={i.fixHref} className="mt-auto pt-1 text-sm font-medium text-primary hover:underline">
                  {i.fixLabel} →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

