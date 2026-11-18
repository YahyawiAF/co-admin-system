/**
 * Clients split by how often they come (Conseil analysis, 2026-11): who came once,
 * who is late on their own rhythm, who comes every week… Plain functions, read only.
 */
import { differenceInCalendarDays, startOfWeek } from 'date-fns';
import { localDayKey } from '../../../common/parse-local-day';

export const CLIENT_GROUPS = ['SUBSCRIBER', 'NEW', 'ONCE', 'TWICE', 'LATE', 'REGULAR', 'SOMETIMES', 'RARE', 'LOST'] as const;
export type ClientGroup = (typeof CLIENT_GROUPS)[number];

export const CLIENT_GROUP_RULES: Record<ClientGroup, { label: string; rule: string }> = {
  SUBSCRIBER: { label: 'Abonné', rule: 'Un abonnement en cours aujourd’hui.' },
  NEW: { label: 'Nouveau', rule: 'Première visite il y a 14 jours ou moins.' },
  ONCE: { label: 'Venu une fois', rule: '1 seul jour de visite, il y a 15 à 60 jours.' },
  TWICE: { label: 'Venu deux fois', rule: '2 jours de visite : pas encore de rythme. Dernière visite il y a 60 jours ou moins.' },
  LATE: { label: 'En retard', rule: '3 jours de visite ou plus, et absent depuis plus de 1,5 × son écart habituel (au moins écart + 4 jours). 60 jours au plus.' },
  REGULAR: { label: 'Habitué', rule: '3 jours ou plus, revient en général tous les 8 jours ou moins, pas en retard.' },
  SOMETIMES: { label: 'De temps en temps', rule: '3 jours ou plus, revient en général tous les 9 à 25 jours, pas en retard.' },
  RARE: { label: 'Rare', rule: '3 jours ou plus, revient en général tous les 26 jours ou plus, pas en retard.' },
  LOST: { label: 'Perdu', rule: 'Pas venu depuis plus de 60 jours.' },
};

const NEW_DAYS = 14;
const LOST_DAYS = 60;

export type ClientVisitInput = {
  memberId: string;
  /** Check-ins (several the same day count as one visit day) */
  visits: Date[];
  subscribed: boolean;
  hasPhone: boolean;
  heardFrom: string | null;
};

export type ClientRow = {
  memberId: string;
  group: ClientGroup;
  visitDays: number;
  first: string;
  last: string;
  daysSinceLast: number;
  /** Median days between two visit days; null under 3 visit days */
  usualGap: number | null;
  hasPhone: boolean;
  heardFrom: string | null;
};

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** One client's group, from their visit days. */
export function clientRow(c: ClientVisitInput, now: Date): ClientRow | null {
  const keys = [...new Set(c.visits.map((d) => localDayKey(d)))].sort();
  if (!keys.length) return null;
  const days = keys.map((k) => new Date(`${k}T12:00:00`));
  const since = (d: Date) => differenceInCalendarDays(now, d);
  const daysSinceLast = since(days[days.length - 1]);
  const gaps = days.slice(1).map((d, i) => differenceInCalendarDays(d, days[i]));
  const usualGap = days.length >= 3 ? median(gaps) : null;

  let group: ClientGroup;
  if (c.subscribed) group = 'SUBSCRIBER';
  else if (since(days[0]) <= NEW_DAYS) group = 'NEW';
  else if (daysSinceLast > LOST_DAYS) group = 'LOST';
  else if (days.length === 1) group = 'ONCE';
  else if (days.length === 2) group = 'TWICE';
  else if (daysSinceLast > Math.max(usualGap! * 1.5, usualGap! + 4)) group = 'LATE';
  else group = usualGap! <= 8 ? 'REGULAR' : usualGap! <= 25 ? 'SOMETIMES' : 'RARE';

  return {
    memberId: c.memberId,
    group,
    visitDays: days.length,
    first: keys[0],
    last: keys[keys.length - 1],
    daysSinceLast,
    usualGap,
    hasPhone: c.hasPhone,
    heardFrom: c.heardFrom,
  };
}

/** Every client's group, the count per group, and the new clients week by week (did they come back?). */
export function clientGroups(clients: ClientVisitInput[], now: Date) {
  const rows = clients.map((c) => clientRow(c, now)).filter((r): r is ClientRow => !!r);
  const groups = CLIENT_GROUPS.map((g) => {
    const inGroup = rows.filter((r) => r.group === g);
    return { group: g, ...CLIENT_GROUP_RULES[g], count: inGroup.length, withPhone: inGroup.filter((r) => r.hasPhone).length };
  });

  // New clients by week of first visit, by where they heard of us, and how many came back within 14 days
  const weeks = new Map<string, { newClients: number; cameBack: number; judged: number; heardFrom: Record<string, number> }>();
  for (const c of clients) {
    const keys = [...new Set(c.visits.map((d) => localDayKey(d)))].sort();
    if (!keys.length) continue;
    const first = new Date(`${keys[0]}T12:00:00`);
    if (differenceInCalendarDays(now, first) > 120) continue;
    const week = localDayKey(startOfWeek(first, { weekStartsOn: 1 }));
    const w = weeks.get(week) ?? { newClients: 0, cameBack: 0, judged: 0, heardFrom: {} };
    w.newClients += 1;
    const src = c.heardFrom ?? 'UNKNOWN';
    w.heardFrom[src] = (w.heardFrom[src] ?? 0) + 1;
    if (differenceInCalendarDays(now, first) >= NEW_DAYS) {
      w.judged += 1;
      if (keys.slice(1).some((k) => differenceInCalendarDays(new Date(`${k}T12:00:00`), first) <= NEW_DAYS)) w.cameBack += 1;
    }
    weeks.set(week, w);
  }
  const newByWeek = [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([weekStart, w]) => ({ weekStart, ...w }));

  // Each day: different clients who came, how many were new, how many came back
  const dayMap = new Map<string, { clients: number; newClients: number }>();
  const byId = new Map(clients.map((c) => [c.memberId, c]));
  for (const r of rows) {
    const c = byId.get(r.memberId)!;
    for (const k of new Set(c.visits.map((d) => localDayKey(d)))) {
      if (differenceInCalendarDays(now, new Date(`${k}T12:00:00`)) > 60) continue;
      const d = dayMap.get(k) ?? { clients: 0, newClients: 0 };
      d.clients += 1;
      if (k === r.first) d.newClients += 1;
      dayMap.set(k, d);
    }
  }
  const daily = [...dayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({ date, clients: d.clients, newClients: d.newClients, returning: d.clients - d.newClients }));

  return { rules: 'Chaque client est dans un seul groupe, vérifié dans cet ordre : ' + CLIENT_GROUPS.join(' → '), groups, newByWeek, daily, clients: rows };
}
