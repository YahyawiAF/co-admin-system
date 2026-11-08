"use client";

import { useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * « Comment c'est calculé » lives behind a small ⓘ button and opens in a
 * modal: the page shows numbers, the method is one tap away.
 */
export function InfoButton({
  title,
  children,
  className,
  wide,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={title}
        title={title}
        onClick={() => setOpen(true)}
        className={cn(
          "-m-1.5 inline-grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground",
          className,
        )}
      >
        <Info className="h-4 w-4" aria-hidden />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={cn("max-h-[90vh] overflow-y-auto", wide ? "sm:max-w-3xl" : "sm:max-w-2xl")}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm leading-relaxed">{children}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** A worked example inside an info modal (figures, one per line). */
export function InfoCalc({ children }: { children: ReactNode }) {
  return <div className="rounded-xl bg-muted/60 px-4 py-3 font-medium tabular-nums leading-7">{children}</div>;
}

/** Thin progress bar with an optional « expected by now » marker. */
export function ProgressBar({
  value,
  max,
  marker,
  tone = "primary",
  label,
}: {
  value: number;
  max: number;
  marker?: number | null;
  tone?: "primary" | "good" | "warn";
  label: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const mk = marker != null && max > 0 ? Math.max(0, Math.min(100, (marker / max) * 100)) : null;
  return (
    <div className="relative h-3 rounded-full bg-muted" role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none",
          tone === "good" ? "bg-emerald-600" : tone === "warn" ? "bg-amber-500" : "bg-primary",
        )}
        style={{ width: `${pct}%` }}
      />
      {mk != null ? (
        <div className="absolute -top-1 h-5 w-0.5 rounded bg-foreground/70 transition-[left] duration-500 motion-reduce:transition-none" style={{ left: `${mk}%` }} aria-hidden />
      ) : null}
    </div>
  );
}
