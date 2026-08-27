export type SpaceDef = {
  name: string;
  seats: string[];
  capacity?: number;
};

export function parseFacilitySpaces(
  places: Record<string, unknown> | undefined | null
): Record<string, SpaceDef> {
  const out: Record<string, SpaceDef> = {};
  if (!places) return out;
  for (const [id, raw] of Object.entries(places)) {
    if (!raw || typeof raw !== "object") continue;
    const s = raw as Record<string, unknown>;
    const seats = Array.isArray(s.seats)
      ? (s.seats as string[])
      : Array.from(
          { length: Number(s.capacity || s.nbr || 0) },
          (_, i) => `${s.name || id}-${i + 1}`
        );
    out[id] = {
      name: String(s.name || id),
      seats,
      capacity: Number(s.capacity || seats.length),
    };
  }
  return out;
}

export function allSeatsFromSpaces(
  spaces: Record<string, SpaceDef>
): { seatId: string; spaceName: string }[] {
  return Object.values(spaces).flatMap((space) =>
    space.seats.map((seatId) => ({ seatId, spaceName: space.name }))
  );
}

export const BOOKING_EVENT_KEY = "collabora-hub";
