import {
  PromoValueKind,
  type AppInstallGlobalPromo,
  type AppInstallPromo,
} from "@/lib/types";

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

/** Resolve best promo for a tarif: price-linked first, else global. */
export function resolvePromoForPrice(
  priceId: string | null | undefined,
  opts: {
    promos?: PromoOfferLike[] | null;
    globalPromo?: AppInstallGlobalPromo | null;
  }
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
    return { valueKind: g.valueKind, value: g.value };
  }
  return null;
}

export function pricedWithPromo(
  original: number,
  priceId: string | null | undefined,
  opts: {
    promos?: PromoOfferLike[] | null;
    globalPromo?: AppInstallGlobalPromo | null;
  }
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
