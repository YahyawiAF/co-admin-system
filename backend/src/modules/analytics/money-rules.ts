import { addDays, startOfDay } from 'date-fns';
import { localDayKey } from '../../../common/parse-local-day';
import { visitEnd, type TrafficVisit } from './traffic';

/**
 * One rule for the whole app (Finance, Conseil IA, Argent): the money of a visit is every
 * paid journal, room reservations included. People on site (visits, stays, occupancy)
 * never count reservations.
 */
export const paidJournalsIn = (from: Date, to: Date) => ({
  registredTime: { gte: from, lte: to },
  isPayed: true,
});

export const visitsIn = (from: Date, to: Date) => ({
  registredTime: { gte: from, lte: to },
  isReservation: false,
});

export type OpeningHours = { alwaysOpen: boolean; openHour: number; closeHour: number };

const HOUR_MS = 3_600_000;

/** Hours open on a day: configured window, widened when visits happened outside it. */
export function openHoursForDay(s: OpeningHours, observed?: { first: number; last: number }) {
  if (s.alwaysOpen) return 24;
  let from = s.openHour;
  let to = s.closeHour;
  if (observed) {
    from = Math.min(from, observed.first);
    to = Math.max(to, observed.last);
  }
  return Math.min(24, Math.max(0, to - from));
}

/**
 * Occupancy = seat-hours used ÷ (seats × hours open), over the days of a window.
 * The same formula on Finance and in Conseil IA.
 */
export function occupancy(
  visits: TrafficVisit[],
  seats: number,
  s: OpeningHours,
  start: Date,
  end: Date,
  now = new Date(),
  skip?: (d: Date) => boolean,
) {
  const observed = new Map<string, { first: number; last: number }>();
  let seatHoursUsed = 0;
  for (const v of visits) {
    if (skip?.(v.registredTime)) continue;
    const dayStart = startOfDay(v.registredTime).getTime();
    const vEnd = Math.min(visitEnd(v, now).getTime(), end.getTime(), now.getTime());
    const hours = Math.max(0, Math.min(24, (vEnd - v.registredTime.getTime()) / HOUR_MS));
    seatHoursUsed += hours;
    const k = localDayKey(v.registredTime);
    const first = Math.floor((v.registredTime.getTime() - dayStart) / HOUR_MS);
    const last = Math.ceil((vEnd - dayStart) / HOUR_MS);
    const o = observed.get(k);
    if (!o) observed.set(k, { first, last });
    else {
      o.first = Math.min(o.first, first);
      o.last = Math.max(o.last, last);
    }
  }
  const lastDay = end < now ? end : now;
  let openHours = 0;
  for (let d = startOfDay(start); d <= lastDay; d = addDays(d, 1)) {
    if (skip?.(d)) continue;
    const k = localDayKey(d);
    let h = openHoursForDay(s, observed.get(k));
    if (k === localDayKey(now)) {
      const sinceOpen = (now.getTime() - d.getTime()) / HOUR_MS - (s.alwaysOpen ? 0 : s.openHour);
      h = Math.max(0, Math.min(h, sinceOpen));
    }
    openHours += h;
  }
  const capacityHours = seats * openHours;
  return {
    seatHoursUsed,
    capacityHours,
    occupancyPct: capacityHours > 0 ? Math.min(100, Math.round((seatHoursUsed / capacityHours) * 1000) / 10) : null,
  };
}
