"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/** Mobile bottom sheet: handle, title row, scrollable body, sticky footer. */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  footer,
  dismissible = true,
  bodyClassName,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  /** False while a mutation runs: blocks swipe/overlay/close button. */
  dismissible?: boolean;
  bodyClassName?: string;
  children: ReactNode;
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
        <div className="mx-auto flex max-h-[85dvh] w-full max-w-[480px] flex-col rounded-t-[28px] bg-white shadow-[0_-8px_32px_rgba(15,23,42,0.18)]">
          <div className="flex justify-center pb-1 pt-2.5">
            <div className="h-1.5 w-10 rounded-full bg-slate-200" aria-hidden />
          </div>
          <SheetHeader className="flex-row items-start justify-between gap-3 space-y-0 px-5 pb-3 text-left">
            <div className="min-w-0">
              <SheetTitle className="text-[17px] text-slate-900">
                {title}
              </SheetTitle>
              {description ? (
                <SheetDescription className="mt-0.5 text-[11px] text-slate-500">
                  {description}
                </SheetDescription>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="Fermer"
              disabled={!dismissible}
              onClick={() => onOpenChange(false)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 disabled:opacity-40"
            >
              <X className="h-4 w-4" />
            </button>
          </SheetHeader>
          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto px-5",
              footer ? "pb-4" : "pb-[max(1.25rem,env(safe-area-inset-bottom))]",
              bodyClassName
            )}
          >
            {children}
          </div>
          {footer ? (
            <div className="border-t border-slate-100 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              {footer}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
