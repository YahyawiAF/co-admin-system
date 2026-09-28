import type { Journal, SessionPricingPayload } from "@/lib/types";
import {
  computeSessionPricing,
  liveRowPricing,
  type PricingTier,
  type SessionPricingResult,
} from "@/lib/session-pricing";

export function isJournalPack(p: {
  category?: string | null;
  type?: string;
  billingUnit?: string | null;
}) {
  if (p.category === "ABONNEMENT" || p.type === "abonnement") return false;
  if (p.category === "SALLE" || p.category === "OPEN_SPACE") return true;
  return p.category === "JOURNEE" || p.type === "journal";
}

/** Day forfaits on mobile (same as journal check-in tarifs). */
export function isMobileDayForfait(p: {
  category?: string | null;
  type?: string;
  billingUnit?: string | null;
}) {
  return isJournalPack(p);
}

export function memberOf(row: Journal) {
  return row.members || row.member || null;
}

/** Display label for journal row (member or anonymous guest). */
export function visitorLabel(row: Journal) {
  if (row.isAnonymous || !row.memberID) {
    return row.guestName?.trim() || "Visiteur anonyme";
  }
  const m = memberOf(row);
  const name =
    [m?.firstName, m?.lastName].filter(Boolean).join(" ").trim() || "Visiteur";
  return m?.visitorNumber ? `${name} #${m.visitorNumber}` : name;
}

/** Full person name for search lists / pickers. */
export function memberDisplayName(m?: {
  firstName?: string | null;
  lastName?: string | null;
  visitorNumber?: number | null;
} | null) {
  if (!m) return "Visiteur";
  const name =
    [m.firstName, m.lastName].filter(Boolean).join(" ").trim() || "Visiteur";
  return m.visitorNumber != null ? `${name} #${m.visitorNumber}` : name;
}

export function groupOf(row: Journal) {
  return memberOf(row)?.group || null;
}

export function isAnonymousVisit(row: Journal) {
  return !!row.isAnonymous || (!row.memberID && !memberOf(row));
}

export function priceOf(row: Journal) {
  return row.prices || row.price || null;
}

/** Visit paid via subscription pack, or member currently on an active abo. */
export function isAbonnementVisit(
  row: Journal,
  subMemberIds?: Set<string> | Map<string, unknown>,
) {
  const p = priceOf(row);
  if (p?.category === "ABONNEMENT" || p?.type === "abonnement") return true;
  const mid = row.memberID || memberOf(row)?.id;
  if (!mid || !subMemberIds) return false;
  return subMemberIds instanceof Map
    ? subMemberIds.has(mid)
    : subMemberIds.has(mid);
}

export function isPendingReservation(row: Journal) {
  return row.isReservation;
}

export function isActiveVisit(row: Journal) {
  return !row.isReservation && !row.leaveTime;
}

/** One list row per person; reservations stay unique. */
export type JournalListRow = Journal & {
  visitCount: number;
  checkoutCount: number;
  /** All same-day visits for this person (for per-passage pay/delete). */
  passages: Journal[];
};

export function journalPersonKey(row: Journal): string {
  if (row.isReservation) return `res:${row.id}`;
  if (row.memberID) return `m:${row.memberID}`;
  const name = row.guestName?.trim().toLowerCase();
  if (name) return `g:${name}`;
  return `visit:${row.id}`;
}

export function groupJournalByPerson(rows: Journal[]): JournalListRow[] {
  const buckets = new Map<string, Journal[]>();
  const order: string[] = [];
  for (const row of rows) {
    const key = journalPersonKey(row);
    if (!buckets.has(key)) {
      order.push(key);
      buckets.set(key, []);
    }
    buckets.get(key)!.push(row);
  }
  return order.map((key) => {
    const items = buckets.get(key)!;
    const visits = items.filter((r) => !r.isReservation);
    const present = visits.find(isActiveVisit);
    const latest = [...items].sort(
      (a, b) =>
        new Date(b.registredTime).getTime() -
        new Date(a.registredTime).getTime()
    )[0];
    const primary = present || latest;
    const passages = (visits.length ? visits : items).sort(
      (a, b) =>
        new Date(a.registredTime).getTime() -
        new Date(b.registredTime).getTime()
    );
    return {
      ...primary,
      visitCount: visits.length || items.length,
      checkoutCount: visits.filter((r) => !!r.leaveTime).length,
      passages,
    };
  });
}

export function visitStatus(row: Journal): "reservation" | "present" | "left" {
  if (row.isReservation) return "reservation";
  if (!row.leaveTime) return "present";
  return "left";
}

let pricingLadder: PricingTier[] | null = null;

/** Tier ladder used to tick pack / auto prices live (set by pages that load pricing-context). */
export function setJournalPricingLadder(ladder: PricingTier[] | null | undefined) {
  pricingLadder = ladder ?? null;
}

/** Live tier / overtime pricing for pack & auto visits (null for hourly / subscription). */
export function rowPricing(row: Journal, now = Date.now()): SessionPricingPayload | null {
  if (!row.pricing || row.isReservation) return null;
  return liveRowPricing(row, pricingLadder, now);
}

/** Pricing evaluated at an arbitrary instant (timeline / previews), even for closed visits. */
export function rowPricingAt(row: Journal, at: number): SessionPricingResult | null {
  const p = row.pricing;
  if (!p || !pricingLadder?.length) return null;
  const mode = row.pricingMode ?? p.mode;
  return computeSessionPricing({
    mode,
    registredTime: row.registredTime,
    at,
    ladder: pricingLadder,
    rules: p.rules,
    discountPercent: p.discountPercent,
    fixed:
      mode === "FIXED" && p.fixedDurationHours
        ? {
            priceId: p.fixedPriceId,
            name: p.fixedServiceName,
            durationHours: p.fixedDurationHours,
            amount: p.fixedAmount ?? p.baseAmount,
            category: priceOf(row)?.category ?? null,
          }
        : null,
  });
}

/** Expected end: FIXED pack end, AUTO current tier end, or pack durationHours; null if unknown / open hourly meter. */
export function expectedEndMs(row: Journal, now = Date.now()): number | null {
  const pricing = rowPricing(row, now);
  if (pricing) {
    return pricing.mode === "FIXED" && pricing.fixedEndsAt != null
      ? pricing.fixedEndsAt
      : pricing.tierEndsAt;
  }
  const price = priceOf(row);
  if (!price || row.isReservation) return null;
  if (price.billingUnit === "HOURLY") {
    if (price.category === "ABONNEMENT" || !price.durationHours) return null;
    return (
      new Date(row.registredTime).getTime() + price.durationHours * 3600_000
    );
  }
  if (!price.durationHours) return null;
  return (
    new Date(row.registredTime).getTime() + price.durationHours * 3600_000
  );
}

export function billableHours(fromMs: number, toMs: number): number {
  const h = (toMs - fromMs) / 3_600_000;
  return Math.max(0.25, Math.round(h * 4) / 4);
}

/** Live amount: tier / overtime pricing for packs & auto, tarif × hours for hourly. */
export function visitAmountDue(row: Journal, now = Date.now()): number {
  const pricing = rowPricing(row, now);
  if (pricing) return isActiveVisit(row) ? pricing.amountDue : row.payedAmount || 0;
  const price = priceOf(row);
  if (
    isActiveVisit(row) &&
    price?.billingUnit === "HOURLY" &&
    price.category !== "ABONNEMENT"
  ) {
    const hours = billableHours(new Date(row.registredTime).getTime(), now);
    return Math.max(row.payedAmount || 0, hours * (price.price || 0));
  }
  return row.payedAmount || 0;
}

export function isOverstay(row: Journal, now = Date.now()): boolean {
  if (!isActiveVisit(row)) return false;
  const end = expectedEndMs(row, now);
  if (end == null) return false;
  return now > end;
}

/** Collected amount (0 when unpaid). */
export function visitPaidAmount(row: Journal): number {
  if (row.paidAmount && row.paidAmount > 0) return row.paidAmount;
  return row.isPayed ? row.payedAmount || 0 : 0;
}

/** Still owed on this visit (e.g. paid the pack, then stayed longer). */
export function visitBalanceDue(row: Journal, now = Date.now()): number {
  const due = visitAmountDue(row, now);
  const paid = visitPaidAmount(row);
  if (!row.isPayed && paid <= 0) return due;
  return Math.max(0, Math.round((due - paid) * 1000) / 1000);
}

/** Paid at least the original pack but still present past its end — likely forgot to check out. */
export function isLikelyForgotCheckout(row: Journal, now = Date.now()): boolean {
  if (!isActiveVisit(row)) return false;
  const pricing = rowPricing(row, now);
  if (!pricing || !pricing.overtime) return false;
  const paid = visitPaidAmount(row);
  return paid > 0 && paid + 0.001 >= (pricing.fixedAmount ?? pricing.baseAmount);
}

/** Overtime (or balance) still unpaid on a pack / auto visit. */
export function hasUnpaidOvertime(row: Journal, now = Date.now()): boolean {
  if (row.isReservation) return false;
  const pricing = rowPricing(row, now);
  if (!pricing) return false;
  return pricing.overtime && visitBalanceDue(row, now) > 0.001;
}

/** Present visits whose pack ends within `withinMs` (default 30 min), not yet overstay. */
export function isLeavingSoon(
  row: Journal,
  now = Date.now(),
  withinMs = 30 * 60_000
): boolean {
  if (!isActiveVisit(row)) return false;
  const end = expectedEndMs(row, now);
  if (end == null) return false;
  const remaining = end - now;
  return remaining >= 0 && remaining <= withinMs;
}

export function remainingMs(row: Journal, now = Date.now()): number | null {
  const end = expectedEndMs(row, now);
  if (end == null) return null;
  return end - now;
}

/** Format duration as "2 h 15 min" (or "45 min" / "3 h"). */
export function formatDurationHm(ms: number, opts?: { signed?: boolean }) {
  const neg = ms < 0;
  const abs = Math.abs(ms);
  const totalMin = Math.floor(abs / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  let core: string;
  if (h <= 0) core = `${m} min`;
  else if (m <= 0) core = `${h} h`;
  else core = `${h} h ${String(m).padStart(2, "0")} min`;
  if (opts?.signed && neg) return `+${core}`;
  return core;
}
