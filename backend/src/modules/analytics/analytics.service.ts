import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'database/prisma.service';
import {
  addDays,
  endOfDay,
  endOfMonth,
  startOfDay,
  startOfMonth,
  subDays,
} from 'date-fns';
import { localDayKey, parseLocalDay } from '../../../common/parse-local-day';
import { levelForSessions } from '../mobile/points';
import {
  addVisitToSeries,
  emptySeries,
  peakIndex,
  round1,
  visitEnd,
} from './traffic';
import {
  abonnementPaidInRange,
  abonnementRevenueDate,
} from '../abonnement/abonnement-revenue';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private parseRange(from?: string, to?: string) {
    const end = to ? endOfDay(parseLocalDay(to)) : endOfDay(new Date());
    const start = from
      ? startOfDay(parseLocalDay(from))
      : startOfDay(subDays(end, 89));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Invalid from/to date');
    }
    if (start > end) {
      throw new BadRequestException('from must be before to');
    }
    return { start, end };
  }

  async financeMonthly(year: number) {
    const y = year || new Date().getFullYear();
    const months: Array<{
      year: number;
      month: number;
      revenueJournal: number;
      revenueAbonnements: number;
      revenueProducts: number;
      expenses: number;
      net: number;
    }> = [];

    for (let month = 1; month <= 12; month++) {
      const start = startOfMonth(new Date(y, month - 1, 1));
      const end = endOfMonth(start);

      const [journals, abonnements, dailyProducts, dailyExpenses] =
        await Promise.all([
          this.prisma.journal.findMany({
            where: { registredTime: { gte: start, lte: end }, isPayed: true },
            select: { payedAmount: true },
          }),
          this.prisma.abonnement.findMany({
            where: abonnementPaidInRange(start, end),
            select: { payedAmount: true },
          }),
          this.prisma.dailyProduct.findMany({
            where: {
              date: { gte: start, lte: end },
              status: { notIn: ['PENDING', 'CANCELLED'] },
            },
            include: { product: { select: { sellingPrice: true } } },
          }),
          this.prisma.dailyExpense.findMany({
            where: { date: { gte: start, lte: end } },
            include: { expense: { select: { amount: true } } },
          }),
        ]);

      const revenueJournal = journals.reduce(
        (a, j) => a + (j.payedAmount || 0),
        0,
      );
      const revenueAbonnements = abonnements.reduce(
        (a, x) => a + (x.payedAmount || 0),
        0,
      );
      const revenueProducts = dailyProducts.reduce(
        (a, dp) => a + (dp.product?.sellingPrice || 0) * dp.quantite,
        0,
      );
      const expenses = dailyExpenses.reduce(
        (a, de) => a + (de.expense?.amount || 0),
        0,
      );

      months.push({
        year: y,
        month,
        revenueJournal,
        revenueAbonnements,
        revenueProducts,
        expenses,
        net: revenueJournal + revenueAbonnements + revenueProducts - expenses,
      });
    }

    return { year: y, months };
  }

  async financeMonthDays(year: number, month: number) {
    const y = year || new Date().getFullYear();
    const m = month || new Date().getMonth() + 1;
    const start = startOfMonth(new Date(y, m - 1, 1));
    const end = endOfMonth(start);

    const [journals, abonnements, dailyProducts, dailyExpenses] =
      await Promise.all([
        this.prisma.journal.findMany({
          where: { registredTime: { gte: start, lte: end }, isPayed: true },
          select: { registredTime: true, payedAmount: true },
        }),
        this.prisma.abonnement.findMany({
          where: abonnementPaidInRange(start, end),
          select: { registredDate: true, paidAt: true, payedAmount: true },
        }),
        this.prisma.dailyProduct.findMany({
          where: {
            date: { gte: start, lte: end },
            status: { notIn: ['PENDING', 'CANCELLED'] },
          },
          include: { product: { select: { sellingPrice: true } } },
        }),
        this.prisma.dailyExpense.findMany({
          where: { date: { gte: start, lte: end } },
          include: { expense: { select: { amount: true } } },
        }),
      ]);

    const byDay = new Map<
      string,
      {
        date: string;
        revenueJournal: number;
        revenueAbonnements: number;
        revenueProducts: number;
        expenses: number;
        net: number;
      }
    >();

    const ensure = (d: Date) => {
      const key = localDayKey(d);
      if (!byDay.has(key)) {
        byDay.set(key, {
          date: key,
          revenueJournal: 0,
          revenueAbonnements: 0,
          revenueProducts: 0,
          expenses: 0,
          net: 0,
        });
      }
      return byDay.get(key)!;
    };

    for (const j of journals) {
      const row = ensure(j.registredTime);
      row.revenueJournal += j.payedAmount || 0;
    }
    for (const a of abonnements) {
      const row = ensure(abonnementRevenueDate(a));
      row.revenueAbonnements += a.payedAmount || 0;
    }
    for (const dp of dailyProducts) {
      const row = ensure(dp.date);
      row.revenueProducts += (dp.product?.sellingPrice || 0) * dp.quantite;
    }
    for (const de of dailyExpenses) {
      const row = ensure(de.date);
      row.expenses += de.expense?.amount || 0;
    }

    const days = [...byDay.values()]
      .map((d) => ({
        ...d,
        net:
          d.revenueJournal +
          d.revenueAbonnements +
          d.revenueProducts -
          d.expenses,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { year: y, month: m, days };
  }

  async servicesDemand(from?: string, to?: string) {
    const { start, end } = this.parseRange(from, to);

    const [journals, abonnements] = await Promise.all([
      this.prisma.journal.findMany({
        where: { registredTime: { gte: start, lte: end } },
        select: {
          priceId: true,
          serviceName: true,
          payedAmount: true,
          isPayed: true,
          memberID: true,
          prices: { select: { id: true, name: true } },
        },
      }),
      this.prisma.abonnement.findMany({
        where: { registredDate: { gte: start, lte: end } },
        select: {
          priceId: true,
          serviceName: true,
          payedAmount: true,
          isPayed: true,
          memberID: true,
          price: { select: { id: true, name: true } },
        },
      }),
    ]);

    type Acc = {
      priceId: string | null;
      name: string;
      journalCount: number;
      abonnementCount: number;
      count: number;
      revenueJournal: number;
      revenueAbonnements: number;
      revenue: number;
      uniqueMembers: Set<string>;
    };
    const map = new Map<string, Acc>();

    const keyOf = (priceId: string | null | undefined, name: string) =>
      priceId || `name:${name}`;

    for (const j of journals) {
      const name = j.serviceName || j.prices?.name || 'Service inconnu';
      const priceId = j.priceId || j.prices?.id || null;
      const key = keyOf(priceId, name);
      const row =
        map.get(key) ||
        ({
          priceId,
          name,
          journalCount: 0,
          abonnementCount: 0,
          count: 0,
          revenueJournal: 0,
          revenueAbonnements: 0,
          revenue: 0,
          uniqueMembers: new Set<string>(),
        } as Acc);
      row.journalCount += 1;
      row.count += 1;
      if (j.isPayed) {
        row.revenueJournal += j.payedAmount || 0;
        row.revenue += j.payedAmount || 0;
      }
      if (j.memberID) row.uniqueMembers.add(j.memberID);
      map.set(key, row);
    }

    for (const a of abonnements) {
      const name = a.serviceName || a.price?.name || 'Service inconnu';
      const priceId = a.priceId || a.price?.id || null;
      const key = keyOf(priceId, name);
      const row =
        map.get(key) ||
        ({
          priceId,
          name,
          journalCount: 0,
          abonnementCount: 0,
          count: 0,
          revenueJournal: 0,
          revenueAbonnements: 0,
          revenue: 0,
          uniqueMembers: new Set<string>(),
        } as Acc);
      row.abonnementCount += 1;
      row.count += 1;
      if (a.isPayed) {
        row.revenueAbonnements += a.payedAmount || 0;
        row.revenue += a.payedAmount || 0;
      }
      if (a.memberID) row.uniqueMembers.add(a.memberID);
      map.set(key, row);
    }

    const services = [...map.values()]
      .map((r) => ({
        priceId: r.priceId,
        name: r.name,
        journalCount: r.journalCount,
        abonnementCount: r.abonnementCount,
        count: r.count,
        revenueJournal: r.revenueJournal,
        revenueAbonnements: r.revenueAbonnements,
        revenue: r.revenue,
        uniqueClients: r.uniqueMembers.size,
      }))
      .sort((a, b) => b.count - a.count || b.revenue - a.revenue);

    return { from: start.toISOString(), to: end.toISOString(), services };
  }

  async serviceClients(priceId: string, from?: string, to?: string) {
    const { start, end } = this.parseRange(from, to);

    const [journals, abonnements] = await Promise.all([
      this.prisma.journal.findMany({
        where: {
          priceId,
          registredTime: { gte: start, lte: end },
          memberID: { not: null },
        },
        select: {
          memberID: true,
          payedAmount: true,
          isPayed: true,
          members: {
            select: { id: true, firstName: true, lastName: true, phone: true },
          },
        },
      }),
      this.prisma.abonnement.findMany({
        where: {
          priceId,
          registredDate: { gte: start, lte: end },
        },
        select: {
          memberID: true,
          payedAmount: true,
          isPayed: true,
          members: {
            select: { id: true, firstName: true, lastName: true, phone: true },
          },
        },
      }),
    ]);

    type Acc = {
      memberId: string;
      firstName: string | null;
      lastName: string | null;
      phone: string | null;
      journalCount: number;
      abonnementCount: number;
      count: number;
      revenue: number;
    };
    const map = new Map<string, Acc>();

    for (const j of journals) {
      if (!j.memberID || !j.members) continue;
      const row = map.get(j.memberID) || {
        memberId: j.memberID,
        firstName: j.members.firstName,
        lastName: j.members.lastName,
        phone: j.members.phone,
        journalCount: 0,
        abonnementCount: 0,
        count: 0,
        revenue: 0,
      };
      row.journalCount += 1;
      row.count += 1;
      if (j.isPayed) row.revenue += j.payedAmount || 0;
      map.set(j.memberID, row);
    }
    for (const a of abonnements) {
      const row = map.get(a.memberID) || {
        memberId: a.memberID,
        firstName: a.members.firstName,
        lastName: a.members.lastName,
        phone: a.members.phone,
        journalCount: 0,
        abonnementCount: 0,
        count: 0,
        revenue: 0,
      };
      row.abonnementCount += 1;
      row.count += 1;
      if (a.isPayed) row.revenue += a.payedAmount || 0;
      map.set(a.memberID, row);
    }

    const clients = [...map.values()].sort(
      (a, b) => b.count - a.count || b.revenue - a.revenue,
    );
    return { priceId, from: start.toISOString(), to: end.toISOString(), clients };
  }

  async spacesUsage(from?: string, to?: string) {
    const { start, end } = this.parseRange(from, to);

    const [journals, abonnements, ops] = await Promise.all([
      this.prisma.journal.findMany({
        where: {
          registredTime: { gte: start, lte: end },
          OR: [{ spaceId: { not: null } }, { spaceName: { not: null } }],
        },
        select: {
          spaceId: true,
          spaceName: true,
          memberID: true,
          registredTime: true,
          leaveTime: true,
        },
      }),
      this.prisma.abonnement.findMany({
        where: {
          registredDate: { gte: start, lte: end },
          OR: [{ spaceId: { not: null } }, { reservedSeatSpaceId: { not: null } }],
        },
        select: {
          spaceId: true,
          spaceName: true,
          reservedSeatSpaceId: true,
          memberID: true,
        },
      }),
      this.prisma.opsEvent.findMany({
        where: {
          type: { in: ['seat.assigned', 'seat.moved'] },
          occurredAt: { gte: start, lte: end },
        },
        select: { meta: true, memberId: true },
      }),
    ]);

    type Acc = {
      spaceId: string | null;
      name: string;
      visitCount: number;
      subscriptionCount: number;
      hours: number;
      uniqueMembers: Set<string>;
    };
    const map = new Map<string, Acc>();

    const touch = (
      spaceId: string | null,
      name: string,
      kind: 'visit' | 'sub',
      memberId?: string | null,
      hours = 0,
    ) => {
      const key = spaceId || `name:${name}`;
      const row =
        map.get(key) ||
        ({
          spaceId,
          name,
          visitCount: 0,
          subscriptionCount: 0,
          hours: 0,
          uniqueMembers: new Set<string>(),
        } as Acc);
      if (kind === 'visit') row.visitCount += 1;
      else row.subscriptionCount += 1;
      row.hours += hours;
      if (memberId) row.uniqueMembers.add(memberId);
      map.set(key, row);
    };

    for (const j of journals) {
      const name = j.spaceName || 'Espace inconnu';
      let hours = 0;
      if (j.leaveTime) {
        hours = Math.max(
          0,
          (j.leaveTime.getTime() - j.registredTime.getTime()) / 3_600_000,
        );
      }
      touch(j.spaceId, name, 'visit', j.memberID, hours);
    }

    for (const a of abonnements) {
      const spaceId = a.spaceId || a.reservedSeatSpaceId || null;
      const name = a.spaceName || 'Espace inconnu';
      touch(spaceId, name, 'sub', a.memberID, 0);
    }

    // Fallback: ops events for journals without space snapshot
    for (const ev of ops) {
      const meta = (ev.meta || {}) as {
        spaceId?: string;
        spaceName?: string;
      };
      if (!meta.spaceId && !meta.spaceName) continue;
      const key = meta.spaceId || `name:${meta.spaceName}`;
      if (map.has(key)) continue;
      touch(
        meta.spaceId || null,
        meta.spaceName || 'Espace inconnu',
        'visit',
        ev.memberId,
        0,
      );
    }

    // Resolve missing names from Space table
    const missingIds = [...map.values()]
      .filter((r) => r.spaceId && (!r.name || r.name === 'Espace inconnu'))
      .map((r) => r.spaceId!) ;
    if (missingIds.length) {
      const spaces = await this.prisma.space.findMany({
        where: { id: { in: [...new Set(missingIds)] } },
        select: { id: true, name: true },
      });
      const names = new Map(spaces.map((s) => [s.id, s.name]));
      for (const row of map.values()) {
        if (row.spaceId && names.has(row.spaceId)) {
          row.name = names.get(row.spaceId)!;
        }
      }
    }

    const spaces = [...map.values()]
      .map((r) => ({
        spaceId: r.spaceId,
        name: r.name,
        visitCount: r.visitCount,
        subscriptionCount: r.subscriptionCount,
        count: r.visitCount + r.subscriptionCount,
        hours: Math.round(r.hours * 10) / 10,
        uniqueClients: r.uniqueMembers.size,
      }))
      .sort((a, b) => b.count - a.count || b.hours - a.hours);

    return { from: start.toISOString(), to: end.toISOString(), spaces };
  }

  async spaceClients(spaceId: string, from?: string, to?: string) {
    const { start, end } = this.parseRange(from, to);

    const journals = await this.prisma.journal.findMany({
      where: {
        spaceId,
        registredTime: { gte: start, lte: end },
        memberID: { not: null },
      },
      select: {
        memberID: true,
        registredTime: true,
        leaveTime: true,
        members: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
      },
    });

    type Acc = {
      memberId: string;
      firstName: string | null;
      lastName: string | null;
      phone: string | null;
      visitCount: number;
      hours: number;
    };
    const map = new Map<string, Acc>();

    for (const j of journals) {
      if (!j.memberID || !j.members) continue;
      const row = map.get(j.memberID) || {
        memberId: j.memberID,
        firstName: j.members.firstName,
        lastName: j.members.lastName,
        phone: j.members.phone,
        visitCount: 0,
        hours: 0,
      };
      row.visitCount += 1;
      if (j.leaveTime) {
        row.hours += Math.max(
          0,
          (j.leaveTime.getTime() - j.registredTime.getTime()) / 3_600_000,
        );
      }
      map.set(j.memberID, row);
    }

    const clients = [...map.values()]
      .map((c) => ({ ...c, hours: Math.round(c.hours * 10) / 10 }))
      .sort((a, b) => b.visitCount - a.visitCount || b.hours - a.hours);

    return { spaceId, from: start.toISOString(), to: end.toISOString(), clients };
  }

  /**
   * Members whose top service / top space matches the filter
   * (most used in the date range).
   */
  async membersByTop(opts: {
    topServiceId?: string;
    topSpaceId?: string;
    from?: string;
    to?: string;
  }) {
    const { start, end } = this.parseRange(opts.from, opts.to);
    if (!opts.topServiceId && !opts.topSpaceId) {
      throw new BadRequestException('topServiceId or topSpaceId required');
    }

    if (opts.topServiceId) {
      const journals = await this.prisma.journal.findMany({
        where: {
          registredTime: { gte: start, lte: end },
          memberID: { not: null },
          priceId: { not: null },
        },
        select: { memberID: true, priceId: true },
      });
      const abonnements = await this.prisma.abonnement.findMany({
        where: { registredDate: { gte: start, lte: end } },
        select: { memberID: true, priceId: true },
      });

      const byMember = new Map<string, Map<string, number>>();
      const bump = (memberId: string, priceId: string) => {
        if (!byMember.has(memberId)) byMember.set(memberId, new Map());
        const m = byMember.get(memberId)!;
        m.set(priceId, (m.get(priceId) || 0) + 1);
      };
      for (const j of journals) {
        if (j.memberID && j.priceId) bump(j.memberID, j.priceId);
      }
      for (const a of abonnements) bump(a.memberID, a.priceId);

      const memberIds: string[] = [];
      for (const [memberId, counts] of byMember) {
        let bestId = '';
        let best = -1;
        for (const [pid, n] of counts) {
          if (n > best) {
            best = n;
            bestId = pid;
          }
        }
        if (bestId === opts.topServiceId) memberIds.push(memberId);
      }
      return {
        topServiceId: opts.topServiceId,
        from: start.toISOString(),
        to: end.toISOString(),
        memberIds,
      };
    }

    // topSpaceId
    const journals = await this.prisma.journal.findMany({
      where: {
        registredTime: { gte: start, lte: end },
        memberID: { not: null },
        spaceId: { not: null },
      },
      select: { memberID: true, spaceId: true },
    });
    const byMember = new Map<string, Map<string, number>>();
    for (const j of journals) {
      if (!j.memberID || !j.spaceId) continue;
      if (!byMember.has(j.memberID)) byMember.set(j.memberID, new Map());
      const m = byMember.get(j.memberID)!;
      m.set(j.spaceId, (m.get(j.spaceId) || 0) + 1);
    }
    const memberIds: string[] = [];
    for (const [memberId, counts] of byMember) {
      let bestId = '';
      let best = -1;
      for (const [sid, n] of counts) {
        if (n > best) {
          best = n;
          bestId = sid;
        }
      }
      if (bestId === opts.topSpaceId) memberIds.push(memberId);
    }
    return {
      topSpaceId: opts.topSpaceId,
      from: start.toISOString(),
      to: end.toISOString(),
      memberIds,
    };
  }

  /** Visits of an organization (anonymous walk-ins matched through the price org). */
  private journalOrgWhere(organizationId?: string): Prisma.JournalWhereInput {
    if (!organizationId) return {};
    return {
      OR: [
        { members: { organizationId } },
        {
          AND: [
            { OR: [{ isAnonymous: true }, { memberID: null }] },
            {
              OR: [
                { prices: { organizationId } },
                { prices: { organizationId: null } },
              ],
            },
          ],
        },
      ],
    };
  }

  /** Members who come most regularly: ranked by distinct visit days. */
  async attendanceRegulars(opts: {
    from?: string;
    to?: string;
    limit?: number;
    organizationId?: string;
  }) {
    const { start, end } = this.parseRange(opts.from, opts.to);
    const limit = Math.min(100, Math.max(1, opts.limit || 10));
    const now = new Date();
    const journals = await this.prisma.journal.findMany({
      where: {
        registredTime: { gte: start, lte: end },
        isReservation: false,
        isAnonymous: false,
        memberID: { not: null },
        ...(opts.organizationId
          ? { members: { organizationId: opts.organizationId } }
          : {}),
      },
      select: { memberID: true, registredTime: true, leaveTime: true },
    });

    const byMember = new Map<
      string,
      {
        days: Set<string>;
        visits: number;
        hours: number;
        arrivalHourSum: number;
        lastVisit: Date;
        weekdays: number[];
      }
    >();
    for (const j of journals) {
      if (!j.memberID) continue;
      let m = byMember.get(j.memberID);
      if (!m) {
        m = {
          days: new Set(),
          visits: 0,
          hours: 0,
          arrivalHourSum: 0,
          lastVisit: j.registredTime,
          weekdays: Array(7).fill(0),
        };
        byMember.set(j.memberID, m);
      }
      const key = localDayKey(j.registredTime);
      if (!m.days.has(key)) {
        m.days.add(key);
        m.weekdays[j.registredTime.getDay()] += 1;
      }
      m.visits += 1;
      m.hours +=
        Math.max(0, visitEnd(j, now).getTime() - j.registredTime.getTime()) /
        3_600_000;
      m.arrivalHourSum +=
        j.registredTime.getHours() + j.registredTime.getMinutes() / 60;
      if (j.registredTime > m.lastVisit) m.lastVisit = j.registredTime;
    }

    const ranked = [...byMember.entries()]
      .map(([memberId, m]) => ({ memberId, ...m, visitDays: m.days.size }))
      .sort(
        (a, b) =>
          b.visitDays - a.visitDays || b.visits - a.visits || b.hours - a.hours,
      )
      .slice(0, limit);

    const members = await this.prisma.member.findMany({
      where: { id: { in: ranked.map((r) => r.memberId) } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        visitorNumber: true,
        phone: true,
        avatarUrl: true,
        points: true,
      },
    });
    const memberById = new Map(members.map((m) => [m.id, m]));
    const weeks = Math.max(
      1,
      (end.getTime() - start.getTime()) / (7 * 86_400_000),
    );

    return {
      from: start.toISOString(),
      to: end.toISOString(),
      regulars: ranked.map((r) => ({
        member: memberById.get(r.memberId) ?? { id: r.memberId },
        visitDays: r.visitDays,
        visits: r.visits,
        totalHours: round1(r.hours),
        daysPerWeek: round1(r.visitDays / weeks),
        avgArrivalHour: round1(r.arrivalHourSum / Math.max(1, r.visits)),
        lastVisit: r.lastVisit.toISOString(),
        usualWeekdays: r.weekdays
          .map((count, weekday) => ({ weekday, count }))
          .filter((w) => w.count > 0)
          .sort((a, b) => b.count - a.count)
          .slice(0, 3)
          .map((w) => w.weekday),
      })),
    };
  }

  /** Members with the most loyalty points. */
  async topPoints(opts: { limit?: number; organizationId?: string }) {
    const limit = Math.min(100, Math.max(1, opts.limit || 10));
    const members = await this.prisma.member.findMany({
      where: {
        points: { gt: 0 },
        deletedAt: null,
        ...(opts.organizationId
          ? { organizationId: opts.organizationId }
          : {}),
      },
      orderBy: [{ points: 'desc' }, { createdAt: 'asc' }],
      take: limit,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        visitorNumber: true,
        phone: true,
        avatarUrl: true,
        points: true,
      },
    });
    const sessions = members.length
      ? await this.prisma.journal.groupBy({
          by: ['memberID'],
          where: {
            memberID: { in: members.map((m) => m.id) },
            isReservation: false,
          },
          _count: { _all: true },
        })
      : [];
    const sessionsBy = new Map(
      sessions.map((s) => [s.memberID as string, s._count._all]),
    );
    return {
      members: members.map((m) => {
        const count = sessionsBy.get(m.id) ?? 0;
        return { ...m, sessions: count, level: levelForSessions(count) };
      }),
    };
  }

  /** Average arrivals / presence per weekday and hour over a range (default 8 weeks). */
  async trafficWeekly(opts: {
    from?: string;
    to?: string;
    organizationId?: string;
  }) {
    const { start, end } = this.parseRange(
      opts.from ?? localDayKey(subDays(new Date(), 55)),
      opts.to,
    );
    const now = new Date();
    const journals = await this.prisma.journal.findMany({
      where: {
        registredTime: { gte: start, lte: end },
        isReservation: false,
        ...this.journalOrgWhere(opts.organizationId),
      },
      select: { registredTime: true, leaveTime: true },
    });

    const occurrences = Array(7).fill(0);
    for (let d = startOfDay(start); d <= end; d = addDays(d, 1)) {
      occurrences[d.getDay()] += 1;
    }
    const series = Array.from({ length: 7 }, () => emptySeries());
    for (const j of journals) {
      addVisitToSeries(series[j.registredTime.getDay()], j, now);
    }

    const days = series.map((s, weekday) => {
      const n = Math.max(1, occurrences[weekday]);
      const hours = s.arrivals.map((a, hour) => ({
        hour,
        avgArrivals: round1(a / n),
        avgPresent: round1(s.present[hour] / n),
      }));
      const peakHour = peakIndex(s.arrivals);
      const peakPresentHour = peakIndex(s.present);
      return {
        weekday,
        occurrences: occurrences[weekday],
        avgVisits: round1(s.arrivals.reduce((a, b) => a + b, 0) / n),
        peakHour,
        peakArrivals: round1(s.arrivals[peakHour] / n),
        peakPresentHour,
        peakPresent: round1(s.present[peakPresentHour] / n),
        hours,
      };
    });

    return { from: start.toISOString(), to: end.toISOString(), days };
  }

  /** One day vs previous same weekdays (or previous days): hourly series + totals. */
  async trafficDay(opts: {
    date?: string;
    compare?: 'weekday' | 'previous';
    count?: number;
    organizationId?: string;
  }) {
    const target = parseLocalDay(opts.date);
    const compare = opts.compare === 'previous' ? 'previous' : 'weekday';
    const count = Math.min(12, Math.max(1, opts.count || 4));
    const comparisonDays = Array.from({ length: count }, (_, i) =>
      subDays(target, compare === 'weekday' ? 7 * (i + 1) : i + 1),
    );
    const allDays = [target, ...comparisonDays];
    const rangeStart = startOfDay(allDays[allDays.length - 1]);
    const rangeEnd = endOfDay(target);
    const now = new Date();

    const journals = await this.prisma.journal.findMany({
      where: {
        registredTime: { gte: rangeStart, lte: rangeEnd },
        isReservation: false,
        ...this.journalOrgWhere(opts.organizationId),
      },
      select: {
        memberID: true,
        guestName: true,
        id: true,
        registredTime: true,
        leaveTime: true,
        isPayed: true,
        payedAmount: true,
      },
    });

    const abonnements = await this.prisma.abonnement.findMany({
      where: {
        AND: [
          abonnementPaidInRange(rangeStart, rangeEnd),
          opts.organizationId
            ? { members: { organizationId: opts.organizationId } }
            : {},
        ],
      },
      select: { paidAt: true, registredDate: true, payedAmount: true },
    });

    const wanted = new Set(allDays.map(localDayKey));
    const aboByDay = new Map<string, { revenue: number; count: number }>();
    for (const a of abonnements) {
      const key = localDayKey(abonnementRevenueDate(a));
      if (!wanted.has(key)) continue;
      const row = aboByDay.get(key) ?? { revenue: 0, count: 0 };
      row.revenue += a.payedAmount || 0;
      row.count += 1;
      aboByDay.set(key, row);
    }
    const buckets = new Map<string, typeof journals>();
    for (const j of journals) {
      const key = localDayKey(j.registredTime);
      if (!wanted.has(key)) continue;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(j);
    }

    const summarize = (day: Date) => {
      const key = localDayKey(day);
      const list = buckets.get(key) ?? [];
      const series = emptySeries();
      const people = new Set<string>();
      let revenue = 0;
      let durationMs = 0;
      let closed = 0;
      let leftUnpaid = 0;
      for (const j of list) {
        addVisitToSeries(series, j, now);
        people.add(
          j.memberID
            ? `m:${j.memberID}`
            : j.guestName?.trim()
              ? `g:${j.guestName.trim().toLowerCase()}`
              : `v:${j.id}`,
        );
        if (j.isPayed) revenue += j.payedAmount || 0;
        if (j.leaveTime) {
          closed += 1;
          durationMs += j.leaveTime.getTime() - j.registredTime.getTime();
          if (!j.isPayed && (j.payedAmount || 0) > 0) leftUnpaid += 1;
        }
      }
      const peakHour = peakIndex(series.present);
      const abo = aboByDay.get(key) ?? { revenue: 0, count: 0 };
      const round2 = (v: number) => Math.round(v * 100) / 100;
      return {
        date: key,
        weekday: day.getDay(),
        arrivals: series.arrivals,
        present: series.present,
        totals: {
          visits: list.length,
          uniqueVisitors: people.size,
          revenueVisits: round2(revenue),
          revenueAbonnements: round2(abo.revenue),
          abonnementsPaid: abo.count,
          revenue: round2(revenue + abo.revenue),
          avgDurationMin: closed ? Math.round(durationMs / closed / 60_000) : 0,
          leftUnpaid,
          peakHour,
          peakPresent: series.present[peakHour],
        },
      };
    };

    const targetDay = summarize(target);
    const comparisons = comparisonDays.map(summarize);
    const n = Math.max(1, comparisons.length);
    const avgArr = (pick: (d: typeof targetDay) => number[]) =>
      Array.from({ length: 24 }, (_, h) =>
        round1(comparisons.reduce((s, d) => s + pick(d)[h], 0) / n),
      );
    const avgTotal = (pick: (d: typeof targetDay) => number) =>
      round1(comparisons.reduce((s, d) => s + pick(d), 0) / n);

    return {
      date: targetDay.date,
      compare,
      count,
      target: targetDay,
      comparisons,
      average: {
        arrivals: avgArr((d) => d.arrivals),
        present: avgArr((d) => d.present),
        totals: {
          visits: avgTotal((d) => d.totals.visits),
          uniqueVisitors: avgTotal((d) => d.totals.uniqueVisitors),
          revenueVisits: avgTotal((d) => d.totals.revenueVisits),
          revenueAbonnements: avgTotal((d) => d.totals.revenueAbonnements),
          abonnementsPaid: avgTotal((d) => d.totals.abonnementsPaid),
          revenue: avgTotal((d) => d.totals.revenue),
          avgDurationMin: avgTotal((d) => d.totals.avgDurationMin),
          leftUnpaid: avgTotal((d) => d.totals.leftUnpaid),
          peakPresent: avgTotal((d) => d.totals.peakPresent),
        },
      },
    };
  }
}
