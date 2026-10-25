"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type QuestTone = "brand" | "violet" | "gold" | "emerald";

const TONE: Record<QuestTone, { bg: string; text: string; soft: string }> = {
  brand: {
    bg: "bg-gradient-to-br from-indigo-700 via-indigo-600 to-indigo-500",
    text: "text-white",
    soft: "text-indigo-100",
  },
  violet: {
    bg: "bg-gradient-to-br from-violet-800 via-violet-600 to-indigo-600",
    text: "text-white",
    soft: "text-violet-100",
  },
  gold: {
    bg: "bg-gradient-to-br from-amber-400 via-amber-300 to-yellow-200",
    text: "text-amber-950",
    soft: "text-amber-900",
  },
  emerald: {
    bg: "bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-500",
    text: "text-white",
    soft: "text-emerald-50",
  },
};

/** Banner of the "mission" modal: eyebrow, icon + title, subtitle, reward + glass chip. */
export function QuestBanner({
  tone = "brand",
  eyebrow,
  title,
  icon,
  subtitle,
  reward,
  chip,
  children,
  onClose,
  closeDisabled,
  asSheet,
  className,
}: {
  tone?: QuestTone;
  eyebrow: ReactNode;
  title: ReactNode;
  icon?: ReactNode;
  subtitle?: ReactNode;
  reward?: { label: ReactNode; value: ReactNode } | null;
  chip?: { label: ReactNode; value: ReactNode } | null;
  /** Extra banner content under the reward row */
  children?: ReactNode;
  onClose?: () => void;
  closeDisabled?: boolean;
  /** Inside a sheet: Radix title/description for screen readers + drag handle */
  asSheet?: boolean;
  className?: string;
}) {
  const t = TONE[tone];
  const Title = asSheet ? SheetTitle : "h2";
  const Desc = asSheet ? SheetDescription : "p";
  return (
    <div className={cn("relative overflow-hidden px-5 pb-5 pt-6", t.bg, t.text, className)}>
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/15" />
        <div className="absolute -bottom-10 left-8 h-24 w-24 rounded-full bg-white/10" />
      </div>
      {asSheet ? (
        <div className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/45" aria-hidden />
      ) : null}
      {onClose ? (
        <button
          type="button"
          aria-label="Fermer"
          disabled={closeDisabled}
          onClick={onClose}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 transition hover:bg-white/30 disabled:opacity-40"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
      <p className={cn("relative text-[11px] font-bold uppercase tracking-[0.14em]", t.soft)}>
        {eyebrow}
      </p>
      <Title className={cn("relative mt-1 flex items-center gap-2 pr-8 text-xl font-extrabold leading-tight", t.text)}>
        {icon}
        {title}
      </Title>
      {subtitle ? (
        <Desc className={cn("relative mt-1 text-[13px] leading-snug", t.soft)}>
          {subtitle}
        </Desc>
      ) : null}
      {reward || chip ? (
        <div className="relative mt-4 flex items-end justify-between gap-3">
          {reward ? (
            <div className="min-w-0">
              <p className={cn("text-[11px] font-bold uppercase tracking-wide", t.soft)}>
                {reward.label}
              </p>
              <div className="mt-0.5 flex items-center gap-1.5 text-2xl font-black tabular-nums">
                {reward.value}
              </div>
            </div>
          ) : (
            <span />
          )}
          {chip ? (
            <div className="shrink-0 rounded-2xl bg-white/15 px-3 py-2 text-center backdrop-blur-sm">
              <p className={cn("text-[10px] font-bold uppercase tracking-wide", t.soft)}>
                {chip.label}
              </p>
              <div className="text-base font-black tabular-nums">{chip.value}</div>
            </div>
          ) : null}
        </div>
      ) : null}
      {children ? <div className="relative">{children}</div> : null}
    </div>
  );
}

/**
 * The app's modal style ("mission"): gradient banner on top, white list below,
 * sticky footer with one main button. Bottom sheet on mobile.
 */
export function QuestSheet({
  open,
  onOpenChange,
  dismissible = true,
  tone,
  eyebrow,
  title,
  icon,
  subtitle,
  reward,
  chip,
  banner,
  footer,
  children,
  bodyClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dismissible?: boolean;
  tone?: QuestTone;
  eyebrow: ReactNode;
  title: ReactNode;
  icon?: ReactNode;
  subtitle?: ReactNode;
  reward?: { label: ReactNode; value: ReactNode } | null;
  chip?: { label: ReactNode; value: ReactNode } | null;
  /** Extra content inside the banner */
  banner?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  bodyClassName?: string;
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next && !dismissible) return;
        onOpenChange(next);
      }}
    >
      <SheetContent
        side="bottom"
        className="gap-0 border-0 bg-transparent p-0 shadow-none [&>button]:hidden"
      >
        <div className="mx-auto flex max-h-[90dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_-8px_32px_rgba(15,23,42,0.22)]">
          <QuestBanner
            asSheet
            tone={tone}
            eyebrow={eyebrow}
            title={title}
            icon={icon}
            subtitle={subtitle}
            reward={reward}
            chip={chip}
            onClose={() => onOpenChange(false)}
            closeDisabled={!dismissible}
          >
            {banner}
          </QuestBanner>
          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto px-4 pt-4",
              footer ? "pb-3" : "pb-[max(1.25rem,env(safe-area-inset-bottom))]",
              bodyClassName
            )}
          >
            {children}
          </div>
          {footer ? (
            <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1">
              {footer}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Section label inside a quest body ("OBJECTIFS", "DURÉE"…). */
export function QuestLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("mb-2 px-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-500", className)}>
      {children}
    </p>
  );
}
