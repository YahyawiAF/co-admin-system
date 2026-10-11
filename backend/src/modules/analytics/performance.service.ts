import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';
import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  format,
  getDaysInMonth,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { MemberService } from '../member/member.service';
import { abonnementPaymentsInRange } from '../abonnement/abonnement-revenue';
import { expenseAmount } from '../expense/expense-amount';
import { dbDay, fromDbDay, localDayKey } from '../../../common/parse-local-day';
import { round1, visitEnd } from './traffic';

const HOUR_MS = 3_600_000;
const WEEKDAYS = [
  'dimanche',
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
];

export type PerformanceSettings = {
  facilityId: string;
  openHour: number;
  closeHour: number;
  alwaysOpen: boolean;
  regularVisitsPerWeek: number;
  inactiveAlertDays: number;
};

export type InsightSeverity =
  | 'critical'
  | 'warning'
  | 'opportunity'
  | 'info'
  | 'success';

export type Insight = {
  id: string;
  severity: InsightSeverity;
  title: string;
  detail: string;
  cta?: { label: string; href?: string; action?: 'target' };
  items?: Array<{ label: string; detail?: string; href?: string }>;
};

const SEVERITY_ORDER: Record<InsightSeverity, number> = {
  critical: 0,
  warning: 1,
  opportunity: 2,
  info: 3,
  success: 4,
};

function pct(part: number, total: number) {
  return total > 0 ? round1((part / total) * 100) : null;
}

function money(n: number) {
  return `${Math.round(n).toLocaleString('fr-FR')} DT`;
}

function memberLabel(m?: {
  firstName?: string | null;
  lastName?: string | null;
} | null) {
  return [m?.firstName, m?.lastName].filter(Boolean).join(' ') || 'Client';
}

function hourLabel(h: number) {
  return `${((h % 24) + 24) % 24}h`;
}

@Injectable()
export class PerformanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly members: MemberService,
  ) {}

  /** The facility the admin works on (explicit id, else the one with the most spaces). */
  private async facility(facilityId?: string) {
    if (facilityId) {
      const f = await this.prisma.facility.findUnique({
        where: { id: facilityId },
      });
      if (f) return f;
    }
    const all = await this.prisma.facility.findMany({
      include: { _count: { select: { spaces: true } } },
      orderBy: { createdAt: 'asc' },
    });
    if (!all.length) throw new BadRequestException('Aucun espace configuré');
    return all.reduce((best, f) =>
      f._count.spaces > best._count.spaces ? f : best,
    );
  }

  async settings(facilityId?: string): Promise<PerformanceSettings> {
    const f = await this.facility(facilityId);
    return {
      facilityId: f.id,
      openHour: f.openHour,
      closeHour: f.closeHour,
      alwaysOpen: f.alwaysOpen,
      regularVisitsPerWeek: f.regularVisitsPerWeek,
      inactiveAlertDays: f.inactiveAlertDays,
    };
  }

  async updateSettings(
    facilityId: string | undefined,
    body: Partial<Omit<PerformanceSettings, 'facilityId'>>,
  ) {
    const f = await this.facility(facilityId);
    const data: Partial<Omit<PerformanceSettings, 'facilityId'>> = {};
    const int = (v: unknown, min: number, max: number) => {
      const n = Math.round(Number(v));
      if (!Number.isFinite(n) || n < min || n > max) {
        throw new BadRequestException(`Valeur hors limites (${min}–${max})`);
      }
      return n;
    };
    if (body.openHour != null) data.openHour = int(body.openHour, 0, 23);
    if (body.closeHour != null) data.closeHour = int(body.closeHour, 1, 30);
    if (body.alwaysOpen != null) data.alwaysOpen = !!body.alwaysOpen;
    if (body.regularVisitsPerWeek != null)
      data.regularVisitsPerWeek = int(body.regularVisitsPerWeek, 1, 7);
    if (body.inactiveAlertDays != null)
      data.inactiveAlertDays = int(body.inactiveAlertDays, 2, 60);
    const open = data.openHour ?? f.openHour;
    const close = data.closeHour ?? f.closeHour;
    if (close <= open) {
      throw new BadRequestException(
        "L'heure de fermeture doit suivre l'ouverture (25 = 1h du matin)",
      );
    }
    await this.prisma.facility.update({ where: { id: f.id }, data });
    return this.settings(f.id);
  }

  async targets(facilityId: string | undefined, year: number) {
    const f = await this.facility(facilityId);
    const rows = await this.prisma.monthlyTarget.findMany({
      where: { facilityId: f.id, year },
      orderBy: { month: 'asc' },
    });
    return { facilityId: f.id, year, targets: rows };
  }

  async setTarget(body: {
    facilityId?: string;
    year: number;
    month: number;
    revenue?: number | null;
    occupancyPct?: number | null;
  }) {
    const f = await this.facility(body.facilityId);
    const year = Math.round(Number(body.year));
    const month = Math.round(Number(body.month));
    if (!year || month < 1 || month > 12) {
      throw new BadRequestException('Mois invalide');
    }
    const revenue = Number(body.revenue ?? 0);
    const key = { facilityId: f.id, year, month };
    if (!(revenue > 0)) {
      await this.prisma.monthlyTarget.deleteMany({ where: key });
      return null;
    }
    const occ = body.occupancyPct == null ? null : Number(body.occupancyPct);
    const occupancyPct =
      occ != null && Number.isFinite(occ) && occ > 0 ? Math.min(100, occ) : null;
    return this.prisma.monthlyTarget.upsert({
      where: { facilityId_year_month: key },
      create: { ...key, revenue, occupancyPct },
      update: { revenue, occupancyPct },
    });
  }

  /** This month's target, else the latest earlier one (carried over). */
  private async targetFor(facilityId: string, year: number, month: number) {
    const own = await this.prisma.monthlyTarget.findUnique({
      where: { facilityId_year_month: { facilityId, year, month } },
    });
    if (own) return { ...own, inherited: false };
    const prev = await this.prisma.monthlyTarget.findFirst({
      where: {
        facilityId,
        OR: [{ year: { lt: year } }, { year, month: { lt: month } }],
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
    return prev ? { ...prev, inherited: true } : null;
  }

  /** Bookable places: active non-overflow seats, or the declared capacity of seatless spaces. */
  private async capacity(facilityId: string) {
    const spaces = await this.prisma.space.findMany({
      where: { facilityId },
      select: {
        capacityNormal: true,
        seats: { where: { isActive: true, isOverflow: false }, select: { id: true } },
      },
    });
    return spaces.reduce(
      (n, s) => n + (s.seats.length || Math.max(0, s.capacityNormal)),
      0,
    );
  }

  /** Hours open on a day: configured window, widened when visits happened outside it. */
  private openHoursForDay(
    s: PerformanceSettings,
    observed?: { first: number; last: number },
  ) {
    if (s.alwaysOpen) return 24;
    let from = s.openHour;
    let to = s.closeHour;
    if (observed) {
      from = Math.min(from, observed.first);
      to = Math.max(to, observed.last);
    }
    return Math.min(24, Math.max(0, to - from));
  }

  private async periodMetrics(
    s: PerformanceSettings,
    seats: number,
    start: Date,
    end: Date,
    now: Date,
  ) {
    const [journals, aboPayments, dailyProducts, dailyExpenses, visits] =
      await Promise.all([
        this.prisma.journal.findMany({
          where: { registredTime: { gte: start, lte: end }, isPayed: true },
          select: { registredTime: true, payedAmount: true },
        }),
        this.prisma.abonnementPayment.findMany({
          where: abonnementPaymentsInRange(start, end),
          select: { paidAt: true, amount: true },
        }),
        this.prisma.dailyProduct.findMany({
          where: {
            date: { gte: start, lte: end },
            status: { notIn: ['PENDING', 'CANCELLED'] },
          },
          select: {
            date: true,
            quantite: true,
            product: { select: { sellingPrice: true } },
          },
        }),
        this.prisma.dailyExpense.findMany({
          where: { date: { gte: start, lte: end } },
          select: { amount: true, expense: { select: { amount: true } } },
        }),
        this.prisma.journal.findMany({
          where: { registredTime: { gte: start, lte: end }, isReservation: false },
          select: {
            registredTime: true,
            leaveTime: true,
            memberID: true,
            isPayed: true,
            payedAmount: true,
          },
        }),
      ]);

    const revenueByDay = new Map<string, number>();
    const addDay = (d: Date | null, amount: number) => {
      if (!d) return;
      const k = localDayKey(d);
      revenueByDay.set(k, (revenueByDay.get(k) || 0) + amount);
    };

    let journalRevenue = 0;
    for (const j of journals) {
      journalRevenue += j.payedAmount || 0;
      addDay(j.registredTime, j.payedAmount || 0);
    }
    let abonnements = 0;
    for (const p of aboPayments) {
      abonnements += p.amount;
      addDay(p.paidAt, p.amount);
    }
    let products = 0;
    for (const dp of dailyProducts) {
      const v = (dp.product?.sellingPrice || 0) * dp.quantite;
      products += v;
      addDay(dp.date, v);
    }
    const expenses = dailyExpenses.reduce((a, de) => a + expenseAmount(de), 0);
    const revenue = journalRevenue + abonnements + products;

    const observed = new Map<string, { first: number; last: number }>();
    const visitsByDay = new Map<string, number>();
    const usedByDay = new Map<string, number>();
    let seatHoursUsed = 0;
    let closedMinutes = 0;
    let closedCount = 0;
    const visitorKeys = new Set<string>();
    let anonymous = 0;
    let paidVisits = 0;
    for (const v of visits) {
      const dayStart = startOfDay(v.registredTime).getTime();
      const vEnd = Math.min(visitEnd(v, now).getTime(), end.getTime(), now.getTime());
      const hours = Math.max(0, Math.min(24, (vEnd - v.registredTime.getTime()) / HOUR_MS));
      seatHoursUsed += hours;
      if (v.leaveTime) {
        closedMinutes += hours * 60;
        closedCount += 1;
      }
      const k = localDayKey(v.registredTime);
      visitsByDay.set(k, (visitsByDay.get(k) || 0) + 1);
      usedByDay.set(k, (usedByDay.get(k) || 0) + hours);
      const first = (v.registredTime.getTime() - dayStart) / HOUR_MS;
      const last = (vEnd - dayStart) / HOUR_MS;
      const o = observed.get(k);
      if (!o) observed.set(k, { first: Math.floor(first), last: Math.ceil(last) });
      else {
        o.first = Math.min(o.first, Math.floor(first));
        o.last = Math.max(o.last, Math.ceil(last));
      }
      if (v.memberID) visitorKeys.add(v.memberID);
      else anonymous += 1;
      if (v.isPayed && (v.payedAmount || 0) > 0) paidVisits += 1;
    }

    const lastDay = end < now ? end : now;
    let openHoursTotal = 0;
    let days = 0;
    const weekdays = Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      occurrences: 0,
      revenue: 0,
      visits: 0,
      seatHoursUsed: 0,
      openHours: 0,
    }));
    for (let d = startOfDay(start); d <= lastDay; d = addDays(d, 1)) {
      const k = localDayKey(d);
      let h = this.openHoursForDay(s, observed.get(k));
      if (k === localDayKey(now)) {
        const sinceOpen = (now.getTime() - d.getTime()) / HOUR_MS - (s.alwaysOpen ? 0 : s.openHour);
        h = Math.max(0, Math.min(h, sinceOpen));
      }
      openHoursTotal += h;
      days += 1;
      const w = weekdays[d.getDay()];
      w.occurrences += 1;
      w.revenue += revenueByDay.get(k) || 0;
      w.visits += visitsByDay.get(k) || 0;
      w.seatHoursUsed += usedByDay.get(k) || 0;
      w.openHours += h;
    }

    const capacityHours = seats * openHoursTotal;
    return {
      revenue: round1(revenue),
      revenueJournal: round1(journalRevenue),
      revenueAbonnements: round1(abonnements),
      revenueProducts: round1(products),
      expenses: round1(expenses),
      net: round1(revenue - expenses),
      marginPct: pct(revenue - expenses, revenue),
      recurringSharePct: pct(abonnements, revenue),
      days,
      revenuePerDay: days ? round1(revenue / days) : 0,
      revenuePerSeatDay: seats && days ? round1(revenue / (seats * days)) : null,
      visits: visits.length,
      uniqueVisitors: visitorKeys.size + anonymous,
      avgVisitsPerDay: days ? round1(visits.length / days) : 0,
      avgDurationMin: closedCount ? Math.round(closedMinutes / closedCount) : null,
      avgTicket: paidVisits ? round1(journalRevenue / paidVisits) : null,
      seatHoursUsed: round1(seatHoursUsed),
      capacityHours: round1(capacityHours),
      occupancyPct:
        capacityHours > 0
          ? Math.min(100, round1((seatHoursUsed / capacityHours) * 100))
          : null,
      weekdays: weekdays.map((w) => ({
        weekday: w.weekday,
        occurrences: w.occurrences,
        avgRevenue: w.occurrences ? round1(w.revenue / w.occurrences) : 0,
        avgVisits: w.occurrences ? round1(w.visits / w.occurrences) : 0,
        occupancyPct:
          seats && w.openHours > 0
            ? Math.min(100, round1((w.seatHoursUsed / (seats * w.openHours)) * 100))
            : null,
      })),
    };
  }

  private delta(cur: number | null, prev: number | null) {
    if (cur == null || prev == null) return null;
    if (prev === 0) return cur === 0 ? 0 : null;
    return round1(((cur - prev) / Math.abs(prev)) * 100);
  }

  async overview(opts: { facilityId?: string; year?: number; month?: number }) {
    const now = new Date();
    const year = opts.year || now.getFullYear();
    const month = opts.month || now.getMonth() + 1;
    const s = await this.settings(opts.facilityId);
    const seats = await this.capacity(s.facilityId);

    const start = startOfMonth(new Date(year, month - 1, 1));
    const monthEnd = endOfMonth(start);
    const isCurrent = now >= start && now <= monthEnd;
    const isFuture = start > now;
    const cutoff = isCurrent ? now : monthEnd;
    const daysInMonth = getDaysInMonth(start);

    const prevStart = startOfMonth(subMonths(start, 1));
    const prevMonthEnd = endOfMonth(prevStart);
    const prevCutoff = isCurrent
      ? new Date(Math.min(prevStart.getTime() + (now.getTime() - start.getTime()), prevMonthEnd.getTime()))
      : prevMonthEnd;

    const [current, previous, target] = await Promise.all([
      isFuture ? null : this.periodMetrics(s, seats, start, cutoff, now),
      this.periodMetrics(s, seats, prevStart, prevCutoff, now),
      this.targetFor(s.facilityId, year, month),
    ]);

    const openSpan = s.alwaysOpen ? 24 : Math.max(1, s.closeHour - s.openHour);
    const todayDone = isCurrent
      ? Math.max(0, Math.min(1, ((now.getTime() - startOfDay(now).getTime()) / HOUR_MS - (s.alwaysOpen ? 0 : s.openHour)) / openSpan))
      : 1;
    const elapsedDays = isFuture
      ? 0
      : isCurrent
        ? now.getDate() - 1 + todayDone
        : daysInMonth;
    const elapsedFraction = elapsedDays / daysInMonth;
    const revenue = current?.revenue ?? 0;
    const projected =
      isCurrent && elapsedDays > 0.5
        ? round1((revenue / elapsedDays) * daysInMonth)
        : isFuture
          ? null
          : revenue;
    const remainingDays = isCurrent ? daysInMonth - now.getDate() + 1 : 0;

    const targetBlock = target
      ? {
          revenue: target.revenue,
          occupancyPct: target.occupancyPct,
          inherited: target.inherited,
          fromMonth: target.inherited ? { year: target.year, month: target.month } : null,
          progressPct: round1((revenue / target.revenue) * 100),
          expectedPct: round1(elapsedFraction * 100),
          expectedByNow: round1(target.revenue * elapsedFraction),
          gap: round1(revenue - target.revenue * elapsedFraction),
          remaining: round1(Math.max(0, target.revenue - revenue)),
          neededPerDay:
            remainingDays > 0
              ? round1(Math.max(0, target.revenue - revenue) / remainingDays)
              : null,
          projectedPct:
            projected != null ? round1((projected / target.revenue) * 100) : null,
        }
      : null;

    const deltas = current
      ? {
          revenue: this.delta(current.revenue, previous.revenue),
          net: this.delta(current.net, previous.net),
          visits: this.delta(current.visits, previous.visits),
          occupancyPct:
            current.occupancyPct != null && previous.occupancyPct != null
              ? round1(current.occupancyPct - previous.occupancyPct)
              : null,
          revenuePerSeatDay: this.delta(current.revenuePerSeatDay, previous.revenuePerSeatDay),
          recurringSharePct:
            current.recurringSharePct != null && previous.recurringSharePct != null
              ? round1(current.recurringSharePct - previous.recurringSharePct)
              : null,
          avgTicket: this.delta(current.avgTicket, previous.avgTicket),
          marginPct:
            current.marginPct != null && previous.marginPct != null
              ? round1(current.marginPct - previous.marginPct)
              : null,
        }
      : null;

    const weekEnd = now;
    const weekStart = startOfDay(subDays(now, 6));
    const [week, prevWeek] = await Promise.all([
      this.periodMetrics(s, seats, weekStart, weekEnd, now),
      this.periodMetrics(
        s,
        seats,
        subDays(weekStart, 7),
        new Date(weekEnd.getTime() - 7 * 86_400_000),
        now,
      ),
    ]);

    const ranked = (current?.weekdays ?? [])
      .filter((w) => w.occurrences > 0)
      .sort((a, b) => b.avgRevenue - a.avgRevenue);

    return {
      settings: s,
      seats,
      period: {
        year,
        month,
        from: start.toISOString(),
        to: cutoff.toISOString(),
        daysInMonth,
        elapsedDays: round1(elapsedDays),
        remainingDays,
        isCurrent,
        isFuture,
        comparedTo: {
          from: prevStart.toISOString(),
          to: prevCutoff.toISOString(),
          likeForLike: isCurrent,
        },
      },
      current,
      previous,
      deltas,
      projected,
      target: targetBlock,
      bestWeekday: ranked[0]?.weekday ?? null,
      worstWeekday: ranked.length > 1 ? ranked[ranked.length - 1].weekday : null,
      week: {
        revenue: week.revenue,
        visits: week.visits,
        occupancyPct: week.occupancyPct,
        revenueDelta: this.delta(week.revenue, prevWeek.revenue),
        visitsDelta: this.delta(week.visits, prevWeek.visits),
        bestWeekday:
          [...week.weekdays].sort((a, b) => b.avgRevenue - a.avgRevenue)[0]
            ?.weekday ?? null,
      },
    };
  }

  async insights(facilityId?: string) {
    const now = new Date();
    const today = startOfDay(now);
    const s = await this.settings(facilityId);
    const seats = await this.capacity(s.facilityId);
    const out: Insight[] = [];

    await Promise.all([
      this.abonnementInsights(out, today, now),
      this.unpaidInsight(out, today),
      this.conversionInsight(out, s, today),
      this.inactiveRegularsInsight(out, s, today),
      this.slotInsights(out, s, seats, today, now),
      this.monthInsights(out, s, seats, now),
      this.caisseInsights(out, today, now),
      this.stockInsight(out),
    ]);

    out.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
    return { generatedAt: now.toISOString(), insights: out };
  }

  private async abonnementInsights(out: Insight[], today: Date, now: Date) {
    const abos = await this.prisma.abonnement.findMany({
      where: {
        isReservation: false,
        leaveDate: { gte: subDays(today, 14) },
      },
      select: {
        id: true,
        memberID: true,
        registredDate: true,
        leaveDate: true,
        serviceName: true,
        price: { select: { name: true } },
        members: { select: { firstName: true, lastName: true, phone: true } },
      },
    });
    const latestEnd = new Map<string, number>();
    for (const a of abos) {
      const t = a.leaveDate!.getTime();
      if (t > (latestEnd.get(a.memberID) ?? 0)) latestEnd.set(a.memberID, t);
    }
    const isLatest = (a: (typeof abos)[number]) =>
      a.leaveDate!.getTime() === latestEnd.get(a.memberID);

    const expiring = abos
      .filter(
        (a) =>
          isLatest(a) &&
          a.registredDate <= now &&
          a.leaveDate! >= today &&
          a.leaveDate! <= endOfDay(addDays(today, 3)),
      )
      .sort((a, b) => a.leaveDate!.getTime() - b.leaveDate!.getTime());
    if (expiring.length) {
      out.push({
        id: 'abo-expiring',
        severity: 'warning',
        title: `${expiring.length} abonnement${expiring.length > 1 ? 's se terminent' : ' se termine'} d'ici 3 jours`,
        detail:
          'Proposez le renouvellement maintenant : un client relancé avant la fin renouvelle bien plus souvent.',
        cta: { label: 'Voir les abonnements', href: '/abonnements?filter=expiring' },
        items: expiring.slice(0, 6).map((a) => {
          const d = differenceInCalendarDays(a.leaveDate!, today);
          return {
            label: memberLabel(a.members),
            detail: `${a.serviceName || a.price?.name || 'Abonnement'} · ${
              d === 0 ? "fin aujourd'hui" : d === 1 ? 'fin demain' : `fin ${format(a.leaveDate!, 'EEEE d', { locale: fr })}`
            }`,
            href: `/abonnements?memberId=${a.memberID}`,
          };
        }),
      });
    }

    const ended = abos
      .filter((a) => isLatest(a) && a.leaveDate! < today)
      .sort((a, b) => b.leaveDate!.getTime() - a.leaveDate!.getTime());
    if (ended.length) {
      out.push({
        id: 'abo-ended',
        severity: 'warning',
        title: `${ended.length} abonnement${ended.length > 1 ? 's terminés' : ' terminé'} sans renouvellement`,
        detail:
          'Terminés ces 14 derniers jours et pas encore renouvelés. Contactez-les avant qu\'ils prennent l\'habitude de ne plus venir.',
        cta: { label: 'Voir les terminés', href: '/abonnements?filter=expired' },
        items: ended.slice(0, 6).map((a) => {
          const d = differenceInCalendarDays(today, a.leaveDate!);
          return {
            label: memberLabel(a.members),
            detail: `${a.serviceName || a.price?.name || 'Abonnement'} · terminé ${d === 1 ? 'hier' : `il y a ${d} jours`}${a.members?.phone ? ` · ${a.members.phone}` : ''}`,
            href: `/abonnements?memberId=${a.memberID}`,
          };
        }),
      });
    }
  }

  private async unpaidInsight(out: Insight[], today: Date) {
    const [{ members }, openVisits] = await Promise.all([
      this.members.listDebtors(),
      this.prisma.journal.findMany({
        where: { isPayed: false, leaveTime: null, registredTime: { gte: today } },
        select: { id: true },
      }),
    ]);
    const open = new Set(openVisits.map((v) => v.id));
    let total = 0;
    let oldest: Date | null = null;
    const rows: Array<{ id: string; name: string; amount: number }> = [];
    for (const m of members) {
      let owed = 0;
      for (const it of m.items) {
        if (it.settled) continue;
        if (it.source === 'VISIT' && it.journalId && open.has(it.journalId)) continue;
        owed += it.amount;
        const d = new Date(it.date);
        if (!oldest || d < oldest) oldest = d;
      }
      if (owed > 0.009) {
        total += owed;
        rows.push({
          id: m.memberId,
          name: [m.firstName, m.lastName].filter(Boolean).join(' ') || 'Client',
          amount: owed,
        });
      }
    }
    if (total <= 0.009) return;
    const oldestDays = oldest ? differenceInCalendarDays(today, oldest) : 0;
    rows.sort((a, b) => b.amount - a.amount);
    out.push({
      id: 'unpaid',
      severity: oldestDays > 7 || total > 200 ? 'critical' : 'warning',
      title: `${money(total)} à encaisser`,
      detail: `${rows.length} client${rows.length > 1 ? 's doivent' : ' doit'} de l'argent${
        oldestDays > 0 ? `, le plus ancien depuis ${oldestDays} jour${oldestDays > 1 ? 's' : ''}` : ''
      }. Récupérer cet argent est le gain le plus rapide.`,
      cta: { label: 'Voir les impayés', href: '/impayes' },
      items: rows.slice(0, 5).map((r) => ({
        label: r.name,
        detail: money(r.amount),
      })),
    });
  }

  private async conversionInsight(
    out: Insight[],
    s: PerformanceSettings,
    today: Date,
  ) {
    const monthly = await this.prisma.price.findFirst({
      where: {
        type: 'abonnement',
        isActive: true,
        periodDays: { gte: 28, lte: 31 },
        price: { gt: 0 },
      },
      orderBy: { price: 'asc' },
      select: { name: true, price: true },
    });
    if (!monthly) return;
    const since = subDays(today, 29);
    const [visits, activeAbos] = await Promise.all([
      this.prisma.journal.findMany({
        where: {
          registredTime: { gte: since },
          isReservation: false,
          memberID: { not: null },
        },
        select: {
          memberID: true,
          registredTime: true,
          isPayed: true,
          payedAmount: true,
          members: { select: { firstName: true, lastName: true, phone: true } },
        },
      }),
      this.prisma.abonnement.findMany({
        where: { leaveDate: { gte: today } },
        select: { memberID: true },
      }),
    ]);
    const subscribed = new Set(activeAbos.map((a) => a.memberID));
    const byMember = new Map<
      string,
      { name: string; phone?: string | null; spend: number; days: Set<string> }
    >();
    for (const v of visits) {
      if (!v.memberID || subscribed.has(v.memberID)) continue;
      let row = byMember.get(v.memberID);
      if (!row) {
        row = { name: memberLabel(v.members), phone: v.members?.phone, spend: 0, days: new Set() };
        byMember.set(v.memberID, row);
      }
      row.spend += v.payedAmount || 0;
      row.days.add(localDayKey(v.registredTime));
    }
    const minDays = Math.max(6, Math.round(s.regularVisitsPerWeek * 4 * 0.75));
    const candidates = [...byMember.entries()]
      .filter(([, r]) => r.spend >= monthly.price * 0.7 || r.days.size >= minDays)
      .sort((a, b) => b[1].spend - a[1].spend);
    if (!candidates.length) return;
    out.push({
      id: 'convert',
      severity: 'opportunity',
      title: `${candidates.length} client${candidates.length > 1 ? 's paient' : ' paie'} presque un abonnement`,
      detail: `Sur 30 jours ils ont beaucoup payé en passes ou sont venus souvent. « ${monthly.name} » coûte ${money(monthly.price)} : proposez-le, c'est un revenu garanti chaque mois.`,
      cta: { label: 'Créer un abonnement', href: '/abonnements' },
      items: candidates.slice(0, 6).map(([id, r]) => ({
        label: r.name,
        detail: `${money(r.spend)} payés · ${r.days.size} jours de visite${r.phone ? ` · ${r.phone}` : ''}`,
        href: `/abonnements?memberId=${id}`,
      })),
    });
  }

  private async inactiveRegularsInsight(
    out: Insight[],
    s: PerformanceSettings,
    today: Date,
  ) {
    const quietSince = subDays(today, s.inactiveAlertDays);
    const windowStart = subDays(quietSince, 28);
    const visits = await this.prisma.journal.findMany({
      where: {
        registredTime: { gte: windowStart },
        isReservation: false,
        memberID: { not: null },
      },
      select: {
        memberID: true,
        registredTime: true,
        members: { select: { firstName: true, lastName: true, phone: true } },
      },
    });
    const byMember = new Map<
      string,
      { name: string; phone?: string | null; days: Set<string>; last: Date; recent: boolean }
    >();
    for (const v of visits) {
      const id = v.memberID!;
      let row = byMember.get(id);
      if (!row) {
        row = { name: memberLabel(v.members), phone: v.members?.phone, days: new Set(), last: v.registredTime, recent: false };
        byMember.set(id, row);
      }
      if (v.registredTime >= quietSince) row.recent = true;
      else row.days.add(localDayKey(v.registredTime));
      if (v.registredTime > row.last) row.last = v.registredTime;
    }
    const minDays = Math.max(4, Math.round(s.regularVisitsPerWeek * 4 * 0.75));
    const lost = [...byMember.entries()]
      .filter(([, r]) => !r.recent && r.days.size >= minDays)
      .sort((a, b) => b[1].days.size - a[1].days.size);
    if (!lost.length) return;
    out.push({
      id: 'inactive-regulars',
      severity: 'warning',
      title: `${lost.length} habitué${lost.length > 1 ? 's ne sont plus venus' : " n'est plus venu"} depuis ${s.inactiveAlertDays} jours`,
      detail: `Ils venaient environ ${s.regularVisitsPerWeek} fois par semaine. Un message ou un appel suffit souvent à les faire revenir.`,
      items: lost.slice(0, 6).map(([id, r]) => {
        const d = differenceInCalendarDays(today, r.last);
        return {
          label: r.name,
          detail: `${round1(r.days.size / 4)} visites/sem. · dernière il y a ${d} jours${r.phone ? ` · ${r.phone}` : ''}`,
          href: `/abonnements?memberId=${id}`,
        };
      }),
    });
  }

  /** Busy / empty weekday time slots over the last 8 weeks. */
  private async slotInsights(
    out: Insight[],
    s: PerformanceSettings,
    seats: number,
    today: Date,
    now: Date,
  ) {
    if (seats <= 0) return;
    const start = subDays(today, 56);
    const visits = await this.prisma.journal.findMany({
      where: { registredTime: { gte: start, lt: today }, isReservation: false },
      select: { registredTime: true, leaveTime: true },
    });
    if (visits.length < 20) return;
    const occurrences = Array(7).fill(0);
    for (let d = start; d < today; d = addDays(d, 1)) occurrences[d.getDay()] += 1;
    // present[weekday][hour] in seat-hours, hours 0..29 (24+ = after midnight)
    const present = Array.from({ length: 7 }, () => Array(30).fill(0));
    for (const v of visits) {
      const dayStart = startOfDay(v.registredTime).getTime();
      const from = v.registredTime.getTime();
      const to = Math.min(visitEnd(v, now).getTime(), dayStart + 30 * HOUR_MS);
      for (let h = 0; h < 30; h++) {
        const hs = dayStart + h * HOUR_MS;
        const overlap = Math.min(to, hs + HOUR_MS) - Math.max(from, hs);
        if (overlap > 0) present[v.registredTime.getDay()][h] += overlap / HOUR_MS;
      }
    }
    const occ = (w: number, h: number) =>
      occurrences[w] ? present[w][h] / occurrences[w] / seats : 0;

    type Slot = { weekday: number; from: number; to: number; pct: number };
    const busy: Slot[] = [];
    const quiet: Slot[] = [];
    const coreFrom = s.alwaysOpen ? 9 : Math.max(s.openHour, 9);
    const coreTo = s.alwaysOpen ? 20 : Math.min(s.closeHour, 20);
    for (let w = 0; w < 7; w++) {
      if (occurrences[w] < 3) continue;
      // saturated: consecutive hours >= 85 %
      let runStart = -1;
      let runSum = 0;
      for (let h = 0; h <= 30; h++) {
        const o = h < 30 ? occ(w, h) : 0;
        if (o >= 0.85) {
          if (runStart < 0) {
            runStart = h;
            runSum = 0;
          }
          runSum += o;
        } else if (runStart >= 0) {
          busy.push({ weekday: w, from: runStart, to: h, pct: Math.round((runSum / (h - runStart)) * 100) });
          runStart = -1;
        }
      }
      // quietest 3-hour block in core hours
      let best: Slot | null = null;
      for (let h = coreFrom; h + 3 <= coreTo; h++) {
        const avg = (occ(w, h) + occ(w, h + 1) + occ(w, h + 2)) / 3;
        if (!best || avg < best.pct / 100) {
          best = { weekday: w, from: h, to: h + 3, pct: Math.round(avg * 100) };
        }
      }
      if (best && best.pct < 20) quiet.push(best);
    }
    const slotLabel = (sl: Slot) =>
      `${WEEKDAYS[sl.weekday][0].toUpperCase()}${WEEKDAYS[sl.weekday].slice(1)} ${hourLabel(sl.from)}–${hourLabel(sl.to)}`;

    if (busy.length) {
      busy.sort((a, b) => b.pct - a.pct);
      out.push({
        id: 'slots-busy',
        severity: 'opportunity',
        title: `Créneau${busy.length > 1 ? 'x' : ''} presque plein${busy.length > 1 ? 's' : ''} : ${busy.slice(0, 2).map(slotLabel).join(', ')}`,
        detail:
          'Plus de 85 % des places occupées en moyenne (8 dernières semaines). Vous pouvez réserver ces heures aux abonnés, ouvrir des places en plus, ou augmenter le prix des passes sur ce créneau.',
        cta: { label: 'Gérer les tarifs', href: '/tarifs' },
        items: busy.slice(0, 5).map((sl) => ({ label: slotLabel(sl), detail: `${sl.pct} % occupé` })),
      });
    }
    if (quiet.length) {
      quiet.sort((a, b) => a.pct - b.pct);
      out.push({
        id: 'slots-quiet',
        severity: 'info',
        title: `Créneaux creux : ${quiet.slice(0, 2).map(slotLabel).join(', ')}`,
        detail:
          "Moins de 20 % des places occupées en journée. Idées : un pass « après-midi » moins cher, un événement ou un atelier, ou louer la salle à un groupe.",
        cta: { label: 'Créer un tarif', href: '/tarifs' },
        items: quiet.slice(0, 5).map((sl) => ({ label: slotLabel(sl), detail: `${sl.pct} % occupé` })),
      });
    }
  }

  private async monthInsights(
    out: Insight[],
    s: PerformanceSettings,
    seats: number,
    now: Date,
  ) {
    const start = startOfMonth(now);
    const m = await this.periodMetrics(s, seats, start, now, now);
    const target = await this.targetFor(s.facilityId, now.getFullYear(), now.getMonth() + 1);

    if (m.revenue > 0 && m.expenses > m.revenue) {
      out.push({
        id: 'expenses-over',
        severity: 'critical',
        title: 'Les dépenses dépassent le CA ce mois-ci',
        detail: `${money(m.expenses)} de dépenses pour ${money(m.revenue)} de CA. Vérifiez les grosses dépenses et ce qui reste à encaisser.`,
        cta: { label: 'Voir les dépenses', href: '/finance?tab=depenses' },
      });
    } else if (m.revenue > 0 && m.expenses / m.revenue > 0.5) {
      out.push({
        id: 'expenses-high',
        severity: 'warning',
        title: `Les dépenses font ${Math.round((m.expenses / m.revenue) * 100)} % du CA`,
        detail: `${money(m.expenses)} dépensés pour ${money(m.revenue)} encaissés ce mois-ci. Au-dessus de 50 %, la marge devient fragile.`,
        cta: { label: 'Voir les dépenses', href: '/finance?tab=depenses' },
      });
    }

    if (!target) {
      out.push({
        id: 'target-missing',
        severity: 'info',
        title: 'Fixez un objectif de CA pour ce mois',
        detail:
          "Avec un objectif, la page vous dit chaque jour si vous êtes en avance ou en retard, et combien il faut encaisser par jour.",
        cta: { label: "Définir l'objectif", action: 'target' },
      });
      return;
    }
    const days = getDaysInMonth(now);
    const elapsed = now.getDate() - 1 + 0.5;
    const expected = target.revenue * (elapsed / days);
    const remainingDays = days - now.getDate() + 1;
    const needed = Math.max(0, target.revenue - m.revenue) / remainingDays;
    if (m.revenue >= target.revenue) {
      out.push({
        id: 'target-reached',
        severity: 'success',
        title: 'Objectif du mois atteint',
        detail: `${money(m.revenue)} encaissés pour un objectif de ${money(target.revenue)}. Bravo !`,
      });
    } else if (m.revenue < expected * 0.9) {
      out.push({
        id: 'target-behind',
        severity: 'warning',
        title: `En retard sur l'objectif : ${Math.round((m.revenue / target.revenue) * 100)} % atteint`,
        detail: `Il faudrait être à ${Math.round((elapsed / days) * 100)} % à cette date. Pour atteindre ${money(target.revenue)}, il faut encaisser ${money(needed)} par jour jusqu'à la fin du mois.`,
        cta: { label: "Voir l'objectif", action: 'target' },
      });
    } else {
      out.push({
        id: 'target-on-track',
        severity: 'success',
        title: `Objectif en bonne voie : ${Math.round((m.revenue / target.revenue) * 100)} % atteint`,
        detail: `Continuez à ${money(needed)} par jour pour atteindre ${money(target.revenue)}.`,
      });
    }
  }

  private async caisseInsights(out: Insight[], today: Date, now: Date) {
    const [unclosed, gaps] = await Promise.all([
      this.prisma.caisseSession.findMany({
        where: { closedAt: null, date: { lt: dbDay(today) } },
        orderBy: { date: 'desc' },
        take: 5,
        select: { date: true },
      }),
      this.prisma.caisseSession.findMany({
        where: { date: { gte: dbDay(startOfMonth(now)) }, difference: { not: null } },
        select: { date: true, difference: true },
      }),
    ]);
    if (unclosed.length) {
      const first = fromDbDay(unclosed[0].date);
      out.push({
        id: 'caisse-unclosed',
        severity: 'warning',
        title:
          unclosed.length > 1
            ? `${unclosed.length} caisses non clôturées`
            : `Caisse du ${format(first, 'EEEE d MMM', { locale: fr })} non clôturée`,
        detail:
          "Comptez les espèces et clôturez : vous saurez s'il manque de l'argent, et le reste part au coffre.",
        cta: {
          label: 'Clôturer',
          href: `/finance?tab=caisse&date=${localDayKey(first)}`,
        },
      });
    }
    const real = gaps.filter((g) => Math.abs(g.difference || 0) >= 1);
    if (real.length) {
      const sum = real.reduce((a, g) => a + (g.difference || 0), 0);
      out.push({
        id: 'caisse-gaps',
        severity: Math.abs(sum) >= 20 ? 'warning' : 'info',
        title: `${real.length} écart${real.length > 1 ? 's' : ''} de caisse ce mois-ci (${sum > 0 ? '+' : ''}${round1(sum)} DT)`,
        detail:
          'Un écart veut souvent dire une vente non saisie ou une erreur de monnaie. Vérifiez les jours concernés.',
        cta: { label: 'Voir la caisse', href: '/finance?tab=caisse' },
        items: real.slice(0, 5).map((g) => ({
          label: format(fromDbDay(g.date), 'EEEE d MMM', { locale: fr }),
          detail: `${(g.difference || 0) > 0 ? '+' : ''}${round1(g.difference || 0)} DT`,
        })),
      });
    }
  }

  private async stockInsight(out: Insight[]) {
    const low = await this.prisma.product.findMany({
      where: { stock: { lte: 5 } },
      orderBy: { stock: 'asc' },
      take: 8,
      select: { name: true, stock: true },
    });
    if (!low.length) return;
    const empty = low.filter((p) => p.stock <= 0).length;
    out.push({
      id: 'stock-low',
      severity: empty ? 'warning' : 'info',
      title: empty
        ? `${empty} produit${empty > 1 ? 's' : ''} en rupture`
        : `${low.length} produit${low.length > 1 ? 's' : ''} presque épuisé${low.length > 1 ? 's' : ''}`,
      detail: 'Réapprovisionnez avant de perdre des ventes.',
      cta: { label: 'Voir les produits', href: '/products' },
      items: low.map((p) => ({
        label: p.name,
        detail: p.stock <= 0 ? 'rupture' : `${p.stock} restant${p.stock > 1 ? 's' : ''}`,
      })),
    });
  }
}