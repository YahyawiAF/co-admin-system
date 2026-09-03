import { BillingUnit, PriceCategory, type Price } from "@/lib/types";

export const PRICE_CATEGORY_LABEL: Record<string, string> = {
  JOURNEE: "Bureau / journée",
  SALLE: "Salle de réunion",
  OPEN_SPACE: "Open space",
  ABONNEMENT: "Abonnement",
};

export const BILLING_UNIT_LABEL: Record<string, string> = {
  PACK: "Forfait",
  HOURLY: "À l'heure",
  PERIOD: "Période",
};

export const JOURNAL_TARIF_CATEGORIES = [
  "JOURNEE",
  "SALLE",
  "OPEN_SPACE",
] as const;

export function isHourlyVisitTarif(p: Price) {
  return (
    p.billingUnit === BillingUnit.HOURLY &&
    p.category !== PriceCategory.ABONNEMENT
  );
}

export function formatTarifPrice(p: Price) {
  if (isHourlyVisitTarif(p)) return `${p.price} DT / h`;
  return `${p.price} DT`;
}

export function tarifSubtitle(p: Price) {
  if (isHourlyVisitTarif(p)) {
    return p.durationHours
      ? `Limite ${p.durationHours}h`
      : "Compteur (sans limite)";
  }
  if (p.billingUnit === BillingUnit.HOURLY) {
    return `${p.durationHours || 0}h de quota`;
  }
  if (p.durationHours) return `${p.durationHours}h`;
  if (p.periodDays) return `${p.periodDays} j`;
  return "";
}

export function inferSpaceCategory(name: string): PriceCategory {
  if (/salle|r[ée]union|meeting/i.test(name || "")) return PriceCategory.SALLE;
  if (/open|ouvert/i.test(name || "")) return PriceCategory.OPEN_SPACE;
  return PriceCategory.JOURNEE;
}

export function spaceCategoriesOf(space: {
  name?: string | null;
  category?: string | null;
  categories?: (string | null)[] | null;
}): PriceCategory[] {
  const raw = (space.categories || []).filter(
    (c): c is PriceCategory =>
      c === PriceCategory.SALLE ||
      c === PriceCategory.OPEN_SPACE ||
      c === PriceCategory.JOURNEE
  );
  if (raw.length) return [...new Set(raw)];
  return [spaceCategoryOf(space)];
}

export function spaceHasCategory(
  space: {
    name?: string | null;
    category?: string | null;
    categories?: (string | null)[] | null;
  },
  category: string
) {
  return spaceCategoriesOf(space).includes(category as PriceCategory);
}

export function spaceCategoryOf(space: {
  name?: string | null;
  category?: string | null;
  categories?: (string | null)[] | null;
}): PriceCategory {
  const fromList = (space.categories || []).find(
    (c) =>
      c === PriceCategory.SALLE ||
      c === PriceCategory.OPEN_SPACE ||
      c === PriceCategory.JOURNEE
  );
  if (fromList) return fromList as PriceCategory;
  if (
    space.category === PriceCategory.SALLE ||
    space.category === PriceCategory.OPEN_SPACE ||
    space.category === PriceCategory.JOURNEE
  ) {
    return space.category as PriceCategory;
  }
  return inferSpaceCategory(space.name || "");
}

export function priceCategoriesOf(price: {
  category?: string | null;
  categories?: (string | null)[] | null;
}): PriceCategory[] {
  const raw = (price.categories || []).filter(
    (c): c is PriceCategory =>
      c === PriceCategory.SALLE ||
      c === PriceCategory.OPEN_SPACE ||
      c === PriceCategory.JOURNEE ||
      c === PriceCategory.ABONNEMENT
  );
  if (raw.length) return [...new Set(raw)];
  if (
    price.category === PriceCategory.SALLE ||
    price.category === PriceCategory.OPEN_SPACE ||
    price.category === PriceCategory.JOURNEE ||
    price.category === PriceCategory.ABONNEMENT
  ) {
    return [price.category];
  }
  return [];
}

export function priceMatchesSpace(
  price: {
    category?: string | null;
    categories?: (string | null)[] | null;
  },
  space: {
    name?: string | null;
    category?: string | null;
    categories?: (string | null)[] | null;
  }
) {
  const pc = priceCategoriesOf(price);
  if (!pc.length || pc.includes(PriceCategory.ABONNEMENT)) return true;
  const sc = spaceCategoriesOf(space);
  return pc.some((c) => sc.includes(c));
}

export function categoriesPresentInSpaces(
  spaces: {
    name?: string | null;
    category?: string | null;
    categories?: (string | null)[] | null;
  }[]
): Set<string> {
  const set = new Set<string>();
  for (const s of spaces) {
    for (const c of spaceCategoriesOf(s)) set.add(c);
  }
  return set;
}
