import type { Journal } from "@/lib/types";

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
  const name = m?.firstName || "Visiteur";
  return m?.visitorNumber ? `${name} #${m.visitorNumber}` : name;
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

export function isPendingReservation(row: Journal) {
  return row.isReservation;
}

export function isActiveVisit(row: Journal) {
  return !row.isReservation && !row.leaveTime;
}

export function visitStatus(row: Journal): "reservation" | "present" | "left" {
  if (row.isReservation) return "reservation";
  if (!row.leaveTime) return "present";
  return "left";
}

/** Expected end time from pack durationHours, or null if unknown / open hourly meter. */
export function expectedEndMs(row: Journal): number | null {
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

/** Live amount for an open hourly visit (tarif × hours stayed). */
export function visitAmountDue(row: Journal, now = Date.now()): number {
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
  const end = expectedEndMs(row);
  if (end == null) return false;
  return now > end;
}

/** Present visits whose pack ends within `withinMs` (default 30 min), not yet overstay. */
export function isLeavingSoon(
  row: Journal,
  now = Date.now(),
  withinMs = 30 * 60_000
): boolean {
  if (!isActiveVisit(row)) return false;
  const end = expectedEndMs(row);
  if (end == null) return false;
  const remaining = end - now;
  return remaining >= 0 && remaining <= withinMs;
}

export function remainingMs(row: Journal, now = Date.now()): number | null {
  const end = expectedEndMs(row);
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
