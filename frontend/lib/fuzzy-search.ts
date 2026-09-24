import Fuse, { type IFuseOptions } from "fuse.js";

/** Strip accents / case so "Béatrice" ≈ "beatrice", "Mohamed" ≈ "mohammed" typos still fuzzy-match. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9#+\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Fuse defaults tuned for person names (typos, first↔last, partial). */
export const NAME_FUSE_OPTIONS: IFuseOptions<unknown> = {
  threshold: 0.48,
  distance: 120,
  ignoreLocation: true,
  includeScore: true,
  shouldSort: true,
  minMatchCharLength: 1,
  findAllMatches: true,
};

type NameParts = {
  firstName?: string | null;
  lastName?: string | null;
  guestName?: string | null;
  phone?: string | null;
  visitorNumber?: number | string | null;
  extra?: (string | null | undefined)[];
};

/** Single blob: first + last + guest so order does not matter. */
export function personSearchBlob(p: NameParts): string {
  return normalizeSearchText(
    [
      p.firstName,
      p.lastName,
      p.guestName,
      p.phone,
      p.visitorNumber != null && p.visitorNumber !== ""
        ? String(p.visitorNumber)
        : "",
      ...(p.extra || []),
    ]
      .filter(Boolean)
      .join(" ")
  );
}

/**
 * Rank items by closest name match (first or last, typos OK).
 * Returns original items sorted by Fuse score (closest first).
 */
export function fuzzySearchByName<T>(
  items: T[],
  query: string,
  getParts: (item: T) => NameParts
): T[] {
  const q = normalizeSearchText(query);
  if (q.length < 1) return items;

  const enriched = items.map((item) => {
    const parts = getParts(item);
    return {
      item,
      blob: personSearchBlob(parts),
      first: normalizeSearchText(parts.firstName || ""),
      last: normalizeSearchText(parts.lastName || ""),
      guest: normalizeSearchText(parts.guestName || ""),
    };
  });

  const fuse = new Fuse(enriched, {
    ...NAME_FUSE_OPTIONS,
    keys: [
      { name: "blob", weight: 0.45 },
      { name: "first", weight: 0.25 },
      { name: "last", weight: 0.25 },
      { name: "guest", weight: 0.15 },
    ],
  });

  return fuse.search(q).map((r) => r.item.item);
}
