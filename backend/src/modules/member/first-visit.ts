import { endOfDay, isSameDay, startOfDay } from 'date-fns';
import { PrismaService } from 'database/prisma.service';
import { localDayKey } from '../../../common/parse-local-day';

/**
 * "Nouveau client" = a member on the day of their very first visit
 * (their earliest journal row). Reception greets them; the app welcomes them.
 */

/** Earliest journal row time per member. */
export async function firstVisitTimes(
  prisma: PrismaService,
  memberIds: string[],
): Promise<Map<string, Date>> {
  const ids = [...new Set(memberIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const rows = await prisma.journal.groupBy({
    by: ['memberID'],
    where: { memberID: { in: ids } },
    _min: { registredTime: true },
  });
  const out = new Map<string, Date>();
  for (const r of rows) {
    if (r.memberID && r._min.registredTime) {
      out.set(r.memberID, r._min.registredTime);
    }
  }
  return out;
}

/** True when `at` falls on the member's first visit day. */
export function onFirstVisitDay(
  firsts: Map<string, Date>,
  memberId: string | null | undefined,
  at: Date | string = new Date(),
): boolean {
  if (!memberId) return false;
  const first = firsts.get(memberId);
  return !!first && isSameDay(first, new Date(at));
}

/** Members whose first visit ever is today. */
export async function firstVisitTodayIds(
  prisma: PrismaService,
  memberIds: string[],
  now = new Date(),
): Promise<Set<string>> {
  const firsts = await firstVisitTimes(prisma, memberIds);
  return new Set(
    [...firsts.keys()].filter((id) => onFirstVisitDay(firsts, id, now)),
  );
}

/** How many members of the org have their first visit ever today. */
export async function newClientsTodayCount(
  prisma: PrismaService,
  organizationId?: string,
  now = new Date(),
): Promise<number> {
  const rows = await prisma.journal.groupBy({
    by: ['memberID'],
    where: {
      memberID: { not: null },
      ...(organizationId ? { members: { organizationId } } : {}),
    },
    _min: { registredTime: true },
    having: { registredTime: { _min: { gte: startOfDay(now) } } },
  });
  // A booking for a later day is not a visit today
  return rows.filter(
    (r) => r._min.registredTime && r._min.registredTime <= endOfDay(now),
  ).length;
}

/** Sorted visit days ("yyyy-MM-dd") per member — for "Nᵉ visite" badges. */
export async function visitDaysByMember(
  prisma: PrismaService,
  memberIds: string[],
): Promise<Map<string, string[]>> {
  const ids = [...new Set(memberIds.filter(Boolean))];
  const out = new Map<string, string[]>();
  if (!ids.length) return out;
  const rows = await prisma.journal.findMany({
    where: { memberID: { in: ids }, isReservation: false, hiddenAt: null },
    select: { memberID: true, registredTime: true },
  });
  const sets = new Map<string, Set<string>>();
  for (const r of rows) {
    const set = sets.get(r.memberID!) ?? new Set<string>();
    set.add(localDayKey(r.registredTime));
    sets.set(r.memberID!, set);
  }
  for (const [id, set] of sets) out.set(id, [...set].sort());
  return out;
}

/** How many visit days the member had up to (and including) `at`'s day. */
export function visitNumberAt(days: string[] | undefined, at: Date | string): number {
  if (!days?.length) return 0;
  const key = localDayKey(new Date(at));
  let n = 0;
  for (const d of days) if (d <= key) n++;
  return n;
}
