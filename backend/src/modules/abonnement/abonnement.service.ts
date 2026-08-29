import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { UpdateAbonnementDto } from './dtos/updateAbonnement.dto';
import { Abonnement, Prisma, Subscription } from '@prisma/client';
import { PaginatedResult } from 'common/dtos/PaginatedOutputDto';
import { createPaginator } from 'prisma-pagination';
import { AddAbonnementDto } from './dtos/createAbonnement.dto';
import { HttpStatus } from '@nestjs/common';
import { ErrorCode, GeneralException } from '@/exceptions';
import { AbonnementEntity } from './entities/abonnement.entity';

@Injectable()
export class AbonnementService {
  constructor(private prisma: PrismaService) {}

  async create(createAbonnementDto: AddAbonnementDto) {
    try {
      const { memberID, priceId } = createAbonnementDto;

      // Vérifier si le prix existe
      const existingPrice = await this.prisma.price.findUnique({
        where: { id: priceId },
      });

      if (!existingPrice) {
        throw new GeneralException(
          HttpStatus.NOT_FOUND,
          ErrorCode.NOT_FOUND,
          `The selected price does not exist.`,
        );
      }

      // Vérifier si le membre existe
      const existingMember = await this.prisma.member.findUnique({
        where: { id: memberID },
      });

      if (!existingMember) {
        throw new GeneralException(
          HttpStatus.NOT_FOUND,
          ErrorCode.NOT_FOUND,
          `The selected member does not exist.`,
        );
      }

      // Update user plan
      //   const updatedUser = await this.prisma.member.update({

      const hoursQuota =
        createAbonnementDto.hoursQuota ??
        (existingPrice.billingUnit === 'HOURLY'
          ? existingPrice.durationHours
          : null);

      const created = await this.prisma.abonnement.create({
        data: {
          memberID: createAbonnementDto.memberID,
          registredDate: createAbonnementDto.registredDate,
          leaveDate: createAbonnementDto.leaveDate,
          isPayed: createAbonnementDto.isPayed,
          isReservation: createAbonnementDto.isReservation,
          payedAmount: createAbonnementDto.payedAmount,
          stayedPeriode: createAbonnementDto.stayedPeriode, // fornt end calculate leave time
          priceId: priceId,
          hoursQuota,
          hoursUsed: createAbonnementDto.hoursUsed ?? 0,
          reservedSeatLabel: createAbonnementDto.reservedSeatLabel || null,
          reservedSeatSpaceId:
            createAbonnementDto.reservedSeatSpaceId || null,
        },
        include: {
          members: true,
          price: true,
        },
      });
      await this.syncReservedSeat(
        created.memberID,
        created.reservedSeatLabel,
        existingPrice,
        created.leaveDate,
        created.reservedSeatSpaceId,
      );
      return created;
    } catch (error) {
      throw new GeneralException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.ALREADY_EXIST,
        (error as Error).message,
      );
    }
  }

  findAllAbonnements() {
    return this.prisma.abonnement.findMany({
      include: {
        members: true,
        price: true,
      },
    });
  }

  findAll() {
    return this.prisma.abonnement.findMany({
      include: {
        members: true,
        price: true,
      },
    });
  }

  async findMany({
    where,
    orderBy = { id: 'desc' },
    page,
    perPage = 20,
  }: {
    where?: Prisma.AbonnementWhereInput;
    orderBy?: Prisma.AbonnementOrderByWithRelationInput;
    page?: number;
    perPage: number;
  }): Promise<PaginatedResult<AbonnementEntity & { stayedPeriode: string }>> {
    const paginate = createPaginator({ perPage });
    const paginatedResult = await paginate(
      this.prisma.abonnement,
      {
        where,
        orderBy,
        include: { members: true, price: true },
      },
      { page },
    );

    return {
      data: paginatedResult.data.map(
        (abonnement) => new AbonnementEntity(abonnement),
      ),
      meta: paginatedResult.meta,
    };
  }

  findOne(id: string) {
    return this.prisma.abonnement.findUnique({
      where: { id },
      include: {
        members: true,
        price: true,
      },
    });
  }

  async update(id: string, updateAbonnementDto: UpdateAbonnementDto) {
    try {
      const { priceId, memberID } = updateAbonnementDto;

      // Vérifier si le prix existe
      if (priceId) {
        const existingPrice = await this.prisma.price.findUnique({
          where: { id: priceId },
        });

        if (!existingPrice) {
          throw new GeneralException(
            HttpStatus.NOT_FOUND,
            ErrorCode.NOT_FOUND,
            `The selected price does not exist.`,
          );
        }
      }

      // Vérifier si le membre existe
      if (memberID) {
        const existingMember = await this.prisma.member.findUnique({
          where: { id: memberID },
        });

        if (!existingMember) {
          throw new GeneralException(
            HttpStatus.NOT_FOUND,
            ErrorCode.NOT_FOUND,
            `The selected member does not exist.`,
          );
        }
      }

      const { reservedSeatLabel, reservedSeatSpaceId, ...rest } =
        updateAbonnementDto;
      const updated = await this.prisma.abonnement.update({
        where: { id },
        data: {
          ...rest,
          ...(reservedSeatLabel !== undefined
            ? { reservedSeatLabel: reservedSeatLabel?.trim() || null }
            : {}),
          ...(reservedSeatSpaceId !== undefined
            ? { reservedSeatSpaceId: reservedSeatSpaceId || null }
            : {}),
        },
        include: {
          members: true,
          price: true,
        },
      });
      await this.syncReservedSeat(
        updated.memberID,
        updated.reservedSeatLabel,
        updated.price,
        updated.leaveDate,
        updated.reservedSeatSpaceId,
      );
      await this.refreshMemberPlan(updated.memberID);
      return updated;
    } catch (error) {
      throw new GeneralException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.UPDATE_FAILED,
        (error as Error).message,
      );
    }
  }

  async remove(id: string) {
    const existing = await this.prisma.abonnement.findUnique({
      where: { id },
    });
    const deleted = await this.prisma.abonnement.delete({
      where: { id },
      include: {
        members: true,
        price: true,
      },
    });
    if (existing) {
      const other = await this.prisma.abonnement.findFirst({
        where: {
          memberID: existing.memberID,
          registredDate: { lte: new Date() },
          OR: [{ leaveDate: null }, { leaveDate: { gt: new Date() } }],
        },
      });
      if (!other) {
        await this.prisma.seatBooking.deleteMany({
          where: {
            memberId: existing.memberID,
            isPermanent: true,
            eventKey: 'collabora-hub',
          },
        });
      }
      await this.refreshMemberPlan(existing.memberID);
    }
    return deleted;
  }

  private async refreshMemberPlan(memberId: string) {
    const now = new Date();
    const others = await this.prisma.abonnement.findMany({
      where: {
        memberID: memberId,
        registredDate: { lte: now },
        OR: [{ leaveDate: null }, { leaveDate: { gt: now } }],
      },
      include: { price: true },
    });
    const active = others.some((sub) => {
      if (sub.price?.billingUnit === 'HOURLY') {
        const quota = sub.hoursQuota || sub.price.durationHours || 0;
        if (quota > 0 && (sub.hoursUsed || 0) >= quota) return false;
      }
      return true;
    });
    await this.prisma.member.update({
      where: { id: memberId },
      data: { plan: active ? Subscription.Membership : Subscription.Journal },
    });
  }

  private isPeriodPrice(
    price: {
      category?: string | null;
      type?: string;
      billingUnit?: string | null;
      reserveSeat?: boolean | null;
    } | null,
  ) {
    if (!price) return false;
    if (price.category !== 'ABONNEMENT' && price.type !== 'abonnement') {
      return false;
    }
    return price.billingUnit !== 'HOURLY';
  }

  private shouldReserveSeat(
    price: {
      category?: string | null;
      type?: string;
      billingUnit?: string | null;
      reserveSeat?: boolean | null;
    } | null,
    seatLabel: string | null | undefined,
  ) {
    if (!seatLabel?.trim()) return false;
    return !!price?.reserveSeat;
  }

  private async releasePermanentSeat(memberId: string) {
    await this.prisma.seatBooking.deleteMany({
      where: {
        memberId,
        isPermanent: true,
        eventKey: 'collabora-hub',
      },
    });
  }

  private async syncReservedSeat(
    memberId: string,
    seatLabel: string | null | undefined,
    price: {
      category?: string | null;
      type?: string;
      billingUnit?: string | null;
      reserveSeat?: boolean | null;
    } | null,
    leaveDate?: Date | null,
    spaceId?: string | null,
  ) {
    const expired = !!leaveDate && new Date(leaveDate) <= new Date();
    const label = seatLabel?.trim() || '';
    if (expired || !this.shouldReserveSeat(price, label)) {
      await this.releasePermanentSeat(memberId);
      return;
    }
    const seat = await this.prisma.seat.findFirst({
      where: {
        label,
        isActive: true,
        ...(spaceId ? { spaceId } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!seat) return;
    const taken = await this.prisma.seatBooking.findFirst({
      where: {
        eventKey: 'collabora-hub',
        seatId: label,
        spaceId: seat.spaceId,
        isBooked: true,
        NOT: { memberId },
      },
    });
    if (taken) return;
    await this.prisma.seatBooking.deleteMany({
      where: {
        memberId,
        isBooked: true,
        eventKey: 'collabora-hub',
        NOT: { seatId: label, spaceId: seat.spaceId },
      },
    });
    await this.prisma.seatBooking.upsert({
      where: {
        eventKey_spaceId_seatId: {
          eventKey: 'collabora-hub',
          spaceId: seat.spaceId,
          seatId: label,
        },
      },
      create: {
        eventKey: 'collabora-hub',
        seatId: label,
        spaceId: seat.spaceId,
        isBooked: true,
        isPermanent: true,
        bookedAt: new Date(),
        memberId,
      },
      update: {
        isBooked: true,
        memberId,
        isPermanent: true,
        bookedAt: new Date(),
      },
    });
  }
}
