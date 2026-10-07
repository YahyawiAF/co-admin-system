import { BillingUnit, PriceCategory } from '@prisma/client';
import { endOfDay } from 'date-fns';
import {
  computeRowPricing,
  memberDiscountPercent,
  PricedJournalRow,
  PricingContext,
} from './session-pricing-context';

/** Quarter-hour billing, minimum 15 minutes. 1.5h stay → 1.5 × hourly rate. */
export function billableHours(from: Date, to: Date): number {
  const h = (to.getTime() - from.getTime()) / 3_600_000;
  return Math.max(0.25, Math.round(h * 4) / 4);
}

export function isHourlyVisitPrice(price: {
  billingUnit?: string | null;
  category?: string | null;
  type?: string | null;
}) {
  return (
    price.billingUnit === BillingUnit.HOURLY &&
    price.category !== PriceCategory.ABONNEMENT &&
    price.type !== 'abonnement'
  );
}

function percentOff(amount: number, percent: number) {
  if (!percent) return Math.round(amount * 100) / 100;
  return Math.round(amount * (1 - percent / 100) * 100) / 100;
}

/**
 * Amount owed for a non-subscription visit billed from arrival until `at`
 * (hourly meter or pack / auto tiers, member discounts included, app promo excluded).
 * Null when the visit is not metered (no tariff, reservation…).
 */
export function visitAmountAt(
  row: PricedJournalRow,
  ctx: PricingContext,
  at: Date,
): number | null {
  if (row.isReservation) return null;
  const p = row.prices;
  if (p && isHourlyVisitPrice(p)) {
    const hours = billableHours(new Date(row.registredTime), at);
    const rate = percentOff(
      p.price || 0,
      memberDiscountPercent(row.members, p),
    );
    return Math.max(row.payedAmount || 0, hours * rate);
  }
  const pricing = computeRowPricing(row, ctx, at);
  return pricing ? pricing.amountDue : null;
}

export type LatePaymentRow = PricedJournalRow & {
  amountAtCheckout?: number | null;
  promoDiscount?: number | null;
};

/** Checked out while still owing money. */
export function isLeftUnpaid(row: LatePaymentRow) {
  return (
    !row.isReservation &&
    !!row.leaveTime &&
    !row.isPayed &&
    (row.payedAmount || 0) > 0
  );
}

/**
 * Billing instant for a late payment: now, capped at the end of the visit day
 * so paying days later never bills several days.
 */
export function latePaymentBillAt(row: LatePaymentRow, now = new Date()): Date {
  const cap = endOfDay(new Date(row.registredTime)).getTime();
  const leave = row.leaveTime ? new Date(row.leaveTime).getTime() : 0;
  return new Date(Math.max(leave, Math.min(now.getTime(), cap)));
}

/** Forfait amount chosen for the visit (fixed pack / non-hourly tariff), member discount and promo applied. */
function fixedForfaitAmount(row: LatePaymentRow): number | null {
  const p = row.prices;
  let base: number | null = null;
  if (row.pricingMode !== 'AUTO' && row.fixedAmount != null) {
    base = row.fixedAmount;
  } else if (p && !isHourlyVisitPrice(p) && row.pricingMode !== 'AUTO') {
    base = p.price ?? null;
  }
  if (base == null) return null;
  const discounted = percentOff(
    base,
    memberDiscountPercent(row.members, p),
  );
  return Math.round(Math.max(0, discounted - (row.promoDiscount || 0)) * 1000) / 1000;
}

export type LateBillingMode = 'now' | 'checkout' | 'fixed';

/** What a visitor who left unpaid owes if they pay now (null when not applicable). */
export function latePaymentInfo(
  row: LatePaymentRow,
  ctx: PricingContext,
  now = new Date(),
) {
  if (!isLeftUnpaid(row)) return null;
  const amountAtCheckout = row.amountAtCheckout ?? row.payedAmount ?? 0;
  const billAt = latePaymentBillAt(row, now);
  const raw = visitAmountAt(row, ctx, billAt);
  if (raw == null) return null;
  const afterPromo = Math.max(0, raw - (row.promoDiscount || 0));
  const amountIfPaidNow =
    Math.round(Math.max(row.payedAmount || 0, afterPromo) * 1000) / 1000;
  return {
    amountAtCheckout,
    amountIfPaidNow,
    amountFixed: fixedForfaitAmount(row),
    extra: Math.max(
      0,
      Math.round((amountIfPaidNow - amountAtCheckout) * 1000) / 1000,
    ),
    computedAt: billAt.toISOString(),
  };
}

export type LatePaymentInfo = NonNullable<ReturnType<typeof latePaymentInfo>>;

/** Amount to collect for a late payment in the chosen billing mode. */
export function lateAmountForMode(
  info: LatePaymentInfo,
  mode: LateBillingMode,
): number {
  if (mode === 'checkout') return info.amountAtCheckout;
  if (mode === 'fixed' && info.amountFixed != null) return info.amountFixed;
  return info.amountIfPaidNow;
}
