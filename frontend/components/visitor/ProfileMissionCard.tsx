"use client";

import { useState } from "react";
import {
  Camera,
  Check,
  ChevronRight,
  Gift,
  Sparkles,
  Target,
  Trophy,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

/**
 * Compact game-style mission chip → opens a quest modal.
 */
export function ProfileMissionCard({
  detailsDone,
  avatarDone,
  completed = false,
  onEdit,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const earned =
    (detailsDone ? PROFILE_DETAILS_POINTS : 0) +
    (avatarDone ? PROFILE_AVATAR_POINTS : 0);
  const progress = Math.round((earned / PROFILE_MISSION_TOTAL) * 100);
  const stepsDone = (detailsDone ? 1 : 0) + (avatarDone ? 1 : 0);

  const startMission = () => {
    setOpen(false);
    onEdit?.();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group flex w-full items-center gap-3 rounded-3xl bg-white px-3.5 py-3 text-left shadow-sm transition active:scale-[0.99]",
          completed
            ? "ring-1 ring-amber-200/80"
            : "ring-1 ring-indigo-100",
          className
        )}
      >
        <span
          className={cn(
            "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm",
            completed
              ? "bg-gradient-to-br from-amber-400 to-yellow-300"
              : "bg-gradient-to-br from-indigo-600 to-indigo-500"
          )}
        >
          {completed ? (
            <Trophy className="h-5 w-5" />
          ) : (
            <Target className="h-5 w-5" />
          )}
          {!completed ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[9px] font-bold text-white shadow">
              !
            </span>
          ) : null}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Défi
            </span>
            {!completed ? (
              <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                Actif
              </span>
            ) : (
              <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                Terminé
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-sm font-bold text-slate-900">
            {completed ? "Profil complet" : "Mission profil"}
          </span>
          <span className="mt-1 flex items-center gap-2">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
              <span
                className={cn(
                  "block h-full rounded-full transition-all duration-500",
                  completed ? "bg-amber-400" : "bg-indigo-600"
                )}
                style={{ width: `${completed ? 100 : progress}%` }}
              />
            </span>
            <span
              className={cn(
                "text-[11px] font-semibold tabular-nums",
                completed ? "text-amber-700" : "text-indigo-600"
              )}
            >
              {completed ? PROFILE_MISSION_TOTAL : earned}/
              {PROFILE_MISSION_TOTAL}
            </span>
          </span>
        </span>

        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-active:translate-x-0.5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[22rem] gap-0 overflow-hidden rounded-3xl border-0 p-0 shadow-xl sm:max-w-md [&>button]:right-3 [&>button]:top-3 [&>button]:rounded-full [&>button]:bg-white/20 [&>button]:p-1.5 [&>button]:text-white [&>button]:opacity-95 [&>button]:ring-0 [&>button]:hover:bg-white/30 [&>button]:hover:opacity-100 [&>button]:focus:ring-0">
          {/* Quest banner */}
          <div
            className={cn(
              "relative px-5 pb-5 pt-6 text-white",
              completed
                ? "bg-gradient-to-br from-amber-500 via-amber-400 to-yellow-300"
                : "bg-gradient-to-br from-indigo-700 via-indigo-600 to-indigo-500"
            )}
          >
            <div className="pointer-events-none absolute inset-0 opacity-20">
              <div className="absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/40" />
              <div className="absolute -bottom-10 left-8 h-24 w-24 rounded-full bg-white/25" />
            </div>

            <DialogHeader className="relative space-y-0 text-left">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/75">
                {completed ? "Défi réussi" : "Nouveau défi"}
              </p>
              <DialogTitle className="mt-1 flex items-center gap-2 text-xl font-bold text-white">
                {completed ? (
                  <Trophy className="h-5 w-5 text-white" />
                ) : (
                  <Target className="h-5 w-5 text-white" />
                )}
                Mission profil
              </DialogTitle>
              <p className="mt-1.5 text-[13px] leading-snug text-white/85">
                {completed
                  ? "Trophée or débloqué — bravo !"
                  : "Complétez votre profil et gagnez un trophée or."}
              </p>
            </DialogHeader>

            <div className="relative mt-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-white/70">
                  Récompense
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-2xl font-bold tabular-nums">
                  <Gift className="h-5 w-5" />
                  +{PROFILE_MISSION_TOTAL}
                  <span className="text-sm font-semibold text-white/90">
                    pts
                  </span>
                </p>
              </div>
              <div className="rounded-2xl bg-white/15 px-3 py-2 text-center backdrop-blur-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-white/75">
                  Étapes
                </p>
                <p className="text-lg font-bold tabular-nums">
                  {stepsDone}
                  <span className="text-sm font-semibold text-white/80">/2</span>
                </p>
              </div>
            </div>
          </div>

          {/* Objectives */}
          <div className="space-y-3 bg-white px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Objectifs
            </p>

            <ul className="space-y-2.5">
              <MissionStep
                done={detailsDone}
                icon={UserRound}
                title="Infos profil"
                hint="Prénom, nom, métier + compétences ou bio"
                points={PROFILE_DETAILS_POINTS}
              />
              <MissionStep
                done={avatarDone}
                icon={Camera}
                title="Photo de profil"
                hint="Ajoutez votre photo"
                points={PROFILE_AVATAR_POINTS}
              />
            </ul>

            <div className="rounded-2xl bg-slate-50 px-3.5 py-3">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Progression</span>
                <span className="font-semibold tabular-nums text-indigo-600">
                  {progress}%
                </span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    completed
                      ? "bg-gradient-to-r from-amber-400 to-yellow-300"
                      : "bg-indigo-600"
                  )}
                  style={{ width: `${completed ? 100 : progress}%` }}
                />
              </div>
            </div>

            {completed ? (
              <div className="flex items-center gap-2.5 rounded-2xl bg-amber-50 px-3.5 py-3 ring-1 ring-amber-200/70">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-yellow-300 text-white shadow-sm">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    Trophée or obtenu
                  </p>
                  <p className="text-[11px] text-amber-800/80">
                    Visible dans vos trophées
                  </p>
                </div>
              </div>
            ) : (
              <Button
                className="h-12 w-full rounded-full bg-indigo-600 text-sm font-semibold hover:bg-indigo-700"
                onClick={startMission}
              >
                {stepsDone === 0
                  ? "Commencer la mission"
                  : "Continuer la mission"}
              </Button>
            )}

            {!completed ? (
              <p className="text-center text-[11px] text-slate-400">
                Enregistrez pour ouvrir le coffre et le trophée
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function MissionStep({
  done,
  icon: Icon,
  title,
  hint,
  points,
}: {
  done: boolean;
  icon: typeof UserRound;
  title: string;
  hint: string;
  points: number;
}) {
  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-2xl px-3 py-2.5 ring-1",
        done
          ? "bg-emerald-50/80 ring-emerald-100"
          : "bg-white ring-slate-100"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          done
            ? "bg-emerald-500 text-white"
            : "bg-indigo-50 text-indigo-600"
        )}
      >
        {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "text-sm font-semibold",
              done ? "text-emerald-900" : "text-slate-900"
            )}
          >
            {title}
          </span>
          <span
            className={cn(
              "text-[11px] font-bold tabular-nums",
              done ? "text-emerald-600" : "text-indigo-600"
            )}
          >
            +{points}
          </span>
        </span>
        <span
          className={cn(
            "mt-0.5 block text-[11px]",
            done ? "text-emerald-700/80" : "text-slate-500"
          )}
        >
          {done ? "Objectif validé" : hint}
        </span>
      </span>
    </li>
  );
}
