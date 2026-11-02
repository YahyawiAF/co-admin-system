"use client";

import { CheckCircle2, ExternalLink, Menu, SquarePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { openInChromeUrl } from "@/lib/visitor-notify";
import type { InstallStep } from "@/components/visitor/installSteps";

const ICONS = { menu: Menu, add: SquarePlus, done: CheckCircle2 } as const;

/** Screenshot of the step, or a big icon when we have no screenshot for this browser. */
export function InstallStepVisual({
  step,
  className,
}: {
  step: InstallStep;
  className?: string;
}) {
  const fade = "animate-in fade-in duration-300 motion-reduce:animate-none";
  if (step.src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={step.src}
        src={step.src}
        alt={step.alt}
        className={cn("mx-auto w-full object-contain", fade, className)}
      />
    );
  }
  const Icon = ICONS[step.icon ?? "menu"];
  return (
    <div
      key={step.title}
      role="img"
      aria-label={step.alt}
      className={cn("flex aspect-[4/3] w-full items-center justify-center", fade)}
    >
      <Icon className="h-20 w-20 text-primary" strokeWidth={1.5} />
    </div>
  );
}

/**
 * Facebook / Instagram / TikTok… browsers can't install apps: send the visitor
 * to Chrome first (they confirm their phone number again there).
 */
export function InAppBrowserNotice({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-amber-50 px-3 py-2.5 text-[13px] leading-snug text-amber-900",
        className
      )}
    >
      <p>
        Ce navigateur ne peut pas installer l’app. Ouvrez cette page dans{" "}
        <strong>Chrome</strong>, puis suivez les étapes.
      </p>
      <a
        href={openInChromeUrl()}
        className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-full bg-amber-900 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-amber-950"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Ouvrir dans Chrome
      </a>
    </div>
  );
}
