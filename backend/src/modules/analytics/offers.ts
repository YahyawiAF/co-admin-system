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
  /** "4 visites en 12 jours · 36,8 DT payés en passes" */
  observed: string;
  /** "À ce rythme ~92 DT par mois en passes · « Plan » = 120 DT → +28 DT pour venir tous les jours" */
  headline: string;
};

function periodLabel(days: number) {
  if (days === 7) return '1 semaine';
  if (days === 14) return '2 semaines';
  if (days >= 28 && days <= 31) return '1 mois';
  return `${days} jours`;
}

function perPeriodLabel(days: number) {
  if (days === 7) return 'par semaine';
  if (days === 14) return 'toutes les 2 semaines';
  if (days >= 28 && days <= 31) return 'par mois';
  return `sur ${days} jours`;
}

function dt(n: number) {
  return `${Math.round(n * 10) / 10} DT`.replace('.', ',');
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
    const paceText = `À ce rythme ~${Math.round(best.projected)} DT ${perPeriodLabel(best.plan.periodDays!)} en passes`;
    const deal = `« ${best.plan.name} » = ${dt(best.price)}`;
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
      observed: `${visitDays} visite${visitDays > 1 ? 's' : ''} en ${spanDays} jours · ${dt(acc.spend)} payés en passes`,
      headline:
        savings >= 1
          ? `${paceText} · ${deal} → économise ~${Math.round(savings)} DT sur ${period}`
          : savings > -1
            ? `${paceText} · ${deal} → même prix, sans compter les jours`
            : `${paceText} · ${deal} → +${Math.round(-savings)} DT pour venir tous les jours (${period})`,
    });
  }
  return out;
}

export type TopUpOffer = {
  memberId: string;
  plan: {
    id: string;
    name: string;
    price: number;
    periodDays: number;
    durationHours: number | null;
  };
  /** Passes paid inside the plan period (DT) — deducted from the abonnement. */
  paid: number;
  /** What the client still has to pay. */
  remaining: number;
  /** paid / price, in % */
  paidPct: number;
  visitDays: number;
  /** First paid visit counted (yyyy-MM-dd): the backdated start option. */
  firstVisit: string;
  headline: string;
};

/** Share of the abonnement already paid in passes from which the top-up is proposed. */
export const TOP_UP_MIN_RATIO = 0.5;

/**
 * Clients without an abonnement whose paid passes over the last plan period already
 * cover a good share of it: "pay the rest and become a subscriber".
 */
export async function computeTopUps(
  prisma: PrismaService,
  now = new Date(),
  minRatio = TOP_UP_MIN_RATIO,
): Promise<Map<string, TopUpOffer>> {
  const out = new Map<string, TopUpOffer>();
  const today = startOfDay(now);
  const [plans, activeAbos] = await Promise.all([
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
    prisma.abonnement.findMany({
      where: { isReservation: false, leaveDate: { gte: now } },
      select: { memberID: true },
    }),
  ]);
  if (!plans.length) return out;
  const longest = Math.max(...plans.map((p) => p.periodDays!));
  const visits = await prisma.journal.findMany({
    where: {
      registredTime: { gte: subDays(today, longest - 1) },
      isReservation: false,
      isPayed: true,
      memberID: { not: null },
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
  });
  const subscribed = new Set(activeAbos.map((a) => a.memberID));
  const byMember = new Map<string, typeof visits>();
  for (const v of visits) {
    if (subscribed.has(v.memberID!) || !(v.payedAmount > 0)) continue;
    const list = byMember.get(v.memberID!) || [];
    list.push(v);
    byMember.set(v.memberID!, list);
  }

  for (const [memberId, list] of byMember) {
    const hoursByDay = new Map<string, number>();
    for (const v of list) {
      const hours = v.leaveTime
        ? (visitEnd(v, now).getTime() - v.registredTime.getTime()) / HOUR_MS
        : v.fixedDurationHours || (now.getTime() - v.registredTime.getTime()) / HOUR_MS;
      const k = localDayKey(v.registredTime);
      hoursByDay.set(k, (hoursByDay.get(k) || 0) + Math.max(0, Math.min(24, hours)));
    }
    const typicalHours = median([...hoursByDay.values()]);
    const discount =
      list[0].members?.discountAbonnement ?? list[0].members?.group?.discountAbonnement ?? 0;

    let best: { plan: (typeof plans)[number]; price: number; paid: number; first: Date; days: number } | null = null;
    for (const plan of plans) {
      if (plan.durationHours != null && plan.durationHours < typicalHours * 0.9) continue;
      const since = subDays(today, plan.periodDays! - 1);
      const inWindow = list.filter((v) => v.registredTime >= since);
      if (!inWindow.length) continue;
      const paid = inWindow.reduce((a, v) => a + (v.payedAmount || 0), 0);
      const price = round1(plan.price * (1 - discount / 100));
      const ratio = paid / price;
      if (ratio < minRatio) continue;
      const bestRatio = best ? best.paid / best.price : 0;
      if (
        !best ||
        ratio > bestRatio + 0.0001 ||
        (Math.abs(ratio - bestRatio) < 0.0001 && plan.periodDays! > best.plan.periodDays!)
      ) {
        best = {
          plan,
          price,
          paid,
          first: inWindow.reduce((a, v) => (v.registredTime < a ? v.registredTime : a), inWindow[0].registredTime),
          days: new Set(inWindow.map((v) => localDayKey(v.registredTime))).size,
        };
      }
    }
    if (!best) continue;
    const remaining = round1(Math.max(0, best.price - best.paid));
    const paidPct = Math.round((best.paid / best.price) * 100);
    out.set(memberId, {
      memberId,
      plan: {
        id: best.plan.id,
        name: best.plan.name,
        price: best.price,
        periodDays: best.plan.periodDays!,
        durationHours: best.plan.durationHours,
      },
      paid: round1(best.paid),
      remaining,
      paidPct,
      visitDays: best.days,
      firstVisit: localDayKey(best.first),
      headline:
        remaining <= 0
          ? `A déjà payé ${dt(best.paid)} en passes, plus que « ${best.plan.name} » (${dt(best.price)})`
          : `A déjà payé ${dt(best.paid)} sur ${dt(best.price)} (${paidPct} %) · reste ${dt(remaining)} pour « ${best.plan.name} »`,
    });
  }
  return out;
}
