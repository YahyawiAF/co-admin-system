"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { Flame, Wifi } from "lucide-react";
import { VisitorAvatar } from "@/components/visitor/MobileHeader";
import { levelProgress, usePlayer } from "@/lib/hooks/use-player";
import { cn } from "@/lib/utils";

const LEVEL_IDS = ["nouveau", "habitue", "pilier", "legende"];

/** Avatar with a gold progress ring (level) and the level number badge. */
export function LevelAvatar({
  name,
  src,
  pct,
  level,
  size = 60,
  className,
}: {
  name: string;
  src?: string | null;
  pct: number;
  level: number;
  size?: number;
  className?: string;
}) {
  const stroke = size >= 72 ? 5 : 4;
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
  return (
    <span className={cn("relative block shrink-0", className)} style={{ width: size, height: size }}>
      <svg
        aria-hidden
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 -rotate-90"
      >
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth={stroke} />
        <circle
          className="v-ring-fill"
          style={{ "--ring-from": c } as CSSProperties}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#fbbf24"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute block" style={{ inset: stroke + 3 }}>
        <VisitorAvatar name={name} src={src} className="h-full w-full" />
      </span>
      <span className="absolute -bottom-0.5 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-indigo-950 bg-amber-400 px-1 text-[11px] font-black text-amber-950">
        {level}
      </span>
    </span>
  );
}

/** Accueil hero: who you are in the game — level ring, streak, points. */
export function PlayerCard({
  memberId,
  name,
  greetingName,
  avatarUrl,
  facilityName,
  profileHref,
  onWifi,
}: {
  memberId: string;
  name: string;
  greetingName: string;
  avatarUrl?: string | null;
  facilityName: string;
  profileHref: string;
  onWifi?: () => void;
}) {
  const { player } = usePlayer(memberId);
  const lp = levelProgress(player);
  const levelIdx = Math.max(0, LEVEL_IDS.indexOf(player?.level?.id ?? "nouveau"));
  const streak = player?.streak ?? 0;

  return (
    <section className="v-rise relative overflow-hidden rounded-3xl bg-[radial-gradient(120%_140%_at_100%_0%,rgb(var(--indigo-700))_0%,transparent_55%),linear-gradient(110deg,#0f172a_0%,rgb(var(--indigo-950))_100%)] p-3.5 text-white shadow-sm">
      <span aria-hidden className="v-twinkle absolute right-20 top-3 h-1 w-1 rounded-full bg-indigo-200" />
      <span aria-hidden className="v-twinkle absolute bottom-4 right-32 h-[3px] w-[3px] rounded-full bg-amber-200 [animation-delay:.8s]" />
      <div className="relative flex items-center gap-3">
        <Link href={profileHref} aria-label="Mon profil" className="rounded-full">
          <LevelAvatar name={name} src={avatarUrl} pct={lp.pct} level={levelIdx + 1} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-indigo-200">Bonjour,</p>
          <p className="truncate text-lg font-extrabold leading-tight">{greetingName}</p>
          <p className="mt-0.5 truncate text-xs text-indigo-100">
            {player ? (
              <>
                Niveau <strong className="text-amber-200">{player.level.name}</strong>
                {player.level.next ? ` · ${lp.label}` : ""}
              </>
            ) : (
              facilityName
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {streak > 0 ? (
            <div className="flex flex-col items-center rounded-2xl bg-white/10 px-2 py-1">
              <Flame className="v-flame h-5 w-5 fill-orange-400 text-orange-300" />
              <span className="text-sm font-black leading-none">{streak}</span>
              <span className="text-[10px] text-indigo-100">jour{streak > 1 ? "s" : ""}</span>
            </div>
          ) : null}
          {onWifi ? (
            <button
              type="button"
              onClick={onWifi}
              aria-label="Wi‑Fi"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm transition-colors duration-200 hover:bg-white/25 motion-reduce:transition-none"
            >
              <Wifi className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
