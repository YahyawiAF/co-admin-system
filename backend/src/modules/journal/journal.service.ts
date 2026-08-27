import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { UpdateJournalDto } from './dtos/updateJournal.dto';
import { Journal, Prisma, Subscription } from '@prisma/client';
import { PaginatedResult } from 'common/dtos/PaginatedOutputDto';
import { createPaginator } from 'prisma-pagination';
import { AddJournalDto } from './dtos/createJournal.dto';
import { HttpStatus } from '@nestjs/common';
import { ErrorCode, GeneralException } from '@/exceptions';
import { JournalEntity } from './entities/journal.entity';
import { endOfDay, startOfDay } from 'date-fns';

export const roundsOfHashing = 10;

type SearchCriteria = {
  createdAt?: string;
  // Add other fields as needed
};

@Injectable()
export class JournalService {
  constructor(private prisma: PrismaService) {}
  async create(createJournalDto: AddJournalDto) {
    try {
      const { memberID, priceId } = createJournalDto;
      const isAnonymous = !!createJournalDto.isAnonymous || !memberID;

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

      if (existingPrice.category === 'ABONNEMENT') {
        throw new GeneralException(
          HttpStatus.BAD_REQUEST,
          ErrorCode.INVALID_INPUT,
          `Les abonnements ne s’ajoutent pas au journal.`,
        );
      }

      const now = new Date(createJournalDto.registredTime);
      const startOfTheDay = startOfDay(now);
      const endOfTheDay = endOfDay(now);

      if (memberID) {
        const existingJournal = await this.prisma.journal.findFirst({
          where: {
            memberID,
            registredTime: {
              gte: startOfTheDay,
              lt: endOfTheDay,
            },
          },
        });

        if (existingJournal) {
          throw new GeneralException(
            HttpStatus.CONFLICT,
            ErrorCode.ALREADY_EXIST,
            `A journal entry for this member already exists today.`,
          );
        }
      }

      return await this.prisma.journal.create({
        data: {
          memberID: memberID || null,
          registredTime: createJournalDto.registredTime,
          leaveTime: createJournalDto.leaveTime,
          isPayed: createJournalDto.isPayed,
          isReservation: createJournalDto.isReservation,
          payedAmount: createJournalDto.payedAmount,
          priceId: createJournalDto.priceId,
          createdbyUserID: createJournalDto.createdbyUserID,
          isAnonymous,
          guestName: createJournalDto.guestName || null,
          groupVisitId: createJournalDto.groupVisitId || null,
        },
      });
    } catch (error) {
      throw new GeneralException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.ALREADY_EXIST,
        (error as Error).message,
      );
    }
  }

  findAllJournal() {
    return this.prisma.journal.findMany();
  }

  findAll() {
    return this.prisma.journal.findMany();
  }

  async findMany({
    where,
    orderBy = {
      id: 'desc',
    },
    page,
    perPage = 20,
  }: {
    where?: Prisma.JournalWhereInput;
    orderBy?: Prisma.UserOrderByWithRelationInput;
    page?: number;
    perPage: number;
  }): Promise<PaginatedResult<Journal>> {
    const paginate = createPaginator({ perPage });
    const paginatedResult = await paginate(
      this.prisma.journal,
      {
        where,
        orderBy,
        include: {
          members: { include: { group: true } },
          createdBy: true,
          prices: true,
        },
      },
      {
        page,
      },
    );

    return {
      data: paginatedResult.data.map(
        (member) => new JournalEntity(member),
      ) as unknown as Journal[],
      meta: paginatedResult.meta,
    };
  }
  findOne(id: string) {
    return this.prisma.journal.findUnique({ where: { id } });
  }

  findByDate(criteria: SearchCriteria) {
    return this.prisma.journal.findMany({ where: { ...criteria } });
  }

  async update(id: string, updateJournalDto: UpdateJournalDto) {
    try {
      const { priceId } = updateJournalDto;

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

      return await this.prisma.journal.update({
        where: { id },
        data: updateJournalDto,
      });
    } catch (error) {
      throw new GeneralException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.UPDATE_FAILED,
        (error as Error).message,
      );
    }
  }

  remove(id: string) {
    return this.prisma.journal.delete({ where: { id } });
  }

  /** Attach an existing member to an anonymous (or member-less) journal. */
  async linkMember(journalId: string, memberId: string) {
    const journal = await this.prisma.journal.findUnique({
      where: { id: journalId },
    });
    if (!journal) {
      throw new GeneralException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Journal not found',
      );
    }
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
    });
    if (!member) {
      throw new GeneralException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Member not found',
      );
    }

    const dayStart = startOfDay(journal.registredTime);
    const dayEnd = endOfDay(journal.registredTime);
    const conflict = await this.prisma.journal.findFirst({
      where: {
        memberID: memberId,
        id: { not: journalId },
        leaveTime: null,
        registredTime: { gte: dayStart, lt: dayEnd },
      },
    });
    if (conflict) {
      throw new GeneralException(
        HttpStatus.CONFLICT,
        ErrorCode.ALREADY_EXIST,
        'Ce membre a déjà une session ouverte aujourd’hui.',
      );
    }

    const updated = await this.prisma.journal.update({
      where: { id: journalId },
      data: {
        memberID: memberId,
        isAnonymous: false,
        guestName: null,
      },
      include: { members: true, prices: true, createdBy: true },
    });

    // Attach any open seat bookings that were left without member (rare) — none for now
    return new JournalEntity(updated as any);
  }

  /** Create a member from guest fields and attach to the journal. */
  async promoteMember(
    journalId: string,
    data: { firstName?: string; phone?: string; lastName?: string },
  ) {
    const journal = await this.prisma.journal.findUnique({
      where: { id: journalId },
    });
    if (!journal) {
      throw new GeneralException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Journal not found',
      );
    }

    const phone = data.phone?.replace(/\D/g, '') || null;
    let member = phone
      ? await this.prisma.member.findUnique({ where: { phone } })
      : null;

    if (!member) {
      const max = await this.prisma.member.aggregate({
        _max: { visitorNumber: true },
      });
      const visitorNumber = (max._max.visitorNumber || 0) + 1;
      member = await this.prisma.member.create({
        data: {
          phone: phone || undefined,
          firstName:
            data.firstName?.trim() ||
            journal.guestName ||
            `Visiteur ${visitorNumber}`,
          lastName: data.lastName?.trim() || undefined,
          visitorNumber,
          credits: 0,
          isActive: true,
          plan: Subscription.Journal,
        },
      });
    }

    return this.linkMember(journalId, member.id);
  }
}
