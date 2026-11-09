"use client";

import { Check } from "lucide-react";
import { usePlayer } from "@/lib/hooks/use-player";
import { levelLook } from "@/lib/level-look";
import { cn } from "@/lib/utils";

/** In the session: the two steps that move the visitor to the next level. */
export function LevelSteps({ memberId, paid }: { memberId: string; paid: boolean }) {
  const { player } = usePlayer(memberId);
  if (!player) return null;
  const next = (player.level.number ?? 1) + 1;
  const steps = [
    {
      done: paid,
      title: "Payer à l'accueil",
      hint: paid ? "Payé" : "L'accueil confirme le paiement",
    },
    { done: false, title: "Terminer la session", hint: "Bouton « Terminer » en haut" },
  ];
  return (
    <section className="v-rise rounded-3xl bg-white p-3.5 shadow-sm ring-1 ring-slate-900/5 [animation-delay:80ms]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
          Passer au niveau {next}
        </p>
        <span
          className={cn(
            "lvl-badge flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-xs font-black tabular-nums",
            `lvl-${levelLook(next)}`
          )}
        >
          {next}
        </span>
      </div>
      <ol className="space-y-1.5">
        {steps.map((s, i) => (
          <li
            key={s.title}
            className={cn(
              "flex items-center gap-2.5 rounded-2xl border-[1.5px] px-2.5 py-2 text-[13px] font-bold transition-colors duration-300 motion-reduce:transition-none",
              s.done ? "border-emerald-200 bg-emerald-50" : "border-slate-200"
            )}
          >
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-black transition-colors duration-300 motion-reduce:transition-none",
                s.done ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600"
              )}
            >
              {s.done ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
            </span>
            <span className="min-w-0">
              {s.title}
              <span className="block text-[11.5px] font-medium text-slate-500">{s.hint}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
