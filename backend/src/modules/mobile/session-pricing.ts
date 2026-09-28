/**
 * Session pricing engine (pure — mirrored in frontend/lib/session-pricing.ts).
 *
 * AUTO  : price = smallest pack tier covering the elapsed time. A tier is kept
 *         `autoTierGraceMin` after it ends, then the next tier applies.
 * FIXED : pack chosen up-front. After the pack ends: `fixedGraceMin` without
 *         extra, then +`overtimeSurchargeDt`, then after `overtimeNextTierMin`
 *         the next tier price (rules repeat from that tier).
 */

export type SessionPricingMode = 'AUTO' | 'FIXED';

export type PricingStage =
  | 'WITHIN'
  | 'WARNING'
  | 'GRACE'
  | 'SURCHARGE'
  | 'NEXT_TIER'
  | 'OVERTIME';

export interface PricingTier {
  priceId: string;
  name: string;
  durationHours: number;
  price: number;
  category?: string | null;
}

export interface PricingRules {
  sessionWarnBeforeMin: number;
  autoTierGraceMin: number;
  fixedGraceMin: number;
  overtimeSurchargeDt: number;
  overtimeNextTierMin: number;
}

export const DEFAULT_PRICING_RULES: PricingRules = {
  sessionWarnBeforeMin: 5,
  autoTierGraceMin: 15,
  fixedGraceMin: 15,
  overtimeSurchargeDt: 0.75,
  overtimeNextTierMin: 30,
};

export interface FixedTariff {
  priceId?: string | null;
  name?: string | null;
  durationHours: number;
  /** Amount after discount */
  amount: number;
  category?: string | null;
}

export interface SessionPricingInput {
  mode: SessionPricingMode;
  registredTime: Date | string | number;
  at?: Date | string | number;
  fixed?: FixedTariff | null;
  /** All day pack tiers (any category) — filtered here by category */
  ladder: PricingTier[];
  rules?: Partial<PricingRules> | null;
  discountPercent?: number;
}

export interface SessionPricingResult {
  mode: SessionPricingMode;
  stage: PricingStage;
  elapsedMs: number;
  /** Tier currently billed (AUTO tier, fixed pack, or next tier after overtime) */
  currentTier: { priceId: string | null; name: string; durationHours: number };
  /** Times the price moved to a higher tier */
  tierSteps: number;
  /** Original fixed amount (FIXED) or current tier amount (AUTO) */
  baseAmount: number;
  extraAmount: number;
  amountDue: number;
  surchargeApplied: boolean;
  /** FIXED: time past the original pack end. AUTO: time past current tier end. */
  overtimeMs: number;
  overtime: boolean;
  /** End of current tier (ms epoch) */
  tierEndsAt: number;
  /** Next price change (ms epoch) — null when price is final */
  nextChangeAt: number | null;
  nextAmount: number | null;
  nextTierName: string | null;
  /** Original fixed pack end (FIXED only) */
  fixedEndsAt: number | null;
}

const H = 3_600_000;
const M = 60_000;

function toMs(v: Date | string | number | undefined): number {
  if (v == null) return Date.now();
  if (typeof v === 'number') return v;
  return new Date(v).getTime();
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

function applyPercentOff(amount: number, percent?: number) {
  if (!percent) return round3(amount);
  return round3(amount * (1 - percent / 100));
}

export function resolveRules(rules?: Partial<PricingRules> | null): PricingRules {
  const r = { ...DEFAULT_PRICING_RULES };
  if (!rules) return r;
  for (const k of Object.keys(r) as (keyof PricingRules)[]) {
    const v = rules[k];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) r[k] = v;
  }
  return r;
}

/** Tiers for a category (default JOURNEE), sorted by duration, one per duration (cheapest). */
export function ladderFor(
  tiers: PricingTier[],
  category?: string | null,
): PricingTier[] {
  const valid = tiers.filter((t) => t.durationHours > 0 && t.price >= 0);
  const pick = (cat: string) => valid.filter((t) => t.category === cat);
  let list = category ? pick(category) : [];
  if (!list.length) list = pick('JOURNEE');
  if (!list.length) list = pick('OPEN_SPACE');
  if (!list.length) list = valid;
  const byDuration = new Map<number, PricingTier>();
  for (const t of list) {
    const prev = byDuration.get(t.durationHours);
    if (!prev || t.price < prev.price) byDuration.set(t.durationHours, t);
  }
  return [...byDuration.values()].sort(
    (a, b) => a.durationHours - b.durationHours,
  );
}

export function computeSessionPricing(
  input: SessionPricingInput,
): SessionPricingResult | null {
  const rules = resolveRules(input.rules);
  const start = toMs(input.registredTime);
  const at = toMs(input.at);
  const elapsed = Math.max(0, at - start);
  const discount = input.discountPercent || 0;
  const isFixed = input.mode === 'FIXED' && !!input.fixed;
  const ladder = ladderFor(
    input.ladder || [],
    isFixed ? input.fixed?.category : null,
  );

  let cur: { priceId: string | null; name: string; durationHours: number; amount: number };
  if (isFixed && input.fixed) {
    cur = {
      priceId: input.fixed.priceId || null,
      name: input.fixed.name || `${input.fixed.durationHours}h`,
      durationHours: input.fixed.durationHours,
      amount: round3(input.fixed.amount),
    };
  } else {
    const first = ladder[0];
    if (!first) return null;
    cur = {
      priceId: first.priceId,
      name: first.name,
      durationHours: first.durationHours,
      amount: applyPercentOff(first.price, discount),
    };
  }

  const baseFixed = isFixed ? cur.amount : null;
  const fixedEndsAt = isFixed ? start + cur.durationHours * H : null;
  const graceMs = (isFixed ? rules.fixedGraceMin : rules.autoTierGraceMin) * M;
  const switchMs = isFixed
    ? Math.max(rules.overtimeNextTierMin, rules.fixedGraceMin) * M
    : graceMs;
  const surcharge = isFixed ? rules.overtimeSurchargeDt : 0;
  const warnMs = rules.sessionWarnBeforeMin * M;

  const nextTierAfter = (hours: number) =>
    ladder.find((t) => t.durationHours > hours + 1e-6) || null;

  let steps = 0;
  for (;;) {
    const next = nextTierAfter(cur.durationHours);
    const end = start + cur.durationHours * H;
    if (!next || at < end + switchMs) break;
    cur = {
      priceId: next.priceId,
      name: next.name,
      durationHours: next.durationHours,
      amount: Math.max(applyPercentOff(next.price, discount), cur.amount),
    };
    steps += 1;
  }

  const tierEndsAt = start + cur.durationHours * H;
  const next = nextTierAfter(cur.durationHours);
  const nextTierAmount = next
    ? Math.max(applyPercentOff(next.price, discount), cur.amount)
    : null;

  let stage: PricingStage;
  let amountDue = cur.amount;
  let surchargeApplied = false;

  if (at < tierEndsAt - warnMs) {
    stage = isFixed && steps > 0 ? 'NEXT_TIER' : 'WITHIN';
  } else if (at < tierEndsAt) {
    stage = 'WARNING';
  } else if (at < tierEndsAt + graceMs) {
    stage = 'GRACE';
  } else if (surcharge > 0) {
    stage = 'SURCHARGE';
    surchargeApplied = true;
    amountDue = round3(cur.amount + surcharge);
  } else {
    stage = 'OVERTIME';
  }

  let nextChangeAt: number | null = null;
  let nextAmount: number | null = null;
  let nextTierName: string | null = null;
  const beforeSurcharge =
    stage === 'WITHIN' ||
    stage === 'NEXT_TIER' ||
    stage === 'WARNING' ||
    stage === 'GRACE';
  if (beforeSurcharge && surcharge > 0) {
    nextChangeAt = tierEndsAt + graceMs;
    nextAmount = round3(cur.amount + surcharge);
  } else if (next) {
    nextChangeAt = tierEndsAt + switchMs;
    nextAmount = nextTierAmount;
    nextTierName = next.name;
  }

  const overtimeMs = isFixed
    ? at - (fixedEndsAt as number)
    : at - tierEndsAt;
  const baseAmount = baseFixed ?? cur.amount;

  return {
    mode: isFixed ? 'FIXED' : 'AUTO',
    stage,
    elapsedMs: elapsed,
    currentTier: {
      priceId: cur.priceId,
      name: cur.name,
      durationHours: cur.durationHours,
    },
    tierSteps: steps,
    baseAmount,
    extraAmount: round3(Math.max(0, amountDue - baseAmount)),
    amountDue: round3(amountDue),
    surchargeApplied,
    overtimeMs,
    overtime: overtimeMs > 0,
    tierEndsAt,
    nextChangeAt,
    nextAmount,
    nextTierName,
    fixedEndsAt,
  };
}

/** Stable key for the pricing moment the member should be told about (null = nothing new). */
export function pricingNoticeKey(p: SessionPricingResult): string | null {
  const tier = `${p.currentTier.durationHours}`;
  switch (p.stage) {
    case 'WARNING':
      return `warn:${tier}`;
    case 'GRACE':
      return `grace:${tier}`;
    case 'SURCHARGE':
      return `surcharge:${tier}`;
    case 'NEXT_TIER':
      return `tier:${tier}`;
    case 'OVERTIME':
      return `over:${tier}`;
    default:
      return p.tierSteps > 0 ? `tier:${tier}` : null;
  }
}
