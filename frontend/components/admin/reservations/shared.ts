import type { BookingRequest, Facility, Space } from "@/lib/types";

/** One color per booking on the day plan. */
export const BOOKING_COLORS = ["#4f46e5", "#0e7490", "#c2410c", "#be185d", "#15803d", "#7c3aed", "#b45309"];

/** Prefer the real desk facility (has places/spaces), not empty auto-created shells. */
export function pickMainFacility(facilities: Facility[]) {
  if (!facilities.length) return undefined;
  const score = (f: Facility) => {
    const places = f.places && typeof f.places === "object" ? Object.keys(f.places).length : 0;
    const spaces = Array.isArray(f.spaces) ? f.spaces.length : 0;
    return places * 100 + spaces * 50 + (f.nbrPlaces || 0);
  };
  return [...facilities].sort((a, b) => score(b) - score(a))[0];
}

export function initialsOf(name?: string | null) {
  const parts = (name || "Visiteur").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "V") + (parts[1]?.[0] || "")).toUpperCase();
}

export function labelsOf(r: BookingRequest) {
  return r.seatLabels?.length ? r.seatLabels : r.seatLabel ? [r.seatLabel] : [];
}

/** Spaces drawn with chairs (the ones a seat booking can point to). */
export function seatSpacesOf(spaces: Space[]) {
  return spaces.filter((s) => (s.tables || []).some((t) => (t.seats || []).length > 0));
}

/** The space a seat booking belongs to (by id, else by its first label). */
export function spaceOfBooking(r: BookingRequest, spaces: Space[]) {
  const id = r.seatSpaceId || r.spaceId;
  const byId = id ? spaces.find((s) => s.id === id) : undefined;
  if (byId) return byId;
  const first = labelsOf(r)[0];
  if (!first) return undefined;
  return spaces.find((s) => (s.tables || []).some((t) => (t.seats || []).some((x) => x.label === first)));
}

export function tableOfLabel(space: Space | undefined, label: string | undefined) {
  if (!space || !label) return null;
  return space.tables?.find((t) => (t.seats || []).some((s) => s.label === label)) ?? null;
}

export function overlaps(a: BookingRequest, b: BookingRequest) {
  return new Date(a.startAt) < new Date(b.endAt) && new Date(b.startAt) < new Date(a.endAt);
}

export type DayPart = "am" | "pm" | "day";

/** Morning (ends by 13:00), afternoon (starts at 13:00+), or the whole day. */
export function partOf(r: BookingRequest): DayPart {
  const s = new Date(r.startAt);
  const e = new Date(r.endAt);
  const start = s.getHours() + s.getMinutes() / 60;
  const end = e.getHours() + e.getMinutes() / 60;
  if (end <= 13) return "am";
  if (start >= 13) return "pm";
  return "day";
}

export const PART_LABEL: Record<DayPart, string> = {
  am: "Matin",
  pm: "Après-midi",
  day: "Journée",
};

export function dt(v: number) {
  return `${v.toFixed(3).replace(/\.?0+$/, "") || "0"} DT`;
}
