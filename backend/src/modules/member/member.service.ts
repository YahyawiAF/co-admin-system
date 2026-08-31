import {
  Injectable,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AddMemberDto } from './dtos/createMember.dto';
import { UpdateMemberDto } from './dtos/updateMember.dto';
import {
  Prisma,
  Member,
  ProductOrderStatus,
  Subscription,
  LedgerKind,
} from '@prisma/client';
import { PaginatedResult } from 'common/dtos/PaginatedOutputDto';
import { createPaginator } from 'prisma-pagination';
import { ErrorCode, GeneralException } from '@/exceptions';
import { MemberEntity } from './entities/member.entity';
import { startOfWeek, addWeeks, format, getHours, getDay, isSameDay } from 'date-fns';

@Injectable()
export class MemberService {
  constructor(private readonly prisma: PrismaService) {}

  private async nextVisitorNumber(organizationId: string): Promise<number> {
    const last = await this.prisma.member.findFirst({
      where: { organizationId, visitorNumber: { not: null } },
      orderBy: { visitorNumber: 'desc' },
      select: { visitorNumber: true },
    });
    return (last?.visitorNumber || 0) + 1;
  }

  private async assertCanJoinGroup(groupId: string, excludeMemberId?: string) {
    const group = await this.prisma.memberGroup.findUnique({
      where: { id: groupId },
      include: { _count: { select: { members: true } } },
    });
    if (!group) throw new BadRequestException('Groupe introuvable');
    let count = group._count.members;
    if (excludeMemberId) {
      const current = await this.prisma.member.findUnique({
        where: { id: excludeMemberId },
        select: { groupId: true },
      });
      if (current?.groupId === groupId) return;
    }
    if (count >= group.maxMembers) {
      throw new BadRequestException(
        `Groupe plein (${group.maxMembers} membres max)`,
      );
    }
  }

  /**
   * Create a new member.
   * @param addMemberDto - Data to create a member.
   * @returns The created member.
   */
  async create(addMemberDto: AddMemberDto): Promise<MemberEntity> {
    try {
      if (addMemberDto.groupId) {
        await this.assertCanJoinGroup(addMemberDto.groupId);
      }
      let organizationId = (addMemberDto as { organizationId?: string })
        .organizationId;
      if (!organizationId) {
        const org = await this.prisma.organization.findFirst({
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
        if (!org) {
          throw new BadRequestException('Aucune organisation configurée');
        }
        organizationId = org.id;
      }
      const visitorNumber = await this.nextVisitorNumber(organizationId);
      const member = await this.prisma.member.create({
        data: {
          ...addMemberDto,
          organizationId,
          isActive: true,
          showInDirectory: true,
          plan: addMemberDto.plan || Subscription.Journal,
          visitorNumber,
        },
        include: { group: true },
      });
      return new MemberEntity(member);
    } catch (error) {
      throw new GeneralException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.ALREADY_EXIST,
        `Failed to create member: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Fetch all members.
   * @returns List of members.
   */
  async findAll(organizationId?: string): Promise<MemberEntity[]> {
    const members = await this.prisma.member.findMany({
      where: organizationId ? { organizationId } : undefined,
      include: { group: true },
      orderBy: { createdAt: 'desc' },
    });
    return members.map((member) => new MemberEntity(member));
  }

  /**
   * Paginated fetch of members.
   * @param where - Filter criteria.
   * @param orderBy - Sort order.
   * @param page - Page number.
   * @param perPage - Items per page.
   * @returns Paginated result of members.
   */
  async findMany({
    where,
    orderBy = { id: 'desc' },
    page = 1,
    perPage = 20,
  }: {
    where?: Prisma.MemberWhereInput;
    orderBy?: Prisma.MemberOrderByWithRelationInput;
    page?: number;
    perPage?: number;
  }): Promise<PaginatedResult<MemberEntity>> {
    const paginate = createPaginator({ perPage });
    const paginatedResult = await paginate(
      this.prisma.member,
      {
        where,
        orderBy,
        include: { group: true },
      },
      { page },
    );
    return {
      data: paginatedResult.data.map((member) => new MemberEntity(member)),
      meta: paginatedResult.meta,
    };
  }

  /**
   * Find a specific member by ID.
   * @param id - Member ID.
   * @returns The found member or null.
   */
  async findOne(id: string): Promise<MemberEntity | null> {
    try {
      const member = await this.prisma.member.findUnique({
        where: { id },
        include: { group: true },
      });
      return new MemberEntity(member);
    } catch (error) {
      throw new GeneralException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        `Member with ID ${id} not found.`,
      );
    }
  }

  async insights(id: string) {
    const member = await this.prisma.member.findUnique({ where: { id } });
    if (!member) throw new NotFoundException('Membre introuvable');

    const [journals, orders, abos, seatEvents] = await Promise.all([
      this.prisma.journal.findMany({
        where: { memberID: id, isReservation: false },
        include: { prices: true },
        orderBy: { registredTime: 'desc' },
      }),
      this.prisma.dailyProduct.findMany({
        where: {
          OR: [{ memberId: id }, { externalRef: id }],
          status: { not: ProductOrderStatus.CANCELLED },
        },
        include: { product: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.abonnement.findMany({
        where: { memberID: id },
        include: { price: true },
        orderBy: { registredDate: 'desc' },
      }),
      this.prisma.opsEvent.findMany({
        where: {
          memberId: id,
          type: {
            in: [
              'seat.assigned',
              'seat.claimed',
              'seat_claimed',
              'seat.moved',
              'seat_moved',
              'seat.released',
            ],
          },
        },
        orderBy: { occurredAt: 'asc' },
        take: 500,
      }),
    ]);

    const weekdayNames = [
      'Dimanche',
      'Lundi',
      'Mardi',
      'Mercredi',
      'Jeudi',
      'Vendredi',
      'Samedi',
    ];
    const dayCounts = Array.from({ length: 7 }, () => 0);
    const hourCounts = Array.from({ length: 24 }, () => 0);
    const durations: number[] = [];
    let visitHours = 0;
    let spendVisits = 0;

    for (const j of journals) {
      const start = new Date(j.registredTime);
      dayCounts[getDay(start)] += 1;
      hourCounts[getHours(start)] += 1;
      spendVisits += j.payedAmount || 0;
      const end = j.leaveTime
        ? new Date(j.leaveTime)
        : j.prices?.durationHours
        ? new Date(start.getTime() + j.prices.durationHours * 3600_000)
        : null;
      if (end && end > start) {
        const mins = (end.getTime() - start.getTime()) / 60_000;
        durations.push(mins);
        visitHours += mins / 60;
      }
    }

    const spendCafe = orders.reduce(
      (s, o) => s + (o.product?.sellingPrice || 0) * o.quantite,
      0,
    );
    const spendSubs = abos.reduce((s, a) => s + (a.payedAmount || 0), 0);

    const countMode = (arr: (string | null | undefined)[]) => {
      const map = new Map<string, number>();
      for (const v of arr) {
        if (!v) continue;
        map.set(v, (map.get(v) || 0) + 1);
      }
      let best: string | null = null;
      let n = 0;
      for (const [k, c] of map) {
        if (c > n) {
          best = k;
          n = c;
        }
      }
      return best;
    };

    const typicalDays = dayCounts
      .map((count, weekday) => ({
        weekday,
        label: weekdayNames[weekday],
        count,
      }))
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count);

    let typicalArrivalHour: number | null = null;
    let maxH = 0;
    hourCounts.forEach((c, h) => {
      if (c > maxH) {
        maxH = c;
        typicalArrivalHour = h;
      }
    });

    const typicalDurationMin =
      durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : null;

    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekly = Array.from({ length: 8 }, (_, i) => {
      const start = addWeeks(weekStart, -i);
      const end = addWeeks(start, 1);
      const weekJ = journals.filter((j) => {
        const t = new Date(j.registredTime);
        return t >= start && t < end;
      });
      const weekO = orders.filter((o) => {
        const t = new Date(o.createdAt);
        return t >= start && t < end;
      });
      const hours = weekJ.reduce((s, j) => {
        const a = new Date(j.registredTime);
        const b = j.leaveTime ? new Date(j.leaveTime) : null;
        if (!b || b <= a) return s;
        return s + (b.getTime() - a.getTime()) / 3600_000;
      }, 0);
      const spend =
        weekJ.reduce((s, j) => s + (j.payedAmount || 0), 0) +
        weekO.reduce(
          (s, o) => s + (o.product?.sellingPrice || 0) * o.quantite,
          0,
        );
      return {
        weekStart: start.toISOString(),
        label: format(start, 'dd/MM'),
        visits: weekJ.length,
        hours: Math.round(hours * 10) / 10,
        spend: Math.round(spend * 10) / 10,
      };
    }).reverse();

    const seatLabelOf = (e: (typeof seatEvents)[number]) => {
      const meta = (e.meta || {}) as Record<string, unknown>;
      return (
        e.seatId ||
        (typeof meta.toSeat === 'string' ? meta.toSeat : null) ||
        null
      );
    };
    const spaceNameOf = (e: (typeof seatEvents)[number]) => {
      const meta = (e.meta || {}) as Record<string, unknown>;
      return typeof meta.spaceName === 'string' ? meta.spaceName : null;
    };
    const seatsForVisit = (j: (typeof journals)[number]) => {
      const start = new Date(j.registredTime).getTime() - 2 * 60_000;
      const end =
        (j.leaveTime ? new Date(j.leaveTime).getTime() : Date.now()) +
        2 * 60_000;
      const dayEvents = seatEvents.filter((e) => {
        if (e.journalId && e.journalId === j.id) return true;
        const t = e.occurredAt.getTime();
        return t >= start && t <= end;
      });
      const path: {
        label: string;
        spaceName: string | null;
        at: string;
        kind: string;
      }[] = [];
      for (const e of dayEvents) {
        const label = seatLabelOf(e);
        if (!label) continue;
        if (path[path.length - 1]?.label === label) continue;
        path.push({
          label,
          spaceName: spaceNameOf(e),
          at: e.occurredAt.toISOString(),
          kind: e.type,
        });
      }
      const changes = dayEvents
        .filter((e) => e.type === 'seat.moved' || e.type === 'seat_moved')
        .map((e) => {
          const meta = (e.meta || {}) as Record<string, unknown>;
          return {
            from:
              (typeof meta.fromSeat === 'string' && meta.fromSeat) || null,
            to: seatLabelOf(e),
            at: e.occurredAt.toISOString(),
            spaceName: spaceNameOf(e),
          };
        });
      return {
        seats: path.map((p) => p.label),
        lastSeat: path[path.length - 1]?.label || null,
        lastSpace: path[path.length - 1]?.spaceName || null,
        changes,
      };
    };

    return {
      member: {
        ...new MemberEntity(member),
        hasPin: !!member.pinHash,
        passwordHash: undefined,
        pinHash: undefined,
      },
      totals: {
        visits: journals.length,
        hours: Math.round(visitHours * 10) / 10,
        spendVisits: Math.round(spendVisits * 10) / 10,
        spendCafe: Math.round(spendCafe * 10) / 10,
        spendSubscriptions: Math.round(spendSubs * 10) / 10,
        spendTotal: Math.round((spendVisits + spendCafe + spendSubs) * 10) / 10,
      },
      routine: {
        typicalDays,
        typicalArrivalHour,
        typicalDurationMin,
        favoriteSeat: countMode(
          seatEvents.map((e) => seatLabelOf(e)).filter(Boolean) as string[],
        ),
        favoriteProduct: countMode(orders.map((o) => o.product?.name)),
        favoriteForfait: countMode(journals.map((j) => j.prices?.name)),
      },
      weekly,
      recentVisits: journals.slice(0, 30).map((j) => {
        const seat = seatsForVisit(j);
        return {
          id: j.id,
          registredTime: j.registredTime,
          leaveTime: j.leaveTime,
          payedAmount: j.payedAmount,
          isPayed: j.isPayed,
          forfait: j.prices?.name || null,
          seats: seat.seats,
          lastSeat: seat.lastSeat,
          lastSpace: seat.lastSpace,
          seatChanges: seat.changes,
        };
      }),
      recentOrders: orders.slice(0, 20).map((o) => ({
        id: o.id,
        createdAt: o.createdAt,
        productName: o.product?.name || 'Produit',
        quantity: o.quantite,
        amount: (o.product?.sellingPrice || 0) * o.quantite,
        isPayed: o.isPayed,
      })),
      subscriptions: abos.map((a) => ({
        id: a.id,
        name: a.price?.name || 'Abonnement',
        registredDate: a.registredDate,
        leaveDate: a.leaveDate,
        payedAmount: a.payedAmount,
        isPayed: a.isPayed,
      })),
    };
  }

  /**
   * Search members by criteria.
   * @param criteria - Search criteria (e.g., createdAt, isActive).
   * @returns List of members matching the criteria.
   */
  async findByCriteria(criteria: Prisma.MemberWhereInput): Promise<Member[]> {
    return this.prisma.member.findMany({ where: criteria });
  }

  /**
   * Update a member's information.
   * @param id - Member ID.
   * @param updateMemberDto - Data to update the member.
   * @returns The updated member.
   */
  async update(
    id: string,
    updateMemberDto: UpdateMemberDto,
  ): Promise<MemberEntity> {
    try {
      if (updateMemberDto.groupId) {
        await this.assertCanJoinGroup(updateMemberDto.groupId, id);
      }
      const member = await this.prisma.member.update({
        where: { id },
        data: updateMemberDto,
        include: { group: true },
      });
      return new MemberEntity(member);
    } catch (error) {
      throw new GeneralException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.UPDATE_FAILED,
        `Failed to update member: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Delete a member by ID.
   * @param id - Member ID.
   * @returns The deleted member.
   */
  async remove(id: string): Promise<MemberEntity> {
    try {
      const member = await this.prisma.member.delete({
        where: { id },
      });
      return new MemberEntity(member);
    } catch (error) {
      throw new GeneralException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_EXIST,
        `Failed to delete member with ID ${id}: ${(error as Error).message}`,
      );
    }
  }

  async listLedger(memberId: string) {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
    });
    if (!member) throw new NotFoundException('Membre introuvable');

    const [rows, journals, abos] = await Promise.all([
      this.prisma.memberLedger.findMany({
        where: { memberId },
        orderBy: { createdAt: 'desc' },
        take: 80,
      }),
      this.prisma.journal.findMany({
        where: { memberID: memberId, isReservation: false },
        include: { prices: true },
        orderBy: { registredTime: 'desc' },
        take: 40,
      }),
      this.prisma.abonnement.findMany({
        where: { memberID: memberId, isPayed: false },
        include: { price: true },
        orderBy: { registredDate: 'desc' },
        take: 20,
      }),
    ]);

    const visitOf = (j: (typeof journals)[number]) => ({
      id: j.id,
      forfait: j.prices?.name || null,
      amount: Number(j.prices?.price ?? j.payedAmount ?? 0),
      isPayed: j.isPayed,
      isOpen: !j.leaveTime,
      registredTime: j.registredTime.toISOString(),
      leaveTime: j.leaveTime ? j.leaveTime.toISOString() : null,
    });

    const today = journals.find((j) =>
      isSameDay(j.registredTime, new Date()),
    );
    const unpaidVisits = journals
      .filter((j) => !j.isPayed && j.id !== today?.id)
      .map(visitOf);

    const journalById = new Map(journals.map((j) => [j.id, j]));
    const entries = rows.map((r) => {
      const j = r.journalId ? journalById.get(r.journalId) : undefined;
      return {
        ...r,
        forfaitName: j?.prices?.name || null,
        visitDate: j?.registredTime?.toISOString() || null,
        visitIsPayed: j?.isPayed ?? null,
      };
    });

    const open = rows.filter((r) => !r.settled);
    const ledgerCredit = open
      .filter((r) => r.kind === LedgerKind.CREDIT)
      .reduce((s, r) => s + r.amount, 0);
    const ledgerAvoir = open
      .filter((r) => r.kind === LedgerKind.ECHEANCE)
      .reduce((s, r) => s + r.amount, 0);
    const linkedJournalIds = new Set(
      open.filter((r) => r.journalId).map((r) => r.journalId as string),
    );
    const unpaidVisitSum = journals
      .filter((j) => !j.isPayed && !linkedJournalIds.has(j.id))
      .reduce((s, j) => s + Number(j.prices?.price ?? j.payedAmount ?? 0), 0);
    const unpaidAboSum = abos.reduce(
      (s, a) => s + Number(a.price?.price ?? a.payedAmount ?? 0),
      0,
    );
    const owedByMember = ledgerCredit + unpaidVisitSum + unpaidAboSum;
    const owedToMember = ledgerAvoir;

    return {
      entries,
      owedByMember,
      owedToMember,
      net: owedByMember - owedToMember,
      todayVisit: today ? visitOf(today) : null,
      unpaidVisits,
      unpaidAbos: abos.map((a) => ({
        id: a.id,
        name: a.price?.name || 'Abonnement',
        amount: Number(a.price?.price ?? a.payedAmount ?? 0),
        registredDate: a.registredDate.toISOString(),
      })),
    };
  }

  async addLedger(dto: {
    memberId: string;
    kind: LedgerKind | 'CREDIT' | 'ECHEANCE';
    amount: number;
    note?: string;
    dueDate?: string | Date | null;
    source?: string;
    journalId?: string;
    abonnementId?: string;
  }) {
    const member = await this.prisma.member.findUnique({
      where: { id: dto.memberId },
    });
    if (!member) throw new NotFoundException('Membre introuvable');
    const amount = Number(dto.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Montant invalide');
    }
    const kind =
      String(dto.kind) === 'ECHEANCE'
        ? LedgerKind.ECHEANCE
        : LedgerKind.CREDIT;
    const created = await this.prisma.memberLedger.create({
      data: {
        memberId: dto.memberId,
        kind,
        amount,
        note: (dto.note || '').trim() || null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        source: dto.source || 'member',
        journalId: dto.journalId || null,
        abonnementId: dto.abonnementId || null,
      },
    });
    return created;
  }

  async settleLedger(id: string, settled = true) {
    const row = await this.prisma.memberLedger.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Écriture introuvable');
    return this.prisma.memberLedger.update({
      where: { id },
      data: { settled },
    });
  }

  async listDebtors(organizationId?: string, includeSettled = false) {
    const memberWhere = organizationId ? { organizationId } : undefined;
    const [journals, abos, ledgers] = await Promise.all([
      this.prisma.journal.findMany({
        where: {
          isPayed: false,
          memberID: { not: null },
          ...(memberWhere ? { members: memberWhere } : {}),
        },
        include: {
          members: { select: { id: true, firstName: true, lastName: true, visitorNumber: true } },
          prices: { select: { name: true, price: true } },
        },
        orderBy: { registredTime: 'desc' },
        take: 400,
      }),
      this.prisma.abonnement.findMany({
        where: {
          isPayed: false,
          ...(memberWhere ? { members: memberWhere } : {}),
        },
        include: {
          members: { select: { id: true, firstName: true, lastName: true, visitorNumber: true } },
          price: { select: { name: true, price: true } },
        },
        orderBy: { registredDate: 'desc' },
        take: 400,
      }),
      this.prisma.memberLedger.findMany({
        where: {
          kind: LedgerKind.CREDIT,
          ...(includeSettled ? {} : { settled: false }),
          ...(memberWhere ? { member: memberWhere } : {}),
        },
        include: {
          member: { select: { id: true, firstName: true, lastName: true, visitorNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 400,
      }),
    ]);

    const byMember = new Map<
      string,
      {
        memberId: string;
        firstName: string;
        lastName: string | null;
        visitorNumber: number | null;
        owedFromVisits: number;
        owedFromAbos: number;
        owedFromLedger: number;
        lastUnpaidAt: Date | null;
        items: Array<{
          id: string;
          source: 'VISIT' | 'ABONNEMENT' | 'LEDGER';
          amount: number;
          date: string;
          settled: boolean;
          label: string;
          journalId?: string | null;
          abonnementId?: string | null;
          ledgerId?: string | null;
          memberId: string;
          memberName: string;
          visitorNumber: number | null;
        }>;
      }
    >();

    const ensure = (m: {
      id: string;
      firstName?: string | null;
      lastName?: string | null;
      visitorNumber?: number | null;
    }) => {
      let row = byMember.get(m.id);
      if (!row) {
        row = {
          memberId: m.id,
          firstName: m.firstName || 'Visiteur',
          lastName: m.lastName || null,
          visitorNumber: m.visitorNumber ?? null,
          owedFromVisits: 0,
          owedFromAbos: 0,
          owedFromLedger: 0,
          lastUnpaidAt: null,
          items: [],
        };
        byMember.set(m.id, row);
      }
      return row;
    };

    const memberName = (m: {
      firstName?: string | null;
      lastName?: string | null;
    }) => [m.firstName, m.lastName].filter(Boolean).join(' ') || 'Visiteur';

    const bumpDate = (
      row: { lastUnpaidAt: Date | null },
      d: Date | null,
    ) => {
      if (!d) return;
      if (!row.lastUnpaidAt || d > row.lastUnpaidAt) row.lastUnpaidAt = d;
    };

    for (const j of journals) {
      if (!j.members || !j.memberID) continue;
      const row = ensure(j.members);
      const amount = Number(j.prices?.price ?? j.payedAmount ?? 0);
      row.owedFromVisits += amount;
      bumpDate(row, j.registredTime);
      row.items.push({
        id: j.id,
        source: 'VISIT',
        amount,
        date: j.registredTime.toISOString(),
        settled: false,
        label: j.prices?.name || 'Visite',
        journalId: j.id,
        memberId: j.memberID,
        memberName: memberName(j.members),
        visitorNumber: j.members.visitorNumber ?? null,
      });
    }

    for (const a of abos) {
      if (!a.members) continue;
      const row = ensure(a.members);
      const amount = Number(a.price?.price ?? a.payedAmount ?? 0);
      row.owedFromAbos += amount;
      bumpDate(row, a.registredDate);
      row.items.push({
        id: a.id,
        source: 'ABONNEMENT',
        amount,
        date: a.registredDate.toISOString(),
        settled: false,
        label: a.price?.name || 'Abonnement',
        abonnementId: a.id,
        memberId: a.memberID,
        memberName: memberName(a.members),
        visitorNumber: a.members.visitorNumber ?? null,
      });
    }

    for (const l of ledgers) {
      const row = ensure(l.member);
      if (!l.settled) row.owedFromLedger += l.amount;
      bumpDate(row, l.createdAt);
      row.items.push({
        id: l.id,
        source: 'LEDGER',
        amount: l.amount,
        date: l.createdAt.toISOString(),
        settled: l.settled,
        label: l.note || 'Crédit',
        ledgerId: l.id,
        journalId: l.journalId,
        abonnementId: l.abonnementId,
        memberId: l.memberId,
        memberName: memberName(l.member),
        visitorNumber: l.member.visitorNumber ?? null,
      });
    }

    const members = [...byMember.values()]
      .map((m) => ({
        ...m,
        net: m.owedFromVisits + m.owedFromAbos + m.owedFromLedger,
        lastUnpaidAt: m.lastUnpaidAt ? m.lastUnpaidAt.toISOString() : null,
      }))
      .filter((m) => includeSettled || m.net > 0.009)
      .sort((a, b) => b.net - a.net);

    return { members };
  }
}
