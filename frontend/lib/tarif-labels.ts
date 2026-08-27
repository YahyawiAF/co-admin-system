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

export function spaceCategoryOf(space: {
  name?: string | null;
  category?: string | null;
}): PriceCategory {
  if (
    space.category === PriceCategory.SALLE ||
    space.category === PriceCategory.OPEN_SPACE ||
    space.category === PriceCategory.JOURNEE
  ) {
    return space.category as PriceCategory;
  }
  return inferSpaceCategory(space.name || "");
}

export function categoriesPresentInSpaces(
  spaces: { name?: string | null; category?: string | null }[]
): Set<string> {
  const set = new Set<string>();
  for (const s of spaces) set.add(spaceCategoryOf(s));
  return set;
}
