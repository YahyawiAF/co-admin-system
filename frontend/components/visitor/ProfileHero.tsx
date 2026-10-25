"use client";

import { useState } from "react";
import { Flame, Lock, Pencil, QrCode } from "lucide-react";
import { LevelAvatar } from "@/components/visitor/PlayerCard";
import { MemberQrSheet } from "@/components/visitor/MemberQrSheet";
import { levelProgress, usePlayer } from "@/lib/hooks/use-player";
import { pointsToDt } from "@/lib/points-catalog";

const LEVEL_IDS = ["nouveau", "habitue", "pilier", "legende"];
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
  const lp = levelProgress(player);
  const levelIdx = Math.max(0, LEVEL_IDS.indexOf(player?.level?.id ?? "nouveau"));

  return (
    <div className="space-y-2.5">
      <section className="v-rise relative overflow-hidden rounded-3xl bg-[radial-gradient(120%_140%_at_100%_0%,rgb(var(--indigo-700))_0%,transparent_55%),linear-gradient(110deg,#0f172a_0%,rgb(var(--indigo-950))_100%)] p-3.5 text-white shadow-sm">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={onEdit}
            disabled={!onEdit}
            aria-label="Modifier mon profil"
            className="relative shrink-0 rounded-full disabled:cursor-default"
          >
            <LevelAvatar name={name} src={avatarUrl} pct={lp.pct} level={levelIdx + 1} size={80} />
            {onEdit ? (
              <span className="absolute -left-0.5 bottom-0 flex h-6 w-6 items-center justify-center rounded-full bg-white text-indigo-700 shadow">
                <Pencil className="h-3 w-3" />
              </span>
            ) : null}
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-black leading-tight">{name}</p>
            {subtitle ? (
              <p className="truncate text-xs text-indigo-100">{subtitle}</p>
            ) : null}
            {player ? (
              <>
                <p className="mt-1 text-xs text-indigo-100">
                  Niveau <strong className="text-amber-200">{player.level.name}</strong>
                  {player.level.next ? ` → ${player.level.next.name}` : " · niveau max"}
                </p>
                {player.level.next ? (
                  <>
                    <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-white/20">
                      <span
                        className="v-bar-grow block h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500"
                        style={{ width: `${lp.pct}%` }}
                      />
                    </span>
                    <p className="mt-1 text-[11px] text-indigo-100">
                      {player.level.sessions}/{player.level.next.target} sessions
                    </p>
                  </>
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
