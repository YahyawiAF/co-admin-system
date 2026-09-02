import type { Price, Space } from "@/lib/types";

export type SpaceReserveMode = "SEAT" | "WHOLE" | "BOTH";

export const SPACE_RESERVE_MODE_LABEL: Record<SpaceReserveMode, string> = {
  SEAT: "Par place uniquement",
  WHOLE: "Espace entier uniquement",
  BOTH: "Par place ou espace entier",
};

export function spaceAllowsSeat(space: {
  reserveMode?: SpaceReserveMode | string | null;
}) {
  return (space.reserveMode || "BOTH") !== "WHOLE";
}

export function spaceAllowsWhole(space: {
  reserveMode?: SpaceReserveMode | string | null;
}) {
  return (space.reserveMode || "BOTH") !== "SEAT";
}

export function priceLinkedSpaceIds(price: Price): string[] {
  if (price.spaceIds?.length) return price.spaceIds;
  if (price.offerSpaces?.length) {
    return price.offerSpaces.map((o) => o.spaceId);
  }
  if (price.spaceId) return [price.spaceId];
  return [];
}

export function spacesForPrice(spaces: Space[], price: Price): Space[] {
  const ids = priceLinkedSpaceIds(price);
  const byCategory = spaces.filter(
    (s) =>
      !price.category ||
      price.category === "ABONNEMENT" ||
      s.category === price.category
  );
  const pool = ids.length
    ? spaces.filter((s) => ids.includes(s.id))
    : byCategory.length
      ? byCategory
      : spaces;
  return pool.filter((s) => {
    const seat = price.occupySeat !== false && spaceAllowsSeat(s);
    const whole = !!price.occupyWhole && spaceAllowsWhole(s);
    return seat || whole;
  });
}

export function priceAllowsSeatIn(price: Price, space: Space) {
  return price.occupySeat !== false && spaceAllowsSeat(space);
}

export function priceAllowsWholeIn(price: Price, space: Space) {
  return !!price.occupyWhole && spaceAllowsWhole(space);
}

export function defaultOccupyForCategory(category?: string | null) {
  if (category === "SALLE") return { occupySeat: false, occupyWhole: true };
  if (category === "OPEN_SPACE") return { occupySeat: true, occupyWhole: true };
  return { occupySeat: true, occupyWhole: false };
}

export function defaultReserveModeForCategory(
  category?: string | null
): SpaceReserveMode {
  if (category === "SALLE") return "WHOLE";
  if (category === "OPEN_SPACE") return "BOTH";
  return "SEAT";
}
