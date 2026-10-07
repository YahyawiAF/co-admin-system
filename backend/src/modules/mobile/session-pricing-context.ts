import { PrismaService } from 'database/prisma.service';
import { BillingUnit, PriceCategory } from '@prisma/client';
import {
  computeSessionPricing,
  PricingRules,
  PricingTier,
  resolveRules,
  SessionPricingResult,
} from './session-pricing';

export interface PricingContext {
  ladder: PricingTier[];
  rules: PricingRules;
}

const CACHE_MS = 30_000;
const cache = new Map<string, { at: number; ctx: PricingContext }>();

export function invalidatePricingContext() {
  cache.clear();
}

/** Day pack tiers + facility overtime rules for an organization (cached briefly). */
export async function loadPricingContext(
  prisma: PrismaService,
  organizationId?: string | null,
): Promise<PricingContext> {
  const key = organizationId || '_';
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.ctx;

  const [facility, prices] = await Promise.all([
    prisma.facility.findFirst({
      where: organizationId ? { organizationId } : undefined,
      orderBy: { createdAt: 'asc' },
      select: {
        sessionWarnBeforeMin: true,
        autoTierGraceMin: true,
        fixedGraceMin: true,
        overtimeSurchargeDt: true,
        overtimeNextTierMin: true,
      },
    }),
    prisma.price.findMany({
      where: {
        isActive: true,
        billingUnit: BillingUnit.PACK,
        durationHours: { gt: 0 },
        type: 'journal',
        NOT: { category: PriceCategory.ABONNEMENT },
        ...(organizationId
          ? { OR: [{ organizationId }, { organizationId: null }] }
          : {}),
      },
      select: {
        id: true,
        name: true,
        price: true,
        durationHours: true,
        category: true,
        categories: true,
      },
    }),
  ]);

  const ctx: PricingContext = {
    rules: resolveRules(facility),
    ladder: prices.map((p) => ({
      priceId: p.id,
      name: p.name,
      price: p.price,
      durationHours: p.durationHours || 0,
      category: p.category || p.categories?.[0] || PriceCategory.JOURNEE,
    })),
  };
  cache.set(key, { at: Date.now(), ctx });
  return ctx;
}

type DiscountFields = {
  discountForfait?: number | null;
  discountAbonnement?: number | null;
  discountSalle?: number | null;
  discountOpenSpace?: number | null;
};

/** A price (or just its category) as far as discounts are concerned. */
export type DiscountPrice =
  | string
  | null
  | undefined
  | {
      category?: string | null;
      categories?: string[] | null;
      billingUnit?: string | null;
    };

function discountField(category: string | null | undefined) {
  switch (category) {
    case PriceCategory.SALLE:
      return 'discountSalle' as const;
    case PriceCategory.OPEN_SPACE:
      return 'discountOpenSpace' as const;
    case PriceCategory.ABONNEMENT:
      return 'discountAbonnement' as const;
    default:
      return 'discountForfait' as const;
  }
}

/**
 * Discount fields to look at for a price, most specific first. A price can belong
 * to several categories (e.g. a 4h pack tagged OPEN_SPACE + JOURNEE). Packs tagged
 * JOURNEE use the "Forfait / journée" discount first; other non-salle packs fall
 * back to it.
 */
function discountFieldsFor(price: DiscountPrice) {
  if (typeof price === 'string') return [discountField(price)];
  if (!price) return [discountField(null)];
  const cats = [price.category, ...(price.categories ?? [])].filter(
    (c): c is string => !!c,
  );
  const isPack = price.billingUnit === BillingUnit.PACK;
  if (isPack && cats.includes(PriceCategory.JOURNEE)) {
    cats.unshift(PriceCategory.JOURNEE);
  }
  if (
    !cats.length ||
    (isPack &&
      !cats.includes(PriceCategory.SALLE) &&
      !cats.includes(PriceCategory.ABONNEMENT))
  ) {
    cats.push(PriceCategory.JOURNEE);
  }
  return [...new Set(cats.map(discountField))];
}

/**
 * Member discount for a price: the member's own % (first one set among the price's
 * categories) wins, otherwise the group's (first non-zero).
 */
export function memberDiscountPercent(
  member: (DiscountFields & { group?: DiscountFields | null }) | null | undefined,
  price?: DiscountPrice,
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

export type PricedJournalRow = {
  registredTime: Date | string;
  leaveTime?: Date | string | null;
  isReservation?: boolean | null;
  isPayed?: boolean | null;
  payedAmount?: number | null;
  priceId?: string | null;
  serviceName?: string | null;
  pricingMode?: 'FIXED' | 'AUTO' | null;
  fixedPriceId?: string | null;
  fixedServiceName?: string | null;
  fixedDurationHours?: number | null;
  fixedAmount?: number | null;
  fixedAt?: Date | string | null;
  paidAmount?: number | null;
  prices?: {
    id?: string;
    name?: string | null;
    price?: number | null;
    durationHours?: number | null;
    billingUnit?: string | null;
    category?: string | null;
    categories?: string[] | null;
    type?: string | null;
  } | null;
  members?: (DiscountFields & { group?: DiscountFields | null }) | null;
};

/** True for pack / auto visits (not subscriptions, hourly meters or reservations). */
export function isTierPricedRow(row: PricedJournalRow): boolean {
  if (row.isReservation) return false;
  const p = row.prices;
  if (row.pricingMode === 'AUTO') return true;
  if (!p) return false;
  if (p.billingUnit === BillingUnit.HOURLY) return false;
  if (p.category === PriceCategory.ABONNEMENT || p.type === 'abonnement') {
    return false;
  }
  const hours = row.fixedDurationHours ?? p.durationHours;
  return !!hours && hours > 0;
}

export function computeRowPricing(
  row: PricedJournalRow,
  ctx: PricingContext,
  at?: Date | number,
): SessionPricingResult | null {
  if (!isTierPricedRow(row)) return null;
  const p = row.prices;
  const leave = row.leaveTime ? new Date(row.leaveTime).getTime() : null;
  const when = at ?? leave ?? Date.now();
  if (row.pricingMode === 'AUTO') {
    return computeSessionPricing({
      mode: 'AUTO',
      registredTime: row.registredTime,
      at: when,
      ladder: ctx.ladder,
      rules: ctx.rules,
      discountPercent: memberDiscountPercent(row.members, PriceCategory.JOURNEE),
    });
  }
  const durationHours = (row.fixedDurationHours ?? p?.durationHours) || 0;
  return computeSessionPricing({
    mode: 'FIXED',
    registredTime: row.registredTime,
    at: when,
    ladder: ctx.ladder,
    rules: ctx.rules,
    discountPercent: memberDiscountPercent(row.members, p),
    fixed: {
      priceId: row.fixedPriceId ?? row.priceId ?? null,
      name: row.fixedServiceName ?? row.serviceName ?? p?.name ?? null,
      durationHours,
      amount: row.fixedAmount ?? row.payedAmount ?? p?.price ?? 0,
      category: p?.category ?? null,
    },
  });
}

/** API payload attached to sessions / journal rows (`pricing`). */
export function pricingPayload(
  row: PricedJournalRow,
  ctx: PricingContext,
  at?: Date | number,
) {
  const pricing = computeRowPricing(row, ctx, at);
  if (!pricing) return null;
  const closed = !!row.leaveTime;
  const amountDue = closed ? row.payedAmount ?? pricing.amountDue : pricing.amountDue;
  const paidAmount =
    row.paidAmount && row.paidAmount > 0
      ? row.paidAmount
      : row.isPayed
        ? row.payedAmount ?? 0
        : 0;
  return {
    ...pricing,
    amountDue,
    extraAmount: closed
      ? Math.max(0, Math.round((amountDue - pricing.baseAmount) * 1000) / 1000)
      : pricing.extraAmount,
    closed,
    fixedPriceId: row.pricingMode === 'AUTO' ? null : row.fixedPriceId ?? row.priceId ?? null,
    fixedServiceName:
      row.pricingMode === 'AUTO'
        ? null
        : row.fixedServiceName ?? row.serviceName ?? row.prices?.name ?? null,
    fixedDurationHours:
      row.pricingMode === 'AUTO'
        ? null
        : row.fixedDurationHours ?? row.prices?.durationHours ?? null,
    fixedAmount:
      row.pricingMode === 'AUTO' ? null : pricing.baseAmount,
    fixedAt: row.fixedAt ?? null,
    paidAmount,
    balanceDue: Math.max(0, Math.round((amountDue - paidAmount) * 1000) / 1000),
    discountPercent: memberDiscountPercent(
      row.members,
      row.pricingMode === 'AUTO' ? PriceCategory.JOURNEE : row.prices,
    ),
    rules: ctx.rules,
  };
}

export type SessionPricingPayload = NonNullable<ReturnType<typeof pricingPayload>>;
