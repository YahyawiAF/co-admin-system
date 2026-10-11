/** Mirrors backend/src/modules/price/price-availability.ts */
export type CreneauPrice = {
  availableFromHour?: number | null;
  availableToHour?: number | null;
  availableDays?: number[] | null;
};

export const DAY_SHORT = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];

export function hasCreneau(p: CreneauPrice) {
  return p.availableFromHour != null && p.availableToHour != null;
}

/** Hours past 24 belong to the previous day (25 = 1h du matin). */
export function priceAvailableAt(p: CreneauPrice, at = new Date()) {
  if (!hasCreneau(p)) return true;
  const from = p.availableFromHour!;
  const to = p.availableToHour!;
  let hour = at.getHours() + at.getMinutes() / 60;
  let day = at.getDay();
  if (to > 24 && hour < to - 24) {
    hour += 24;
    day = (day + 6) % 7;
  }
  const days = p.availableDays ?? [];
  if (days.length && !days.includes(day)) return false;
  return hour >= from && hour < to;
}

export function creneauLabel(p: CreneauPrice) {
  if (!hasCreneau(p)) return "";
  const hours = `${p.availableFromHour}h–${p.availableToHour! % 24}h`;
  const days = p.availableDays ?? [];
  return days.length && days.length < 7
    ? `${days.map((d) => DAY_SHORT[d]).join(", ")} ${hours}`
    : hours;
}
