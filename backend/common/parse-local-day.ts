import { isSameDay, startOfDay } from 'date-fns';

/**
 * Parse a calendar day in the server's local timezone.
 * Avoids `new Date("yyyy-MM-dd")` (UTC midnight) shifting the day for UTC+.
 */
export function parseLocalDay(input?: string | Date | null): Date {
  if (input == null || input === '') {
    return startOfDay(new Date());
  }
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) {
      return startOfDay(new Date());
    }
    return startOfDay(input);
  }
  const s = String(input).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) {
    const y = Number(m[1]);
    const month = Number(m[2]) - 1;
    const d = Number(m[3]);
    return startOfDay(new Date(y, month, d));
  }
  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) {
    return startOfDay(new Date());
  }
  return startOfDay(parsed);
}

export function isLocalToday(date: string | Date): boolean {
  return isSameDay(parseLocalDay(date), startOfDay(new Date()));
}

/** Local calendar key yyyy-MM-dd (not UTC ISO). */
export function localDayKey(d: Date): string {
  const day = startOfDay(d);
  const y = day.getFullYear();
  const m = String(day.getMonth() + 1).padStart(2, '0');
  const dd = String(day.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
