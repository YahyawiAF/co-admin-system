import { applyPromoValue, formatDt } from "@/lib/promo-price";
import { PromoValueKind, type Promotion } from "@/lib/types";

/** Live tarif promos of one tarif: discounts on the pass, gifts offered with it. */
export type TarifPromos = { deals: Promotion[]; bundles: Promotion[] };

const NONE: TarifPromos = { deals: [], bundles: [] };

/** Does this PRICE / BUNDLE promo cover the tarif (linked to it or to its category)? */
export function promoCoversPrice(p: Promotion, priceId: string) {
  return p.priceIds?.length ? p.priceIds.includes(priceId) : p.priceId === priceId;
}

/** priceId → its live promos. `liveOnly` false keeps scheduled ones (admin preview). */
export function indexTarifPromos(promos: Promotion[], liveOnly = true) {
  const map = new Map<string, TarifPromos>();
  for (const p of promos) {
    if (!p.isActive || (liveOnly && !p.liveNow)) continue;
    if (p.target !== "PRICE" && !(p.target === "BUNDLE" && p.productId)) continue;
    const ids = p.priceIds?.length ? p.priceIds : p.priceId ? [p.priceId] : [];
    for (const id of ids) {
      const cur = map.get(id) ?? { deals: [], bundles: [] };
      if (p.target === "PRICE") cur.deals.push(p);
      else cur.bundles.push(p);
      map.set(id, cur);
    }
  }
  return (priceId: string | null | undefined): TarifPromos =>
    (priceId && map.get(priceId)) || NONE;
}

/** Best discount on the pass for this amount (null when none lowers it). */
export function bestDeal(deals: Promotion[], amount: number) {
  let pick: { promo: Promotion; final: number } | null = null;
  for (const p of deals) {
    const final = applyPromoValue(amount, p.valueKind as PromoValueKind, p.value);
    if (final < amount - 0.0005 && (!pick || final < pick.final)) pick = { promo: p, final };
  }
  return pick;
}

function endsToday(p: Promotion) {
  if (!p.endsAt) return false;
  const end = new Date(p.endsAt);
  const now = new Date();
  return end.toDateString() === now.toDateString();
}

/** Corner tag of a discounted pass: "−20 % aujourd’hui". */
export function dealTag(p: Promotion) {
  return endsToday(p) ? `${p.label} aujourd’hui` : p.label;
}

/** Corner tag of a gift: "Café −50 %" (falls back on "Cadeau" when too long). */
export function giftTag(p: Promotion) {
  const t = `${p.itemName ?? ""} ${p.label}`.trim();
  return p.itemName && t.length <= 16 ? t : "Cadeau";
}

/** "1 DT au lieu de 2" */
export function giftPriceLine(p: Promotion) {
  if (p.priceBefore == null || p.priceAfter == null) return p.label;
  return p.priceAfter <= 0
    ? "Offert"
    : `${formatDt(p.priceAfter)} DT au lieu de ${formatDt(p.priceBefore)}`;
}

/** Ids to send with the pass: undefined when the pass has no gift (nothing was offered). */
export function acceptedBundleIds(
  bundles: Promotion[],
  answers: Record<string, boolean | undefined>
) {
  if (!bundles.length) return undefined;
  return bundles.filter((b) => answers[b.id] === true).map((b) => b.id);
}
