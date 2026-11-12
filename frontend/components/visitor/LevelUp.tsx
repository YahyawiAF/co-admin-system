"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { usePlayer } from "@/lib/hooks/use-player";
import { useModalGate } from "@/lib/modal-gate";
import { useVisitorSession } from "@/lib/visitor-session";
import { levelLook, levelTitle } from "@/lib/level-look";
import { cn } from "@/lib/utils";

const seenKey = (memberId: string) => `level-seen:${memberId}`;
const COLORS = ["#fbbf24", "#a78bfa", "#34d399", "#f472b6"];

/**
 * « Niveau N ! » once the level goes up (a session paid and closed).
 * The payment can be confirmed at the desk after checkout, so the level is re-read every minute.
 */
export function LevelUpWatcher() {
  const { memberId, onboarded } = useVisitorSession();
  const qc = useQueryClient();
  const { player } = usePlayer(onboarded ? memberId : null);
  const blocked = useModalGate();
  const [shown, setShown] = useState<{ from: number; to: number } | null>(null);

  useEffect(() => {
    if (!memberId || !onboarded) return;
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void qc.invalidateQueries({ queryKey: ["member-points", memberId] });
      }
    }, 60_000);
    return () => window.clearInterval(t);
  }, [memberId, onboarded, qc]);

  const level = player?.level?.number;
  useEffect(() => {
    if (!memberId || !level || shown) return;
    let seen: number | null = null;
    try {
      const raw = localStorage.getItem(seenKey(memberId));
      seen = raw ? Number(raw) : null;
    } catch {
      return;
    }
    if (seen == null || !Number.isFinite(seen)) {
      // First time on this phone: no party for levels earned before.
      try {
        localStorage.setItem(seenKey(memberId), String(level));
      } catch {
        /* ignore */
      }
      return;
    }
    if (level > seen) setShown({ from: seen, to: level });
  }, [memberId, level, shown]);

  const close = () => {
    if (memberId && shown) {
      try {
        localStorage.setItem(seenKey(memberId), String(shown.to));
      } catch {
        /* ignore */
      }
    }
    setShown(null);
  };

  if (!shown || blocked || typeof document === "undefined") return null;
  return createPortal(<LevelUpScreen from={shown.from} to={shown.to} onClose={close} />, document.body);
}

function LevelUpScreen({ from, to, onClose }: { from: number; to: number; onClose: () => void }) {
  const look = levelLook(to);
  const newLook = look !== levelLook(from) || to === 4;
  const confetti = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        delay: `${((i * 13) % 60) / 100}s`,
        color: COLORS[i % COLORS.length],
      })),
    []
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Can pop up over an open Sheet/Dialog (Radix sets `pointer-events: none` on body):
  // pointer-events-auto keeps « Super » clickable, stopPropagation keeps the sheet behind open.
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="level-up-title"
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        "v-fade-in pointer-events-auto fixed inset-0 z-[95] flex flex-col items-center justify-center gap-2.5 overflow-hidden px-6 text-center text-white",
        `lvl-${look}`
      )}
      style={{ background: "radial-gradient(80% 60% at 50% 40%, var(--lvl-glow) 0%, #0b0b1a 70%)" }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {confetti.map((c, i) => (
          <i
            key={i}
            className="lvl-confetti absolute -top-3 block h-3 w-[7px] rounded-sm opacity-0"
            style={{ left: c.left, background: c.color, animationDelay: c.delay }}
          />
        ))}
      </div>
      <p className="text-sm font-extrabold text-white/60 line-through">Niveau {from}</p>
      <div className="lvl-pop lvl-ring relative grid h-36 w-36 place-items-center rounded-full">
        <span className="grid h-[120px] w-[120px] place-items-center rounded-full bg-[#0b0b1a] text-6xl font-black tabular-nums">
          {to}
        </span>
      </div>
      <h2 id="level-up-title" className="mt-1 text-2xl font-black">
        Niveau {to} !
      </h2>
      <p className="max-w-[26ch] text-sm text-white/80">
        {newLook ? `Nouveau look débloqué : ${levelTitle(to)}` : "Encore un niveau, continuez !"}
      </p>
      <button
        type="button"
        autoFocus
        onClick={onClose}
        className="mt-3 h-12 rounded-full bg-white px-8 text-sm font-extrabold text-slate-900 transition-transform duration-150 active:scale-95 motion-reduce:transition-none"
      >
        Super
      </button>
    </div>
  );
}
