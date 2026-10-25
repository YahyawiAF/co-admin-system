"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Bangers } from "next/font/google";
import { Check, Clock, Crown, Flame } from "lucide-react";
import { QuestSheet } from "@/components/visitor/quest/QuestSheet";
import { levelProgress, usePlayer } from "@/lib/hooks/use-player";
import { cn } from "@/lib/utils";

const manga = Bangers({ weight: "400", subsets: ["latin"], display: "swap" });

/** One quote per day (same for everyone that day). Short, upbeat, "vous". */
export const DAILY_QUOTES = [
  "Petit pas aujourd’hui, grand projet demain. On s’y met ?",
  "Votre meilleure idée de la semaine arrive peut-être dans l’heure !",
  "Mode concentration activé. Le monde peut attendre deux heures !",
  "Un café, un objectif, et c’est parti pour une belle session !",
  "Chaque session compte : votre série grimpe, votre projet aussi !",
  "Commencez par la tâche la plus dure : le reste paraîtra facile.",
  "Pas besoin d’être parfait, juste d’avancer. Allez !",
  "Une to-do de trois lignes, pas de trente. Vous gérez !",
  "Le café est chaud, le Wi‑Fi est rapide : à vous de jouer !",
  "Aujourd’hui, on coche une case de plus que d’habitude.",
  "Les grandes choses se font une session à la fois.",
  "Respirez, priorisez, foncez. Bonne session !",
  "Votre futur vous remercie déjà d’être venu aujourd’hui.",
  "Focus 50 minutes, pause 10 : la recette des champions.",
];

export function quoteOfTheDay(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 0).getTime();
  const day = Math.floor((date.getTime() - start) / 86_400_000);
  return DAILY_QUOTES[day % DAILY_QUOTES.length];
}

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    try {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setReduce(mq.matches);
      const on = () => setReduce(mq.matches);
      mq.addEventListener("change", on);
      return () => mq.removeEventListener("change", on);
    } catch {
      return undefined;
    }
  }, []);
  return reduce;
}

/** Little floating mascot (blinks, waves) with manga action lines. */
export function Mascot({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("relative h-[92px] w-[74px] shrink-0", className)}>
      <span className="absolute left-1.5 top-[30px] h-[3px] w-2.5 -rotate-[30deg] rounded-full bg-slate-900" />
      <span className="absolute left-0.5 top-11 h-[3px] w-3 rounded-full bg-slate-900" />
      <span className="absolute left-1.5 top-[58px] h-[3px] w-2.5 rotate-[30deg] rounded-full bg-slate-900" />
      <div className="v-float absolute left-3.5 top-0 h-[92px] w-[60px]">
        <span className="absolute left-7 top-1.5 h-3.5 w-[3px] rounded-full bg-indigo-700" />
        <span
          className="v-star-spin absolute left-[22px] top-0 h-3.5 w-3.5 bg-amber-400"
          style={{ clipPath: "polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%)" }}
        />
        <span className="v-wave-arm absolute -right-1.5 top-10 h-2 w-4 rounded-full bg-violet-700" />
        <span className="absolute left-0 top-[18px] h-[58px] w-[58px] rounded-[48%_48%_44%_44%] border-[2.5px] border-slate-900 bg-gradient-to-br from-indigo-400 via-indigo-600 to-violet-700">
          <span className="v-blink absolute left-[9px] top-4 h-[15px] w-3 rounded-full border-2 border-slate-900 bg-white">
            <span className="absolute left-[3px] top-1 h-1.5 w-[5px] rounded-full bg-slate-900" />
          </span>
          <span className="v-blink absolute right-[9px] top-4 h-[15px] w-3 rounded-full border-2 border-slate-900 bg-white">
            <span className="absolute left-[3px] top-1 h-1.5 w-[5px] rounded-full bg-slate-900" />
          </span>
          <span className="absolute left-1 top-8 h-[5px] w-2 rounded-full bg-pink-300" />
          <span className="absolute right-1 top-8 h-[5px] w-2 rounded-full bg-pink-300" />
          <span className="absolute left-[20px] top-[33px] h-[7px] w-3 rounded-b-full bg-slate-900" />
        </span>
      </div>
    </div>
  );
}

/** Mascot + manga speech bubble typing the quote of the day. */
export function DailyQuote({ className }: { className?: string }) {
  const quote = useMemo(() => quoteOfTheDay(), []);
  const reduce = usePrefersReducedMotion();
  const [n, setN] = useState(0);

  useEffect(() => {
    if (reduce) {
      setN(quote.length);
      return;
    }
    setN(0);
    let i = 0;
    let typer: number | undefined;
    const startT = window.setTimeout(() => {
      typer = window.setInterval(() => {
        i += 1;
        setN(i);
        if (i >= quote.length) window.clearInterval(typer);
      }, 32);
    }, 600);
    return () => {
      window.clearTimeout(startT);
      if (typer) window.clearInterval(typer);
    };
  }, [quote, reduce]);

  const done = n >= quote.length;
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Mascot />
      <figure className="v-bubble-in relative ml-2 min-h-[84px] flex-1 rounded-[22px] border-[2.5px] border-slate-900 bg-white px-3 py-2.5 shadow-[4px_4px_0_#0f172a] [animation-delay:.4s]">
        <span
          aria-hidden
          className="absolute -left-[11px] top-[30px] h-4 w-4 rotate-45 border-b-[2.5px] border-l-[2.5px] border-slate-900 bg-white"
        />
        <p className={cn(manga.className, "relative text-base uppercase tracking-[0.06em] text-indigo-700")}>
          Citation du jour !
        </p>
        <blockquote className="relative mt-0.5 min-h-[38px] text-sm font-extrabold leading-snug text-slate-900">
          <span className="sr-only">{quote}</span>
          <span aria-hidden>
            {quote.slice(0, n)}
            {!done ? <span className="v-caret ml-px text-indigo-600">|</span> : null}
          </span>
        </blockquote>
      </figure>
    </div>
  );
}

const AUTO_CLOSE_MS = 12_000;

/**
 * Shown once right after a fresh QR check-in: celebration, streak / level,
 * quote of the day, then it closes by itself (a tap keeps it open).
 */
export function CheckinRewardSheet({
  open,
  onOpenChange,
  memberId,
  firstName,
  startedAt,
  tarifLine,
  covered,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  firstName?: string | null;
  startedAt: number;
  /** "Tarif auto activé · rien à choisir" / pass / abonnement */
  tarifLine: string;
  covered?: boolean;
}) {
  const { player } = usePlayer(memberId);
  const lp = levelProgress(player);
  const [held, setHeld] = useState(false);
  const closeRef = useRef(onOpenChange);
  closeRef.current = onOpenChange;

  useEffect(() => {
    if (!open) {
      setHeld(false);
      return;
    }
    if (held) return;
    const t = window.setTimeout(() => closeRef.current(false), AUTO_CLOSE_MS);
    return () => window.clearTimeout(t);
  }, [open, held]);

  const streak = player?.streak ?? 0;

  return (
    <QuestSheet
      open={open}
      onOpenChange={onOpenChange}
      tone="emerald"
      eyebrow="Pointage réussi"
      icon={
        <span className="v-pop flex h-7 w-7 items-center justify-center rounded-full bg-white text-emerald-700">
          <Check className="h-4 w-4" strokeWidth={3} />
        </span>
      }
      title={`C’est parti${firstName ? `, ${firstName}` : ""} !`}
      subtitle={`Pointé à ${format(startedAt, "HH:mm")}`}
      reward={
        streak > 0
          ? {
              label: "Série",
              value: (
                <>
                  <Flame className="v-flame h-6 w-6 fill-orange-300 text-orange-200" />
                  <span className="v-pop [animation-delay:.9s]">
                    {streak} jour{streak > 1 ? "s" : ""}
                  </span>
                </>
              ),
            }
          : null
      }
      chip={
        player?.level.next
          ? { label: `Vers ${player.level.next.name}`, value: `${player.level.sessions}/${player.level.next.target}` }
          : player
            ? { label: "Niveau", value: player.level.name }
            : null
      }
      banner={
        player?.level.next ? (
          <span className="mt-3 block h-2 overflow-hidden rounded-full bg-white/20">
            <span
              className="v-bar-grow block h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500 [animation-delay:.8s]"
              style={{ width: `${lp.pct}%` }}
            />
          </span>
        ) : null
      }
      footer={
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="relative flex h-12 w-full items-center justify-center overflow-hidden rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-extrabold text-white"
        >
          {!held ? (
            <span
              aria-hidden
              className="v-drain absolute inset-y-0 left-0 bg-white/20"
              style={{ ["--drain" as string]: `${AUTO_CLOSE_MS}ms` }}
            />
          ) : null}
          <span className="relative">Voir ma session</span>
        </button>
      }
    >
      <div className="space-y-3 pb-1" onPointerDown={() => setHeld(true)}>
        <DailyQuote />
        <div className="flex items-center gap-2.5 rounded-2xl bg-indigo-50 px-3 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-700">
            {covered ? <Crown className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
          </span>
          <span className="flex-1 text-sm font-bold text-indigo-950">{tarifLine}</span>
          {!covered ? (
            <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
              Par défaut
            </span>
          ) : null}
        </div>
      </div>
    </QuestSheet>
  );
}
