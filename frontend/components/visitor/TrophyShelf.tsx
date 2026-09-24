"use client";

import {
  Calendar,
  Coffee,
  Lock,
  Medal,
  Smartphone,
  Star,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TrophyDef, TrophyIcon, TrophyTier } from "@/lib/points-catalog";

type TrophyRow = TrophyDef & {
  unlocked: boolean;
  unlockedAt?: string | null;
};

type Props = {
  trophies: TrophyRow[];
  highlightIds?: string[];
  className?: string;
};

const ICON: Record<TrophyIcon, typeof Star> = {
  star: Star,
  coffee: Coffee,
  calendar: Calendar,
  phone: Smartphone,
  medal: Medal,
  cup: Trophy,
};

const TIER_RING: Record<TrophyTier, string> = {
  bronze: "from-amber-700 to-amber-500",
  silver: "from-slate-400 to-slate-300",
  gold: "from-amber-400 to-yellow-300",
};

export function TrophyShelf({
  trophies,
  highlightIds = [],
  className,
}: Props) {
  const unlocked = trophies.filter((t) => t.unlocked).length;

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        Trophées · {unlocked}/{trophies.length}
      </p>
      <div className="grid grid-cols-3 gap-2.5">
        {trophies.map((t) => {
          const Icon = ICON[t.icon] || Star;
          const hi = highlightIds.includes(t.id);
          return (
            <div
              key={t.id}
              className={cn(
                "flex flex-col items-center rounded-2xl px-1.5 py-2 text-center transition",
                t.unlocked ? "bg-amber-50/80" : "bg-slate-50",
                hi &&
                  "ring-2 ring-amber-400 animate-pulse shadow-[0_0_20px_rgba(251,191,36,0.45)]"
              )}
            >
              <div
                className={cn(
                  "relative flex h-11 w-11 items-center justify-center rounded-full",
                  t.unlocked
                    ? `bg-gradient-to-br ${TIER_RING[t.tier]} text-white shadow-sm`
                    : "bg-slate-200 text-slate-400"
                )}
              >
                {t.unlocked ? (
                  <Icon className="h-5 w-5" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
              </div>
              <p
                className={cn(
                  "mt-1.5 line-clamp-2 text-[10px] font-semibold leading-tight",
                  t.unlocked ? "text-slate-800" : "text-slate-400"
                )}
              >
                {t.name}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
