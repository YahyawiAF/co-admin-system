import {
  PriceCategory,
  PromoValueKind,
  type AppInstallGlobalPromo,
  type AppInstallPromo,
} from "@/lib/types";
import { priceCategoriesOf } from "@/lib/tarif-labels";

export type PromoOfferLike = Pick<
  AppInstallPromo,
  "priceId" | "valueKind" | "value"
> & { isActive?: boolean };

export function applyPromoValue(
  original: number,
  valueKind: PromoValueKind,
  value: number
): number {
  if (!Number.isFinite(original) || original < 0) return original;
  if (!Number.isFinite(value) || value <= 0) return original;
  let next =
    valueKind === PromoValueKind.PERCENT
      ? original * (1 - value / 100)
      : original - value;
  if (next < 0) next = 0;
  return Math.round(next * 100) / 100;
}

export const PROMO_SCOPE_ORDER: PriceCategory[] = [
  PriceCategory.JOURNEE,
  PriceCategory.OPEN_SPACE,
  PriceCategory.SALLE,
  PriceCategory.ABONNEMENT,
];

export const PROMO_SCOPE_LABEL: Record<PriceCategory, string> = {
  [PriceCategory.JOURNEE]: "Journée (journal)",
  [PriceCategory.OPEN_SPACE]: "Open space",
  [PriceCategory.SALLE]: "Salle de réunion",
  [PriceCategory.ABONNEMENT]: "Abonnement",
};

type PromoOpts = {
  promos?: PromoOfferLike[] | null;
  globalPromo?: AppInstallGlobalPromo | null;
  /** Tarif categories (see promoCategoriesOf) — needed when the global promo is scoped */
  categories?: PriceCategory[] | null;
};

/** Categories used for promo scopes: uncategorised tarifs fall back on their type. */
export function promoCategoriesOf(
  price:
    | {
        category?: string | null;
        categories?: (string | null)[] | null;
        type?: string | null;
      }
    | null
    | undefined
): PriceCategory[] {
  if (!price) return [];
  const cats = priceCategoriesOf(price);
  if (cats.length) return cats;
  return [
    price.type === "abonnement" ? PriceCategory.ABONNEMENT : PriceCategory.JOURNEE,
  ];
}

/** Resolve best promo for a tarif: price-linked first, else global (if in scope). */
export function resolvePromoForPrice(
  priceId: string | null | undefined,
  opts: PromoOpts
): { valueKind: PromoValueKind; value: number } | null {
  const linked = (opts.promos ?? []).find(
    (p) =>
      p.priceId === priceId &&
      p.isActive !== false &&
      Number.isFinite(p.value) &&
      p.value > 0
  );
  if (linked) {
    return { valueKind: linked.valueKind, value: linked.value };
  }
  const g = opts.globalPromo;
  if (g && Number.isFinite(g.value) && g.value > 0) {
    const scopes = g.scopes ?? [];
    const inScope =
      !scopes.length ||
      (opts.categories ?? []).some((c) => scopes.includes(c));
    if (inScope) return { valueKind: g.valueKind, value: g.value };
  }
  return null;
}

export function pricedWithPromo(
  original: number,
  priceId: string | null | undefined,
  opts: PromoOpts
): { original: number; final: number; hasPromo: boolean } {
  const promo = resolvePromoForPrice(priceId, opts);
  if (!promo) {
    return { original, final: original, hasPromo: false };
  }
  const final = applyPromoValue(original, promo.valueKind, promo.value);
  return {
    original,
    final,
    hasPromo: final < original - 0.001,
  };
}

export function formatDt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}
