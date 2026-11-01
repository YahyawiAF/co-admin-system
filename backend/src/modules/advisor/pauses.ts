import { addDays, endOfDay, startOfDay } from 'date-fns';
import { localDayKey } from '../../../common/parse-local-day';

/** A pause of an action, local days (yyyy-MM-dd). to = null while still paused. */
export type Pause = { from: string; to: string | null };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function parsePauses(raw: unknown): Pause[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p) => p && typeof p.from === 'string' && DAY.test(p.from))
    .map((p) => ({ from: p.from as string, to: typeof p.to === 'string' && DAY.test(p.to) ? (p.to as string) : null }))
    .sort((a, b) => a.from.localeCompare(b.from));
}

/** The open pause, if the action is paused now. */
export const openPause = (pauses: Pause[]) => pauses.find((p) => p.to == null) ?? null;

/** Start a pause today (no-op when already paused). */
export function pause(pauses: Pause[], today: string): Pause[] {
  if (openPause(pauses)) return pauses;
  return [...pauses, { from: today, to: null }];
}

/**
 * Resume today: the open pause ends yesterday (or is removed when it started today).
 * Days from `from` to `to` included are paused.
 */
export function resume(pauses: Pause[], today: string): Pause[] {
  const open = openPause(pauses);
  if (!open) return pauses;
  const yesterday = localDayKey(addDays(new Date(`${today}T12:00:00`), -1));
  return pauses
    .map((p) => (p === open ? { from: p.from, to: yesterday } : p))
    .filter((p) => p.to == null || p.to >= p.from);
}

/** true for a day inside a pause (an open pause runs until today). */
export function pausedDay(pauses: Pause[], today: string) {
  return (d: Date) => {
    const k = localDayKey(d);
    return pauses.some((p) => k >= p.from && k <= (p.to ?? today));
  };
}

/**
 * Measured window of an action: from its start, `windowDays` active days
 * (paused days are skipped and push the end later), stopped by its end date
 * and by now. Returns the window end and the number of active days in it.
 */
export function activeWindow(start: Date, windowDays: number, limit: Date, pauses: Pause[], today: string) {
  const skip = pausedDay(pauses, today);
  let active = 0;
  let last: Date | null = null;
  for (let d = startOfDay(start); d <= limit && active < windowDays; d = addDays(d, 1)) {
    if (skip(d)) continue;
    active += 1;
    last = d;
  }
  const paused = pauses.reduce((n, p) => {
    let c = 0;
    for (let d = new Date(`${p.from}T12:00:00`); localDayKey(d) <= (p.to ?? today) && d <= limit; d = addDays(d, 1)) c += 1;
    return n + c;
  }, 0);
  return { end: last ? endOfDay(last) : null, activeDays: active, pausedDays: paused, skip };
}
