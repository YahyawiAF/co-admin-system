"use client";

import Link from "next/link";
import { Flame, Wifi } from "lucide-react";
import { VisitorAvatar } from "@/components/visitor/MobileHeader";
import { usePlayer } from "@/lib/hooks/use-player";
import { cn } from "@/lib/utils";
import { levelLook, levelStars, levelTitle } from "@/lib/level-look";

/** Avatar with the level ring (colour of the level look) and the level number badge. */
export function LevelAvatar({
  name,
  src,
  level,
  size = 60,
  className,
}: {
  name: string;
  src?: string | null;
  /** Kept for callers; the ring now shows the level look, not a progress. */
  pct?: number;
  level: number;
  size?: number;
  className?: string;
}) {
  const ring = size >= 72 ? 5 : 4;
  return (
    <span
      className={cn("relative block shrink-0", `lvl-${levelLook(level)}`, className)}
      style={{ width: size, height: size }}
    >
      <span aria-hidden className="lvl-ring absolute inset-0 rounded-full" />
      <span className="absolute block rounded-full bg-slate-900/40" style={{ inset: ring }}>
        <VisitorAvatar name={name} src={src} className="h-full w-full" />
      </span>
      <span className="lvl-badge absolute -bottom-1 -right-1.5 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-black/30 px-1 text-xs font-black tabular-nums transition-colors duration-300">
        {level}
      </span>
    </span>
  );
}

/** « Niveau 3 · Habitué ★★ » */
export function LevelLine({ level }: { level: number }) {
  const stars = levelStars(level);
  return (
    <span className="truncate">
      Niveau <strong className="lvl-word">{level}</strong> · {levelTitle(level)}
      {stars ? (
        <span className="ml-1 tracking-wide text-amber-200" aria-label={`${stars} étoile${stars > 1 ? "s" : ""}`}>
          {"★".repeat(stars)}
        </span>
      ) : null}
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
  const levelNumber = player?.level?.number ?? 1;
  const streak = player?.streak ?? 0;

  return (
    <section className={cn("lvl-card v-rise relative overflow-hidden rounded-3xl p-3.5 text-white shadow-sm", `lvl-${levelLook(levelNumber)}`)}>
      <span aria-hidden className="v-twinkle absolute right-20 top-3 h-1 w-1 rounded-full bg-indigo-200" />
      <span aria-hidden className="v-twinkle absolute bottom-4 right-32 h-[3px] w-[3px] rounded-full bg-amber-200 [animation-delay:.8s]" />
      <div className="relative flex items-center gap-3">
        <Link href={profileHref} aria-label="Mon profil" className="rounded-full">
          <LevelAvatar name={name} src={avatarUrl} level={levelNumber} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-white/70">Bonjour,</p>
          <p className="truncate text-lg font-extrabold leading-tight">{greetingName}</p>
          <p className="mt-1 inline-flex max-w-full items-center truncate rounded-full bg-white/15 px-2 py-0.5 text-[11.5px] font-extrabold text-white">
            {player ? <LevelLine level={levelNumber} /> : facilityName}
          </p>
          {player?.level.next ? (
            <p className="mt-1 flex items-center gap-1.5 truncate text-[11px] font-semibold text-white/80">
              <span className="rounded-md bg-white/15 px-1.5 py-px font-extrabold">+1</span>
              session payée → niveau {player.level.next.name}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {streak > 0 ? (
            <div className="flex flex-col items-center rounded-2xl bg-white/10 px-2 py-1">
              <Flame className="v-flame h-5 w-5 fill-orange-400 text-orange-300" />
              <span className="text-sm font-black leading-none">{streak}</span>
              <span className="text-[10px] text-white/75">jour{streak > 1 ? "s" : ""}</span>
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
