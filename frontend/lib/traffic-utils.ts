/** Indexed like `Date.getDay()` (0 = dimanche). */
export const WEEKDAY_LABELS = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
] as const;

export const WEEKDAY_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"] as const;

/** Monday-first display order. */
export const WEEKDAYS_MON_FIRST = [1, 2, 3, 4, 5, 6, 0] as const;

export function hourLabel(h: number) {
  return `${h}h`;
}

/** 9.5 → "9h30" */
export function decimalHourLabel(h: number) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm ? `${hh}h${String(mm).padStart(2, "0")}` : `${hh}h`;
}

export function memberName(m?: {
  firstName?: string | null;
  lastName?: string | null;
  visitorNumber?: number | null;
} | null) {
  if (!m) return "Membre";
  const name = [m.firstName, m.lastName].filter(Boolean).join(" ").trim() || "Membre";
  return m.visitorNumber != null ? `${name} #${m.visitorNumber}` : name;
}

export function percentDelta(value: number, base: number): number | null {
  if (!base) return null;
  return Math.round(((value - base) / base) * 100);
}

/** Round averages to whole people — "0.3" is meaningless for headcount. */
export function formatPeopleCount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n < 0.5) return "< 1";
  return String(Math.round(n));
}

/** Tooltip / detail: explain fractional averages in plain French. */
export function formatPeopleDetail(n: number, unit = "personne"): string {
  if (!Number.isFinite(n) || n <= 0) return `0 ${unit}`;
  if (n < 1) {
    const every = Math.max(2, Math.round(1 / n));
    return `≈ 1 ${unit} tous les ${every} jours`;
  }
  const rounded = Math.round(n);
  if (Math.abs(n - rounded) < 0.05) return `${rounded} ${unit}${rounded > 1 ? "s" : ""}`;
  return `≈ ${rounded} ${unit}${rounded > 1 ? "s" : ""}`;
}

export type HourStrength = "empty" | "weak" | "ok" | "strong";

/** Relative to that day's peak — makes weak vs strong hours obvious. */
export function hourStrength(value: number, peak: number): HourStrength {
  if (!Number.isFinite(value) || value <= 0 || peak <= 0) return "empty";
  const r = value / peak;
  if (r >= 0.7) return "strong";
  if (r >= 0.35) return "ok";
  return "weak";
}

export const HOUR_STRENGTH_LABEL: Record<HourStrength, string> = {
  empty: "Fermé / vide",
  weak: "Creux",
  ok: "Correct",
  strong: "Fort",
};

export const HOUR_STRENGTH_CLASS: Record<HourStrength, string> = {
  empty: "bg-muted/60 text-muted-foreground",
  weak: "bg-amber-100 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100",
  ok: "bg-sky-200 text-sky-950 dark:bg-sky-900/50 dark:text-sky-50",
  strong: "bg-indigo-500 text-white dark:bg-indigo-400 dark:text-indigo-950",
};
