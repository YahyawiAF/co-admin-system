"use client";

import { Camera, Check, Sparkles, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PROFILE_AVATAR_POINTS,
  PROFILE_DETAILS_POINTS,
  PROFILE_MISSION_TOTAL,
} from "@/lib/points-catalog";

type Props = {
  detailsDone: boolean;
  avatarDone: boolean;
  completed?: boolean;
  onEdit?: () => void;
  className?: string;
};

export function ProfileMissionCard({
  detailsDone,
  avatarDone,
  completed = false,
  onEdit,
  className,
}: Props) {
  const earned =
    (detailsDone ? PROFILE_DETAILS_POINTS : 0) +
    (avatarDone ? PROFILE_AVATAR_POINTS : 0);
  const progress = Math.round((earned / PROFILE_MISSION_TOTAL) * 100);

  if (completed) {
    return (
      <div
        className={cn(
          "rounded-3xl bg-gradient-to-br from-amber-50 to-yellow-50 px-4 py-3.5 shadow-sm ring-1 ring-amber-200/60",
          className
        )}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700/80">
          Mission profil
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-yellow-300 text-white shadow-sm">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-bold text-slate-900">Profil complet</p>
            <p className="text-[11px] text-amber-800/80">
              +{PROFILE_MISSION_TOTAL} pts · trophée or débloqué
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onEdit}
      className={cn(
        "w-full rounded-3xl bg-white px-4 py-3.5 text-left shadow-sm transition active:scale-[0.99]",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Mission profil
        </p>
        <p className="text-[11px] font-semibold tabular-nums text-indigo-600">
          {earned}/{PROFILE_MISSION_TOTAL}
        </p>
      </div>
      <p className="mt-1 text-sm font-bold text-slate-900">
        Complétez votre profil
      </p>
      <p className="mt-0.5 text-[11px] text-slate-500">
        Détails + photo pour le trophée or
      </p>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-indigo-600 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <ul className="mt-3 space-y-2">
        <li className="flex items-center gap-2.5">
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full",
              detailsDone
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-100 text-slate-400"
            )}
          >
            {detailsDone ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <UserRound className="h-3.5 w-3.5" />
            )}
          </span>
          <span className="min-w-0 flex-1 text-xs text-slate-700">
            Infos profil
          </span>
          <span
            className={cn(
              "text-[11px] font-semibold tabular-nums",
              detailsDone ? "text-emerald-600" : "text-slate-400"
            )}
          >
            +{PROFILE_DETAILS_POINTS}
          </span>
        </li>
        <li className="flex items-center gap-2.5">
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full",
              avatarDone
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-100 text-slate-400"
            )}
          >
            {avatarDone ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
          </span>
          <span className="min-w-0 flex-1 text-xs text-slate-700">
            Photo de profil
          </span>
          <span
            className={cn(
              "text-[11px] font-semibold tabular-nums",
              avatarDone ? "text-emerald-600" : "text-slate-400"
            )}
          >
            +{PROFILE_AVATAR_POINTS}
          </span>
        </li>
      </ul>
    </button>
  );
}
