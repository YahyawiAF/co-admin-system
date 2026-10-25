"use client";

import { useState } from "react";
import {
  Calendar,
  Coffee,
  Lock,
  Medal,
  Smartphone,
  Star,
  Trophy,
} from "lucide-react";
import { trophyProgress, usePlayer } from "@/lib/hooks/use-player";
import type { TrophyIcon, TrophyTier } from "@/lib/points-catalog";
import { cn } from "@/lib/utils";

const ICON: Record<TrophyIcon, typeof Star> = {
  star: Star,
  coffee: Coffee,
  calendar: Calendar,
  phone: Smartphone,
  medal: Medal,
  cup: Trophy,
};

const TIER: Record<TrophyTier, string> = {
  gold: "bg-gradient-to-br from-amber-500 via-amber-200 to-amber-600 text-amber-950",
  silver: "bg-gradient-to-br from-slate-400 via-slate-200 to-slate-500 text-slate-800",
  bronze: "bg-gradient-to-br from-orange-800 via-amber-500 to-amber-700 text-white",
};

/** 3×3 trophy shelf: unlocked ones shine; tap any to see how to get it. */
export function TrophyGrid({ memberId }: { memberId: string }) {
  const { player } = usePlayer(memberId);
  const [sel, setSel] = useState<string | null>(null);
  if (!player) return null;
  const trophies = player.trophies;
  const unlocked = trophies.filter((t) => t.unlocked).length;
  const selected =
    trophies.find((t) => t.id === sel) ??
    trophies.find((t) => !t.unlocked) ??
    trophies[0];
  const selProgress = selected ? trophyProgress(player, selected.id) : null;

  return (
    <section className="v-rise rounded-3xl bg-white p-3 shadow-sm ring-1 ring-slate-900/5 [animation-delay:120ms]">
      <div className="flex items-center justify-between px-0.5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Trophées</p>
        <span className="text-xs font-extrabold text-amber-800">
          {unlocked}/{trophies.length} débloqués
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {trophies.map((t) => {
          const Icon = ICON[t.icon] || Star;
          const on = selected?.id === t.id;
          const prog = t.unlocked ? null : trophyProgress(player, t.id);
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={on}
              onClick={() => setSel(t.id)}
              className={cn(
                "flex min-h-[84px] flex-col items-center gap-1 rounded-2xl px-1 py-2 transition-[background-color,box-shadow,transform] duration-200 active:scale-95 motion-reduce:transition-none",
                on
                  ? "bg-amber-50 ring-2 ring-amber-400"
                  : t.unlocked
                    ? "bg-amber-50/70"
                    : "bg-slate-50"
              )}
            >
              <span
                className={cn(
                  "relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full",
                  t.unlocked ? TIER[t.tier] : "bg-slate-200 text-slate-500"
                )}
              >
                {t.unlocked ? (
                  <>
                    <span aria-hidden className="v-shine absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-white/0 via-white/60 to-white/0" />
                    <Icon className="relative h-[18px] w-[18px]" strokeWidth={2.2} />
                  </>
                ) : (
                  <Lock className="h-4 w-4" />
                )}
              </span>
              <span
                className={cn(
                  "line-clamp-2 text-center text-[11px] font-bold leading-tight",
                  t.unlocked ? "text-slate-900" : "text-slate-600"
                )}
              >
                {t.name}
              </span>
              {prog ? (
                <span className="text-[10px] font-bold tabular-nums text-amber-800">
                  {prog.have.toLocaleString("fr-FR")}/{prog.target.toLocaleString("fr-FR")}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {selected ? (
        <p key={selected.id} className="v-rise mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <strong className="text-slate-900">{selected.name}</strong> ·{" "}
          {selected.unlocked
            ? `Débloqué · ${selected.description}`
            : `${selected.description}${
                selProgress
                  ? ` · ${selProgress.have.toLocaleString("fr-FR")}/${selProgress.target.toLocaleString("fr-FR")}`
                  : ""
              }`}
        </p>
      ) : null}
    </section>
  );
}
