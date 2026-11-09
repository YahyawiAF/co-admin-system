/** One look per level: 1, 2, 3 each their own, then « Élite » from level 4. Styles: `.lvl-*` in globals.css. */
export type LevelLook = "l1" | "l2" | "l3" | "elite";

export function levelLook(level: number): LevelLook {
  if (level >= 4) return "elite";
  if (level === 3) return "l3";
  if (level === 2) return "l2";
  return "l1";
}

export function levelTitle(level: number) {
  if (level >= 4) return "Élite";
  return ["Découverte", "Régulier", "Habitué"][Math.max(1, level) - 1];
}

/** Élite: one more star every 5 levels (max 5). */
export function levelStars(level: number) {
  if (level < 4) return 0;
  return Math.min(5, 1 + Math.floor((level - 4) / 5));
}
