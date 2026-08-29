import {
  Injectable,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AddMemberDto } from './dtos/createMember.dto';
import { UpdateMemberDto } from './dtos/updateMember.dto';
import { Prisma, Member, ProductOrderStatus } from '@prisma/client';
import { PaginatedResult } from 'common/dtos/PaginatedOutputDto';
import { createPaginator } from 'prisma-pagination';
import { ErrorCode, GeneralException } from '@/exceptions';
import { MemberEntity } from './entities/member.entity';
import { startOfWeek, addWeeks, format, getHours, getDay } from 'date-fns';

@Injectable()
export class MemberService {
  constructor(private readonly prisma: PrismaService) {}

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
      const member = await this.prisma.member.create({
        data: addMemberDto,
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
  async findAll(): Promise<MemberEntity[]> {
    const members = await this.prisma.member.findMany({
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
          type: { in: ['seat.assigned', 'seat.claimed', 'seat_claimed'] },
        },
        orderBy: { occurredAt: 'desc' },
        take: 250,
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
        favoriteSeat: countMode(seatEvents.map((e) => e.seatId)),
        favoriteProduct: countMode(orders.map((o) => o.product?.name)),
        favoriteForfait: countMode(journals.map((j) => j.prices?.name)),
      },
      weekly,
      recentVisits: journals.slice(0, 20).map((j) => ({
        id: j.id,
        registredTime: j.registredTime,
        leaveTime: j.leaveTime,
        payedAmount: j.payedAmount,
        isPayed: j.isPayed,
        forfait: j.prices?.name || null,
      })),
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
}
