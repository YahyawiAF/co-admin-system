"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { POINTS_PALIERS } from "@/lib/points-catalog";

type Props = {
  amount: number;
  /** Final balance after award (for count-up) */
  toPoints?: number;
  fromPoints?: number;
  onDone?: () => void;
  className?: string;
};

/** Floating +N flash + palier sparks when points increase */
export function PointFlash({
  amount,
  toPoints,
  fromPoints,
  onDone,
  className,
}: Props) {
  const [visible, setVisible] = useState(true);
  const [sparks, setSparks] = useState<number[]>([]);
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    const from = fromPoints ?? Math.max(0, (toPoints ?? amount) - amount);
    const to = toPoints ?? from + amount;
    const hit = POINTS_PALIERS.filter((p) => from < p && to >= p);
    if (hit.length) setSparks([...hit]);

    const t = window.setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 2200);
    return () => window.clearTimeout(t);
  }, [amount, fromPoints, toPoints, onDone]);

  if (!visible || amount <= 0) return null;

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 top-1 z-20 flex flex-col items-center gap-1",
        className
      )}
      aria-live="polite"
    >
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5",
          "bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-400",
          "text-sm font-bold text-amber-950 shadow-lg ring-2 ring-amber-200/80"
        )}
        style={{ animation: "visitorPointFlash 1.6s ease-out forwards" }}
      >
        <span className="text-base">✦</span>
        +{amount.toLocaleString("fr-FR")} PTS
      </span>
      {sparks.map((p, i) => (
        <span
          key={p}
          className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow"
          style={{
            animation: `visitorPalierSpark 1.4s ease-out ${i * 0.15}s forwards`,
          }}
        >
          ✨ Palier {p.toLocaleString("fr-FR")}
        </span>
      ))}
    </div>
  );
}
