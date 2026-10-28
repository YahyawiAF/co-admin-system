"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bangers } from "next/font/google";
import { Star } from "lucide-react";
import { levelProgress, usePlayer } from "@/lib/hooks/use-player";
import { cn } from "@/lib/utils";

const manga = Bangers({ weight: "400", subsets: ["latin"], display: "swap" });

/** Confetti pieces: where each one flies to, and its color. */
const CONFETTI: [number, number, string][] = [
  [-150, -120, "#fbbf24"],
  [140, -140, "#a78bfa"],
  [-120, 90, "#34d399"],
  [160, 70, "#f472b6"],
  [-40, -190, "#fde68a"],
  [60, 170, "#60a5fa"],
  [-175, -20, "#f472b6"],
  [180, -30, "#fbbf24"],
  [100, -200, "#34d399"],
  [-90, 180, "#a78bfa"],
  [20, -220, "#60a5fa"],
  [-200, 120, "#fde68a"],
];

const LEAVE_MS = 220;

/**
 * Very first check-in: full-screen "Niveau 1 débloqué" welcome
 * (badge drop, confetti, title slam, then trophy / seat / Wi‑Fi).
 * Takes the place of the usual check-in reward that one time.
 */
export function FirstVisitWelcome({
  open,
  onOpenChange,
  memberId,
  firstName,
  seatLabel,
  spaceName,
  wifiSsid,
  tarifLine,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  firstName?: string | null;
  seatLabel?: string | null;
  spaceName?: string | null;
  wifiSsid?: string | null;
  tarifLine: string;
}) {
  const { player } = usePlayer(memberId);
  const lp = levelProgress(player);
  const nextName = player?.level?.next?.name;
  const [mounted, setMounted] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const ctaRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setLeaving(false);
    // focus after the entrance, Escape closes
    const t = window.setTimeout(() => ctaRef.current?.focus(), 2100);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = () => {
    setLeaving(true);
    window.setTimeout(() => onOpenChange(false), LEAVE_MS);
  };

  if (!open || !mounted) return null;

  return createPortal(
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-visit-title"
      className={cn(
        "v-fade-in fixed inset-0 z-[80] flex flex-col items-center overflow-hidden px-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-[max(3.5rem,env(safe-area-inset-top))] text-white transition-opacity duration-200 ease-out",
        "bg-[radial-gradient(120%_70%_at_50%_25%,#6d28d9_0%,#3730a3_45%,#0f172a_100%)]",
        leaving && "opacity-0",
      )}
    >
      <div className="relative mx-auto flex w-full max-w-[420px] flex-1 flex-col items-center">
        {/* light rays behind the badge */}
        <div
          aria-hidden
          className="w-rays pointer-events-none absolute left-1/2 top-[175px] -ml-[260px] -mt-[260px] h-[520px] w-[520px] rounded-full [background:repeating-conic-gradient(rgba(253,230,138,.22)_0_8deg,transparent_8deg_22deg)] [mask-image:radial-gradient(circle,#000_20%,transparent_65%)]"
        />
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-[175px]">
          {CONFETTI.map(([dx, dy, color], i) => (
            <span
              key={i}
              className="w-burst absolute h-3.5 w-[9px] rounded-[2px]"
              style={
                {
                  background: color,
                  "--dx": `${dx}px`,
                  "--dy": `${dy}px`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>

        <p className="v-rise relative text-xs font-bold uppercase tracking-[0.18em] text-violet-300 [animation-delay:1.35s]">
          Première visite
        </p>

        <div className="w-badge-in relative mt-5">
          <div className="v-float relative h-[148px] w-[148px] [animation-delay:1.2s]">
            <div
              aria-hidden
              className="w-spin absolute -inset-2.5 rounded-full border-[3px] border-dashed border-amber-200/70"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-full border-4 border-slate-900 bg-gradient-to-br from-amber-200 via-amber-500 to-amber-700 shadow-[6px_6px_0_#0f172a]">
              <Star className="h-10 w-10 fill-white text-slate-900" strokeWidth={1.5} />
              <span className={cn(manga.className, "text-[34px] leading-none tracking-wide text-slate-900")}>
                NIV. 1
              </span>
            </div>
          </div>
        </div>

        <h2
          id="first-visit-title"
          className={cn(
            manga.className,
            "w-slam relative mt-7 text-center text-[46px] leading-none tracking-wide text-amber-200 [text-shadow:3px_3px_0_#0f172a]",
          )}
        >
          Bienvenue{firstName ? `, ${firstName}` : ""} !
        </h2>
        <p className="v-rise relative mt-2 text-center text-[15px] text-indigo-100 [animation-delay:1.35s]">
          Niveau 1 débloqué. Votre aventure commence ici.
        </p>

        <div className="v-rise relative mt-5 w-full [animation-delay:1.5s]">
          <div className="flex justify-between text-xs font-semibold text-indigo-200">
            <span>{player?.level?.name || "Nouveau"}</span>
            <span>{nextName || "Niveau 2"}</span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/15">
            <div
              className="v-bar-grow h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-200 [animation-delay:1.9s]"
              style={{ width: `${Math.max(6, player ? lp.pct : 10)}%` }}
            />
          </div>
          {player?.level?.next ? (
            <p className="mt-1 text-right text-[11px] text-indigo-200">{lp.label}</p>
          ) : null}
        </div>

        <div className="relative mt-4 grid w-full grid-cols-2 gap-2.5">
          <div className="v-rise rounded-2xl border border-white/20 bg-white/10 px-3 py-2.5 [animation-delay:1.65s]">
            <p className="text-[11px] font-semibold text-indigo-200">Trophée débloqué</p>
            <p className="mt-0.5 text-sm font-extrabold">Premier check-in</p>
          </div>
          <div className="v-rise rounded-2xl border border-white/20 bg-white/10 px-3 py-2.5 [animation-delay:1.65s]">
            <p className="text-[11px] font-semibold text-indigo-200">Votre place</p>
            <p className="mt-0.5 truncate text-sm font-extrabold">
              {seatLabel
                ? `${seatLabel}${spaceName ? ` · ${spaceName}` : ""}`
                : "Installez-vous librement"}
            </p>
          </div>
          <div className="v-rise col-span-2 flex items-center justify-between gap-3 rounded-2xl border border-white/20 bg-white/10 px-3 py-2.5 [animation-delay:1.8s]">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-indigo-200">
                {wifiSsid ? "Wi‑Fi" : "Tarif"}
              </p>
              <p className="mt-0.5 truncate text-sm font-extrabold">{wifiSsid || tarifLine}</p>
            </div>
            {wifiSsid ? (
              <span className="shrink-0 text-right text-xs text-indigo-100">{tarifLine}</span>
            ) : null}
          </div>
        </div>

        <div className="flex-1" />
        <button
          ref={ctaRef}
          type="button"
          onClick={close}
          className={cn(
            manga.className,
            "w-cta relative mt-6 h-[54px] w-full rounded-2xl border-[3px] border-slate-900 text-2xl tracking-wider text-slate-900 shadow-[4px_4px_0_#0f172a] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_#0f172a]",
          )}
        >
          C’est parti !
        </button>
      </div>
    </section>,
    document.body,
  );
}
