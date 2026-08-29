import { addDays, differenceInCalendarDays } from "date-fns";
import type { Abonnement } from "@/lib/types";

/** End date for a period pack: N calendar days including start day. */
export function leaveDateFromPeriodStart(start: Date, periodDays: number) {
  const days = Math.max(1, periodDays);
  return addDays(start, days - 1);
}

export function daysLeft(a: Abonnement) {
  if (!a.leaveDate) return null;
  return differenceInCalendarDays(new Date(a.leaveDate), new Date());
}

export function isActiveSub(a: Abonnement) {
  if (a.price?.billingUnit === "HOURLY") {
    const quota = a.hoursQuota || a.price.durationHours || 0;
    if ((a.hoursUsed || 0) >= quota) return false;
  }
  if (!a.leaveDate) return true;
  return new Date(a.leaveDate) >= new Date(new Date().toDateString());
}

export function hoursLeft(a: Abonnement) {
  if (a.price?.billingUnit !== "HOURLY") return null;
  return Math.max(
    0,
    (a.hoursQuota || a.price.durationHours || 0) - (a.hoursUsed || 0),
  );
}

export function subKind(a: Abonnement) {
  const p = a.price;
  if (!p) return "other";
  if (p.billingUnit === "HOURLY") return "hours_pool";
  if ((p.durationHours || 0) <= 6) return "semi_day";
  if ((p.durationHours || 0) >= 12) return "full_day";
  return "other";
}

export function splitMemberSubscriptions(abos: Abonnement[], memberId: string) {
  const all = abos
    .filter((a) => a.memberID === memberId)
    .sort(
      (a, b) =>
        new Date(b.registredDate).getTime() -
        new Date(a.registredDate).getTime(),
    );
  const current = all.find(isActiveSub) || null;
  const history = all.filter((a) => a.id !== current?.id);
  return { current, history, all };
}

export function activeSubByMember(abos: Abonnement[]) {
  const map = new Map<string, Abonnement>();
  for (const a of abos) {
    if (!a.memberID || !isActiveSub(a)) continue;
    if (!map.has(a.memberID)) map.set(a.memberID, a);
  }
  return map;
}

export function subscriptionForSeat(
  abos: Abonnement[],
  seatLabel: string,
  spaceId?: string | null,
) {
  const active = abos.filter(
    (a) => isActiveSub(a) && a.reservedSeatLabel === seatLabel,
  );
  if (!active.length) return null;
  if (spaceId) {
    const exact = active.find((a) => a.reservedSeatSpaceId === spaceId);
    if (exact) return exact;
  }
  return active[0];
}

export function subscriptionExpiryLabel(days: number | null) {
  if (days == null) return null;
  if (days < 0) return "Expiré";
  if (days === 0) return "Expire aujourd'hui";
  if (days === 1) return "Expire demain";
  return `Expire dans ${days} j.`;
}
