"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Gift, Trophy, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PROFILE_MISSION_TOTAL } from "@/lib/points-catalog";

type Phase = "box" | "open" | "burst" | "trophy";

type Props = {
  open: boolean;
  points?: number;
  title?: string;
  subtitle?: string;
  onClose: () => void;
};

const PARTICLES = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2;
  return {
    x: Math.cos(angle) * 88,
    y: Math.sin(angle) * 88,
    color: i % 3 === 0 ? "#fbbf24" : i % 3 === 1 ? "#f59e0b" : "#fde68a",
  };
});

/**
 * Gift box opens → particle burst → gold trophy with mission points.
 */
export function TrophyReveal({
  open,
  points = PROFILE_MISSION_TOTAL,
  title = "Profil complet",
  subtitle = "Mission réussie",
  onClose,
}: Props) {
  const [phase, setPhase] = useState<Phase>("box");

  useEffect(() => {
    if (!open) {
      setPhase("box");
      return;
    }
    setPhase("box");
    const t1 = window.setTimeout(() => setPhase("open"), 450);
    const t2 = window.setTimeout(() => setPhase("burst"), 900);
    const t3 = window.setTimeout(() => setPhase("trophy"), 1300);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [open]);

  if (!open) return null;

  const showBurst = phase === "burst" || phase === "trophy";
  const showTrophy = phase === "trophy";
  const showBox = phase === "box" || phase === "open" || phase === "burst";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 px-6 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white"
        aria-label="Fermer"
        onClick={onClose}
      >
        <X className="h-5 w-5" />
      </button>

      <div
        className="relative flex w-full max-w-xs flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {showBurst
          ? PARTICLES.map((p, i) => (
              <span
                key={i}
                className="trophy-reveal-particle pointer-events-none absolute left-1/2 top-[3.5rem] h-2 w-2 -translate-x-1/2 rounded-full"
                style={
                  {
                    background: p.color,
                    "--tx": `${p.x}px`,
                    "--ty": `${p.y}px`,
                  } as CSSProperties
                }
              />
            ))
          : null}

        {showBox && !showTrophy ? (
          <div
            className={cn(
              "trophy-reveal-box relative flex h-28 w-28 items-center justify-center",
              phase === "open" && "trophy-reveal-box-open",
              phase === "burst" && "trophy-reveal-box-burst"
            )}
          >
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-xl" />
            <div
              className={cn(
                "trophy-reveal-lid absolute -top-3 left-1/2 h-8 w-[7.5rem] -translate-x-1/2 rounded-t-xl bg-gradient-to-br from-amber-400 to-amber-500 shadow-md",
                (phase === "open" || phase === "burst") &&
                  "trophy-reveal-lid-open"
              )}
            />
            <Gift className="relative z-[1] h-12 w-12 text-white drop-shadow" />
          </div>
        ) : null}

        {showTrophy ? (
          <div className="trophy-reveal-trophy flex flex-col items-center text-center">
            <div className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-yellow-300 shadow-[0_0_40px_rgba(251,191,36,0.55)] ring-4 ring-amber-200/80">
              <Trophy className="h-14 w-14 text-white drop-shadow-md" />
            </div>
            <p className="mt-5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
              {subtitle}
            </p>
            <h2 className="mt-1 text-2xl font-bold text-white">{title}</h2>
            <p className="trophy-reveal-points mt-3 text-3xl font-bold tabular-nums text-amber-300">
              +{points}
              <span className="ml-1 text-base font-semibold text-amber-200/90">
                pts
              </span>
            </p>
            <button
              type="button"
              className="mt-6 h-11 rounded-full bg-white px-8 text-sm font-semibold text-slate-900 shadow-lg"
              onClick={onClose}
            >
              Super !
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
