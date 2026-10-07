import { endOfDay, startOfDay } from 'date-fns';

export type TrafficVisit = {
  registredTime: Date;
  leaveTime: Date | null;
};

const HOUR_MS = 3_600_000;

/** End of a visit for occupancy: leave time, or now / end of its day while still open. */
export function visitEnd(v: TrafficVisit, now = new Date()): Date {
  if (v.leaveTime) return v.leaveTime;
  const dayEnd = endOfDay(v.registredTime);
  return now < dayEnd ? now : dayEnd;
}

/** Local hours (0-23) of the arrival day during which the visit was on site. */
export function hoursOnSite(v: TrafficVisit, now = new Date()): number[] {
  const dayStart = startOfDay(v.registredTime).getTime();
  const from = v.registredTime.getTime();
  const to = Math.min(visitEnd(v, now).getTime(), endOfDay(v.registredTime).getTime());
  const hours: number[] = [];
  for (let h = 0; h < 24; h++) {
    const hs = dayStart + h * HOUR_MS;
    const he = hs + HOUR_MS;
    if (from < he && to > hs) hours.push(h);
  }
  if (!hours.length) hours.push(v.registredTime.getHours());
  return hours;
}

export type HourlySeries = { arrivals: number[]; present: number[] };

export function emptySeries(): HourlySeries {
  return { arrivals: Array(24).fill(0), present: Array(24).fill(0) };
}

export function addVisitToSeries(
  series: HourlySeries,
  v: TrafficVisit,
  now = new Date(),
) {
  series.arrivals[v.registredTime.getHours()] += 1;
  for (const h of hoursOnSite(v, now)) series.present[h] += 1;
}

export function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function peakIndex(values: number[]): number {
  let best = 0;
  for (let i = 1; i < values.length; i++) if (values[i] > values[best]) best = i;
  return best;
}
