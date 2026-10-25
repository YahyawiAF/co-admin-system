"use client";

import type { ReactNode } from "react";
import { Gift } from "lucide-react";
import { cn } from "@/lib/utils";

const STAR =
  "polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%)";

/** Glowing "Cadeau" badge pinned to the top-right corner of its (relative) parent. */
export function GiftBadge({
  label = "Cadeau",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <>
      <span
        className={cn(
          "v-gift-glow absolute -right-1 -top-2.5 z-[1] flex h-6 items-center gap-1 overflow-hidden rounded-full bg-gradient-to-r from-amber-500 via-amber-200 to-amber-500 pl-1.5 pr-2.5 text-[11px] font-black text-amber-950",
          className
        )}
      >
        <span
          aria-hidden
          className="v-shine absolute inset-y-0 left-0 w-2/5 bg-gradient-to-r from-white/0 via-white/80 to-white/0"
        />
        <Gift className="v-wiggle relative h-3.5 w-3.5" strokeWidth={2.4} />
        <span className="relative">{label}</span>
      </span>
      <span
        aria-hidden
        className="v-twinkle absolute -top-2 right-24 h-2 w-2 bg-amber-400"
        style={{ clipPath: STAR }}
      />
      <span
        aria-hidden
        className="v-twinkle absolute -right-2 top-5 h-[7px] w-[7px] bg-amber-500 [animation-delay:.7s]"
        style={{ clipPath: STAR }}
      />
    </>
  );
}

/**
 * Selectable row of a quest modal (tarif, abonnement…): icon tile, title + hint,
 * price on the right. Selected = accent ring; gift = gold tint + glowing badge.
 */
export function QuestOption({
  selected,
  disabled,
  onClick,
  icon,
  title,
  hint,
  price,
  gift,
  giftLine,
  badge,
  tone = "indigo",
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: ReactNode;
  title: ReactNode;
  hint?: ReactNode;
  price?: ReactNode;
  /** Badge text ("Cadeau") when a promo is tied to this option */
  gift?: string | null;
  /** Shown under the hint once selected (e.g. "+ Café offert avec ce pass") */
  giftLine?: ReactNode;
  /** Small tag next to the title ("Actuel", "Promo"…) */
  badge?: ReactNode;
  tone?: "indigo" | "violet";
}) {
  const violet = tone === "violet";
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "relative flex w-full min-h-[60px] items-center gap-3 rounded-[18px] px-3 py-2 text-left ring-1 transition-[box-shadow,background-color,transform] duration-200 active:scale-[0.98] disabled:opacity-60",
        selected
          ? violet
            ? "bg-violet-50 ring-2 ring-violet-600"
            : "bg-indigo-50 ring-2 ring-indigo-600"
          : gift
            ? "bg-amber-50 ring-amber-300"
            : "bg-white ring-slate-200"
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] text-xs font-black transition-colors duration-200",
          selected
            ? violet
              ? "bg-violet-600 text-white"
              : "bg-indigo-600 text-white"
            : violet
              ? "bg-violet-50 text-violet-700"
              : "bg-indigo-50 text-indigo-700"
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-extrabold text-slate-900">{title}</span>
          {badge}
        </span>
        {hint ? <span className="mt-0.5 block text-xs text-slate-600">{hint}</span> : null}
        {selected && giftLine ? (
          <span className="v-rise mt-0.5 block text-xs font-extrabold text-amber-700">
            {giftLine}
          </span>
        ) : null}
      </span>
      {price ? (
        <span
          className={cn(
            "shrink-0 text-sm font-black tabular-nums",
            violet ? "text-violet-900" : "text-indigo-800"
          )}
        >
          {price}
        </span>
      ) : null}
      {gift ? <GiftBadge label={gift} /> : null}
    </button>
  );
}
