"use client";

import { useMemo } from "react";
import { applyPromoValue } from "@/lib/promo-price";
import { PromoValueKind } from "@/lib/types";
import { useMemberPromotions } from "@/components/visitor/VisitorSpotlight";
import { useMyVouchers } from "@/components/visitor/VisitVouchers";

export type CafeDeal = { label: string; priceAfter: number };

/**
 * Live café prices for the member: productId → best offer (PRODUCT promos, one product,
 * several or the whole café) and productId → gift-with-pass voucher of the visit
 * (first unit at the voucher price; a voucher for several products shows on each).
 */
export function useCafeDeals(products: Array<{ id: string; sellingPrice: number }>) {
  const { data: promotions = [] } = useMemberPromotions();
  const { data: vouchers = [] } = useMyVouchers();

  const deals = useMemo(() => {
    const m = new Map<string, CafeDeal>();
    const priceOfId = new Map(products.map((x) => [x.id, x.sellingPrice]));
    for (const p of promotions) {
      if (!p.liveNow || p.target !== "PRODUCT") continue;
      const ids = p.productIds?.length ? p.productIds : p.productId ? [p.productId] : [];
      for (const id of ids) {
        const before = priceOfId.get(id);
        if (before == null) continue;
        const after = applyPromoValue(before, p.valueKind as PromoValueKind, p.value);
        if (after >= before - 0.0005) continue;
        const cur = m.get(id);
        if (!cur || after < cur.priceAfter) m.set(id, { label: p.label, priceAfter: after });
      }
    }
    return m;
  }, [promotions, products]);

  const voucherOf = useMemo(() => {
    const m = new Map<string, CafeDeal>();
    const priceOfId = new Map(products.map((x) => [x.id, x.sellingPrice]));
    for (const v of vouchers) {
      if (v.status !== "ACCEPTED") continue;
      const ids = v.productIds?.length ? v.productIds : v.productId ? [v.productId] : [];
      for (const id of ids) {
        if (m.has(id)) continue;
        const before = priceOfId.get(id);
        if (before == null) continue;
        const after =
          v.productId === id && v.priceAfter != null
            ? v.priceAfter
            : applyPromoValue(before, v.valueKind as PromoValueKind, v.value);
        m.set(id, { label: v.label, priceAfter: after });
      }
    }
    return m;
  }, [vouchers, products]);

  /** Price of one unit: the voucher first, then the best live offer, else the list price. */
  const priceOf = (p: { id: string; sellingPrice: number }) =>
    voucherOf.get(p.id)?.priceAfter ?? deals.get(p.id)?.priceAfter ?? p.sellingPrice;

  return { promotions, vouchers, deals, voucherOf, priceOf };
}
