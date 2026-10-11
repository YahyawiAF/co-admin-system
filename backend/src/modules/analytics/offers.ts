import { differenceInCalendarDays, startOfDay, subDays } from 'date-fns';
import { PrismaService } from 'database/prisma.service';
import { localDayKey } from '../../../common/parse-local-day';
import { round1, visitEnd } from './traffic';

const HOUR_MS = 3_600_000;

export type AbonnementOffer = {
  memberId: string;
  visitDays: number;
  spend: number;
  spanDays: number;
  typicalHours: number;
  plan: {
    id: string;
    name: string;
    price: number;
    periodDays: number;
    durationHours: number | null;
  };
  /** What the visitor would pay in passes over the plan period at their current pace. */
  projectedSpend: number;
  /** projectedSpend − plan price (negative = the plan costs a bit more). */
  savings: number;
  strength: 'save' | 'close';
  headline: string;
};

function periodLabel(days: number) {
  if (days === 7) return '1 semaine';
  if (days === 14) return '2 semaines';
  if (days >= 28 && days <= 31) return '1 mois';
  return `${days} jours`;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Members paying passes at a pace close to (or above) an abonnement.
 * memberIds = null scans every member who visited in the last 30 days.
 */
export async function computeOffers(
  prisma: PrismaService,
  memberIds: string[] | null,
  now = new Date(),
): Promise<Map<string, AbonnementOffer>> {
  const out = new Map<string, AbonnementOffer>();
  if (memberIds && !memberIds.length) return out;
  const today = startOfDay(now);
  const since = subDays(today, 29);
  const memberFilter = memberIds ? { in: memberIds } : { not: null };

  const [plans, visits, activeAbos] = await Promise.all([
    prisma.price.findMany({
      where: {
        type: 'abonnement',
        isActive: true,
        billingUnit: 'PERIOD',
        periodDays: { gt: 0 },
        price: { gt: 0 },
      },
      select: { id: true, name: true, price: true, periodDays: true, durationHours: true },
    }),
    prisma.journal.findMany({
      where: {
        registredTime: { gte: since },
        isReservation: false,
        memberID: memberFilter,
      },
      select: {
        memberID: true,
        registredTime: true,
        leaveTime: true,
        payedAmount: true,
        fixedDurationHours: true,
        members: {
          select: {
            discountAbonnement: true,
            group: { select: { discountAbonnement: true } },
          },
        },
      },
    }),
    prisma.abonnement.findMany({
      where: {
        isReservation: false,
        leaveDate: { gte: now },
        ...(memberIds ? { memberID: { in: memberIds } } : {}),
      },
      select: { memberID: true },
    }),
  ]);
  if (!plans.length) return out;
  const subscribed = new Set(activeAbos.map((a) => a.memberID));

  type Acc = {
    spend: number;
    first: Date;
    hoursByDay: Map<string, number>;
    discount: number;
  };
  const byMember = new Map<string, Acc>();
  for (const v of visits) {
    const id = v.memberID!;
    if (subscribed.has(id)) continue;
    let acc = byMember.get(id);
    if (!acc) {
      acc = {
        spend: 0,
        first: v.registredTime,
        hoursByDay: new Map(),
        discount:
          v.members?.discountAbonnement ?? v.members?.group?.discountAbonnement ?? 0,
      };
      byMember.set(id, acc);
    }
    acc.spend += v.payedAmount || 0;
    if (v.registredTime < acc.first) acc.first = v.registredTime;
    const hours = v.leaveTime
      ? (visitEnd(v, now).getTime() - v.registredTime.getTime()) / HOUR_MS
      : v.fixedDurationHours || (now.getTime() - v.registredTime.getTime()) / HOUR_MS;
    const k = localDayKey(v.registredTime);
    acc.hoursByDay.set(k, (acc.hoursByDay.get(k) || 0) + Math.max(0, Math.min(24, hours)));
  }

  for (const [memberId, acc] of byMember) {
    const visitDays = acc.hoursByDay.size;
    if (visitDays < 3 || acc.spend <= 0) continue;
    const spanDays = Math.min(30, Math.max(7, differenceInCalendarDays(today, acc.first) + 1));
    const pace = acc.spend / spanDays;
    const typicalHours = median([...acc.hoursByDay.values()]);

    // Cheapest plan per period that covers the visitor's usual day length.
    const perPeriod = new Map<number, (typeof plans)[number]>();
    for (const p of plans) {
      if (p.durationHours != null && p.durationHours < typicalHours * 0.9) continue;
      const cur = perPeriod.get(p.periodDays!);
      if (!cur || p.price < cur.price) perPeriod.set(p.periodDays!, p);
    }
    let best: { plan: (typeof plans)[number]; price: number; projected: number; ratio: number } | null = null;
    for (const plan of [...perPeriod.values()].sort((a, b) => b.periodDays! - a.periodDays!)) {
      const price = round1(plan.price * (1 - acc.discount / 100));
      const projected = pace * plan.periodDays!;
      const ratio = projected / price;
      if (ratio >= 0.9) {
        best = { plan, price, projected, ratio };
        break;
      }
      if (ratio >= 0.75 && (!best || ratio > best.ratio)) {
        best = { plan, price, projected, ratio };
      }
    }
    if (!best) continue;

    const savings = round1(best.projected - best.price);
    const period = periodLabel(best.plan.periodDays!);
    out.set(memberId, {
      memberId,
      visitDays,
      spend: round1(acc.spend),
      spanDays,
      typicalHours: round1(typicalHours),
      plan: {
        id: best.plan.id,
        name: best.plan.name,
        price: best.price,
        periodDays: best.plan.periodDays!,
        durationHours: best.plan.durationHours,
      },
      projectedSpend: round1(best.projected),
      savings,
      strength: savings >= 0 ? 'save' : 'close',
      headline:
        savings >= 0
          ? `Économise ~${Math.round(savings)} DT sur ${period} avec « ${best.plan.name} »`
          : `Pour ~${Math.round(-savings)} DT de plus sur ${period}, illimité avec « ${best.plan.name} »`,
    });
  }
  return out;
}
