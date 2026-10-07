/** Mirrors backend memberDiscountPercent (session-pricing-context.ts). */

type DiscountFields = {
  discountForfait?: number | null;
  discountAbonnement?: number | null;
  discountSalle?: number | null;
  discountOpenSpace?: number | null;
};

export type DiscountMember =
  | (DiscountFields & { group?: DiscountFields | null })
  | null
  | undefined;

export type DiscountPrice =
  | string
  | null
  | undefined
  | {
      category?: string | null;
      categories?: string[] | null;
      billingUnit?: string | null;
    };

function discountField(category: string | null | undefined): keyof DiscountFields {
  switch (category) {
    case "SALLE":
      return "discountSalle";
    case "OPEN_SPACE":
      return "discountOpenSpace";
    case "ABONNEMENT":
      return "discountAbonnement";
    default:
      return "discountForfait";
  }
}

/** Fields to look at for a price, most specific first (day packs → "Forfait / journée"). */
function discountFieldsFor(price: DiscountPrice): (keyof DiscountFields)[] {
  if (price == null || typeof price === "string") return [discountField(price)];
  const cats = [price.category, ...(price.categories ?? [])].filter(
    (c): c is string => !!c
  );
  const isPack = price.billingUnit === "PACK";
  if (isPack && cats.includes("JOURNEE")) cats.unshift("JOURNEE");
  if (
    !cats.length ||
    (isPack && !cats.includes("SALLE") && !cats.includes("ABONNEMENT"))
  ) {
    cats.push("JOURNEE");
  }
  return [...new Set(cats.map(discountField))];
}

/** Member's own % (first set among the price's categories), else the group's (first non-zero). */
export function memberDiscountPercent(
  member: DiscountMember,
  price?: DiscountPrice
): number {
  if (!member) return 0;
  const fields = discountFieldsFor(price);
  for (const f of fields) {
    const v = member[f];
    if (v != null) return v;
  }
  if (!member.group) return 0;
  for (const f of fields) {
    const v = member.group[f];
    if (v) return v;
  }
  return 0;
}
