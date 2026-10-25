"use client";

import { useEffect, useState } from "react";
import { Lock, Palette } from "lucide-react";
import { QuestSheet } from "@/components/visitor/quest/QuestSheet";
import { useOrg } from "@/lib/org";
import { usePlayer } from "@/lib/hooks/use-player";
import {
  VISITOR_THEMES,
  isThemeUnlocked,
  themeCssVars,
  useVisitorTheme,
  type VisitorTheme,
  type VisitorThemeId,
} from "@/lib/visitor-theme";
import { cn } from "@/lib/utils";

const rgb = (triplet: string) => `rgb(${triplet})`;

/** Mini phone preview of a theme (hero bar, card, button). */
function ThemeSwatch({ theme, locked }: { theme: VisitorTheme; locked: boolean }) {
  return (
    <span
      className="relative flex h-[74px] w-full flex-col gap-1.5 rounded-xl p-1.5 ring-1 ring-inset ring-slate-900/10"
      style={{ background: theme.bg }}
    >
      <span
        className="h-[18px] rounded-md"
        style={{ background: `linear-gradient(110deg, #0f172a, ${rgb(theme.primary[950])})` }}
      />
      <span className="h-3.5 rounded-[5px] bg-white ring-1 ring-slate-900/5" />
      <span
        className="h-3 rounded-full"
        style={{ background: `linear-gradient(90deg, ${rgb(theme.primary[600])}, ${rgb(theme.secondary[600])})` }}
      />
      {locked ? (
        <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-900/45 text-white">
          <Lock className="h-[18px] w-[18px]" />
        </span>
      ) : null}
    </span>
  );
}

/**
 * "Mon thème": each member picks a look. Some unlock with levels / trophies.
 * Previewing applies the theme live; closing without applying restores it.
 */
export function ThemeSheet({
  open,
  onOpenChange,
  memberId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
}) {
  const { slug } = useOrg();
  const { theme: applied, choose } = useVisitorTheme(slug);
  const { player } = usePlayer(memberId);
  const [previewId, setPreviewId] = useState<VisitorThemeId>(applied.id);

  useEffect(() => {
    if (open) setPreviewId(applied.id);
  }, [open, applied.id]);

  // Live preview: paint <html> with the previewed theme while open
  useEffect(() => {
    if (!open) return;
    const t = VISITOR_THEMES.find((x) => x.id === previewId)!;
    const root = document.documentElement;
    for (const [k, v] of Object.entries(themeCssVars(t))) root.style.setProperty(k, v);
    return () => {
      for (const [k, v] of Object.entries(themeCssVars(applied))) root.style.setProperty(k, v);
    };
  }, [open, previewId, applied]);

  const preview = VISITOR_THEMES.find((x) => x.id === previewId)!;
  const locked = !isThemeUnlocked(preview, player);
  const unlockedCount = VISITOR_THEMES.filter((t) => isThemeUnlocked(t, player)).length;
  const isApplied = preview.id === applied.id;

  return (
    <QuestSheet
      open={open}
      onOpenChange={onOpenChange}
      eyebrow="Personnalisation"
      icon={<Palette className="h-5 w-5" />}
      title="Mon thème"
      subtitle="Votre app, vos couleurs."
      chip={{ label: "Débloqués", value: `${unlockedCount}/${VISITOR_THEMES.length}` }}
      footer={
        <>
          <p
            key={preview.id}
            className={cn(
              "v-rise mb-2 rounded-xl px-3 py-2 text-xs font-bold",
              locked ? "bg-amber-50 text-amber-900" : "bg-slate-100 text-slate-700"
            )}
          >
            {locked && preview.lock
              ? `À débloquer : ${preview.lock.label}`
              : isApplied
                ? `Thème actif : ${preview.name}`
                : `Aperçu : ${preview.name} · touchez Appliquer`}
          </p>
          <button
            type="button"
            disabled={locked || isApplied}
            onClick={() => {
              choose(preview.id);
              onOpenChange(false);
            }}
            className="flex h-12 w-full items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-extrabold text-white transition-opacity duration-200 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-600 motion-reduce:transition-none"
          >
            {locked ? "Pas encore débloqué" : isApplied ? "Thème appliqué ✓" : `Appliquer ${preview.name}`}
          </button>
          <p className="mt-2 text-center text-[11px] text-slate-600">Enregistré sur cet appareil</p>
        </>
      }
    >
      <div className="grid grid-cols-3 gap-2 pb-1" role="radiogroup" aria-label="Thèmes">
        {VISITOR_THEMES.map((t) => {
          const on = t.id === previewId;
          const isLocked = !isThemeUnlocked(t, player);
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${t.name}${isLocked ? " (verrouillé)" : ""}`}
              onClick={() => setPreviewId(t.id)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-[18px] bg-white p-1.5 transition-[box-shadow,transform] duration-200 active:scale-95 motion-reduce:transition-none",
                !on && "ring-1 ring-slate-200"
              )}
              style={on ? { boxShadow: `0 0 0 2.5px ${rgb(t.primary[600])}` } : undefined}
            >
              <ThemeSwatch theme={t} locked={isLocked} />
              <span className="text-xs font-extrabold text-slate-900">{t.name}</span>
            </button>
          );
        })}
      </div>
    </QuestSheet>
  );
}
