"use client";

import { Check, ChevronRight, CreditCard, LogIn, MapPin, Ticket } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SessionStepState = "done" | "todo" | "info";

export type SessionStep = {
  key: string;
  label: string;
  value: string;
  state: SessionStepState;
  onClick?: () => void;
};

const ICONS: Record<string, LucideIcon> = {
  checkin: LogIn,
  seat: MapPin,
  pass: Ticket,
  payment: CreditCard,
};

/** Compact session checklist: Pointé · Place · Pass · Paiement (tappable steps open sheets). */
export function SessionSteps({
  steps,
  hint,
}: {
  steps: SessionStep[];
  /** One-line note under the steps (e.g. payment to confirm). */
  hint?: string | null;
}) {
  return (
    <div className="rounded-3xl bg-white px-2 py-3 shadow-sm">
      <div className="grid grid-cols-4">
        {steps.map((step, i) => {
          const Icon = ICONS[step.key] ?? Check;
          const done = step.state === "done";
          const todo = step.state === "todo";
          const body = (
            <>
              <span className="relative flex w-full items-center justify-center">
                {i > 0 ? (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute right-1/2 top-1/2 mr-[18px] h-0.5 w-[calc(100%-36px)] -translate-y-1/2 rounded-full",
                      done ? "bg-indigo-200" : "bg-slate-200"
                    )}
                  />
                ) : null}
                <span
                  className={cn(
                    "relative flex h-9 w-9 items-center justify-center rounded-full transition",
                    done
                      ? "bg-indigo-600 text-white"
                      : todo
                        ? "bg-amber-50 text-amber-600 ring-2 ring-amber-200"
                        : "bg-slate-100 text-slate-500"
                  )}
                >
                  {done ? (
                    <Check className="h-4 w-4" strokeWidth={3} />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </span>
              </span>
              <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {step.label}
              </span>
              <span
                className={cn(
                  "mt-0.5 inline-flex max-w-full items-center truncate text-xs font-semibold",
                  todo
                    ? "text-amber-700"
                    : step.onClick
                      ? "text-indigo-600"
                      : done
                        ? "text-slate-900"
                        : "text-slate-500"
                )}
              >
                <span className="truncate">{step.value}</span>
                {step.onClick ? (
                  <ChevronRight className="h-3 w-3 shrink-0" />
                ) : null}
              </span>
            </>
          );
          return step.onClick ? (
            <button
              key={step.key}
              type="button"
              onClick={step.onClick}
              className="flex min-w-0 flex-col items-center rounded-2xl px-1 py-1 transition hover:bg-slate-50 active:scale-95"
            >
              {body}
            </button>
          ) : (
            <div
              key={step.key}
              className="flex min-w-0 flex-col items-center px-1 py-1"
            >
              {body}
            </div>
          );
        })}
      </div>
      {hint ? (
        <p className="mx-2 mt-2 rounded-xl bg-amber-50 px-3 py-2 text-center text-[11px] leading-snug text-amber-800">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
