"use client";

import type { ReactNode } from "react";
import { format } from "date-fns";
import { Clock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Promotion } from "@/lib/types";

const STYLES: Record<Promotion["style"], { card: string; ink: string; sub: string; chip: string }> = {
  GOLD: {
    card: "from-amber-200 via-yellow-100 to-amber-400 ring-amber-300",
    ink: "text-amber-950",
    sub: "text-amber-900/75",
    chip: "bg-amber-950 text-amber-100",
  },
  VIOLET: {
    card: "from-violet-600 via-fuchsia-500 to-indigo-600 ring-violet-300",
    ink: "text-white",
    sub: "text-white/80",
    chip: "bg-white text-violet-700",
  },
  GREEN: {
    card: "from-emerald-500 via-teal-400 to-emerald-600 ring-emerald-300",
    ink: "text-white",
    sub: "text-white/80",
    chip: "bg-white text-emerald-700",
  },
};

const dt = (n: number) => `${Math.round(n * 100) / 100} DT`;

/** The "golden card" look of an offer — used in the popup, the offers strip and the admin preview. */
export function PromoGoldenCard({
  promo,
  action,
  compact = false,
  className,
}: {
  promo: Pick<
    Promotion,
    "title" | "description" | "label" | "itemName" | "priceBefore" | "priceAfter" | "style" | "liveUntil" | "fromHour" | "toHour"
  >;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  const s = STYLES[promo.style] ?? STYLES.GOLD;
  const until = promo.liveUntil
    ? `Jusqu’à ${format(new Date(promo.liveUntil), "HH:mm")}`
    : promo.fromHour != null && promo.toHour != null
      ? `De ${promo.fromHour}h à ${promo.toHour}h`
      : null;
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl bg-gradient-to-br p-4 shadow-lg ring-1",
        s.card,
        className
      )}
    >
      {/* moving shine */}
      <span className="pointer-events-none absolute -inset-y-6 -left-1/2 w-1/3 rotate-12 bg-white/40 blur-md motion-safe:animate-[promo-shine_3.2s_ease-in-out_infinite]" />
      <span className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/20" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.18em]", s.sub)}>
            <Sparkles className="h-3 w-3" />
            Offre spéciale
          </p>
          <p className={cn("mt-1 font-black leading-tight", s.ink, compact ? "text-lg" : "text-2xl")}>
            {promo.title}
          </p>
          {promo.itemName ? (
            <p className={cn("mt-0.5 truncate text-sm font-medium", s.sub)}>{promo.itemName}</p>
          ) : null}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-2xl px-2.5 py-1.5 text-center font-black leading-none shadow-sm",
            s.chip,
            compact ? "text-base" : "text-xl"
          )}
        >
          {promo.label}
        </span>
      </div>
      {!compact && promo.description ? (
        <p className={cn("relative mt-2 text-sm leading-snug", s.sub)}>{promo.description}</p>
      ) : null}
      <div className="relative mt-3 flex flex-wrap items-end justify-between gap-2">
        <div className={cn("flex items-baseline gap-2", s.ink)}>
          {promo.priceBefore != null && promo.priceAfter != null ? (
            <>
              <span className="text-sm line-through opacity-60">{dt(promo.priceBefore)}</span>
              <span className={cn("font-black tabular-nums", compact ? "text-xl" : "text-3xl")}>
                {dt(promo.priceAfter)}
              </span>
            </>
          ) : null}
        </div>
        {until ? (
          <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", s.sub)}>
            <Clock className="h-3.5 w-3.5" />
            {until}
          </span>
        ) : null}
      </div>
      {action ? <div className="relative mt-3">{action}</div> : null}
    </div>
  );
}
