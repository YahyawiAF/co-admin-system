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
