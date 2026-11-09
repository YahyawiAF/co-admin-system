"use client";

import { useState } from "react";
import { Flame, Lock, Pencil, QrCode } from "lucide-react";
import { LevelAvatar, LevelLine } from "@/components/visitor/PlayerCard";
import { levelLook } from "@/lib/level-look";
import { cn } from "@/lib/utils";
import { MemberQrSheet } from "@/components/visitor/MemberQrSheet";
import { usePlayer } from "@/lib/hooks/use-player";
import { pointsToDt } from "@/lib/points-catalog";

const TILE = "rounded-[20px] bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-900/5";

/** Profile header as a player card + "Mon QR" + the three stats. */
export function ProfileHero({
  memberId,
  name,
  subtitle,
  avatarUrl,
  onEdit,
}: {
  memberId: string;
  name: string;
  subtitle?: string | null;
  avatarUrl?: string | null;
  onEdit?: () => void;
}) {
  const [qrOpen, setQrOpen] = useState(false);
  const { player } = usePlayer(memberId);
  const levelNumber = player?.level?.number ?? 1;

  return (
    <div className="space-y-2.5">
      <section className={cn("lvl-card v-rise relative overflow-hidden rounded-3xl p-3.5 text-white shadow-sm", `lvl-${levelLook(levelNumber)}`)}>
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={onEdit}
            disabled={!onEdit}
            aria-label="Modifier mon profil"
            className="relative shrink-0 rounded-full disabled:cursor-default"
          >
            <LevelAvatar name={name} src={avatarUrl} level={levelNumber} size={80} />
            {onEdit ? (
              <span className="absolute -left-0.5 bottom-0 flex h-6 w-6 items-center justify-center rounded-full bg-white text-indigo-700 shadow">
                <Pencil className="h-3 w-3" />
              </span>
            ) : null}
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-black leading-tight">{name}</p>
            {subtitle ? (
              <p className="truncate text-xs text-white/75">{subtitle}</p>
            ) : null}
            {player ? (
              <>
                <p className="mt-1 inline-flex max-w-full items-center truncate rounded-full bg-white/15 px-2 py-0.5 text-[11.5px] font-extrabold">
                  <LevelLine level={levelNumber} />
                </p>
                {player.level.next ? (
                  <p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-white/80">
                    <span className="rounded-md bg-white/15 px-1.5 py-px font-extrabold">+1</span>
                    session payée → niveau {player.level.next.name}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            aria-label="Afficher mon QR"
            className="flex w-14 shrink-0 flex-col items-center gap-1 self-start rounded-2xl bg-white/15 py-2 ring-1 ring-inset ring-white/25 transition-[background-color,transform] duration-200 hover:bg-white/25 active:scale-95 motion-reduce:transition-none"
          >
            <QrCode className="h-6 w-6" />
            <span className="text-[11px] font-extrabold">Mon QR</span>
          </button>
        </div>
      </section>

      <div className="v-rise grid grid-cols-3 gap-2 [animation-delay:60ms]">
        <div className={TILE}>
          <p className="text-[11px] font-bold text-slate-500">Points</p>
          {player && !player.locked ? (
            <>
              <p className="mt-0.5 text-xl font-black tabular-nums text-indigo-700">
                {player.points.toLocaleString("fr-FR")}
              </p>
              <p className="text-[11px] text-slate-600">= {pointsToDt(player.points).toLocaleString("fr-FR")} DT</p>
            </>
          ) : (
            <>
              <p className="mt-1 flex items-center gap-1 text-sm font-extrabold text-slate-700">
                <Lock className="h-3.5 w-3.5" /> Verrouillé
              </p>
              <p className="text-[11px] text-slate-600">Gagnés dans l’app</p>
            </>
          )}
        </div>
        <div className={TILE}>
          <p className="text-[11px] font-bold text-slate-500">Série</p>
          <p className="mt-0.5 flex items-center gap-1 text-xl font-black tabular-nums text-slate-900">
            {player?.streak ?? 0}
            {(player?.streak ?? 0) > 0 ? (
              <Flame className="v-flame h-[18px] w-[18px] fill-orange-400 text-orange-600" />
            ) : null}
          </p>
          <p className="text-[11px] text-slate-600">jours de suite</p>
        </div>
        <div className={TILE}>
          <p className="text-[11px] font-bold text-slate-500">Sessions</p>
          <p className="mt-0.5 text-xl font-black tabular-nums text-slate-900">
            {player?.stats.sessions ?? 0}
          </p>
          <p className="text-[11px] text-slate-600">au total</p>
        </div>
      </div>

      <MemberQrSheet open={qrOpen} onOpenChange={setQrOpen} memberId={memberId} />
    </div>
  );
}
