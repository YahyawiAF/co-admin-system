import { BadRequestException, Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { UpdateJournalDto } from './dtos/updateJournal.dto';
import { Journal, Prisma, Subscription } from '@prisma/client';
import { PaginatedResult } from 'common/dtos/PaginatedOutputDto';
import { createPaginator } from 'prisma-pagination';
import { AddJournalDto } from './dtos/createJournal.dto';
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

  findAll(organizationId?: string) {
    return this.prisma.journal.findMany({
      where: organizationId
        ? { members: { organizationId } }
        : undefined,
      include: {
        members: { include: { group: true } },
        createdBy: true,
        prices: true,
      },
    });
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

    const rows = paginatedResult.data as Array<{
      memberID?: string | null;
      isPayed: boolean;
      payedAmount?: number;
      prices?: { price?: number } | null;
    }>;

    const memberIds = [
      ...new Set(
        rows.map((row) => row.memberID).filter((id): id is string => !!id),
      ),
    ];
    const debt = await this.debtFlagsForMembers(memberIds);

    return {
      data: rows.map((row) => {
        const flags = row.memberID ? debt.get(row.memberID) : undefined;
        const thisUnpaid = !row.isPayed
          ? Number(row.prices?.price ?? row.payedAmount ?? 0)
          : 0;
        const past = Math.max(0, (flags?.amount ?? 0) - thisUnpaid);
        return new JournalEntity({
          ...row,
          hasOpenDebt: past > 0.009,
          openDebtAmount: Math.round(past * 100) / 100,
        });
      }) as unknown as Journal[],
      meta: paginatedResult.meta,
    };
  }

  private async debtFlagsForMembers(memberIds: string[]) {
    const map = new Map<string, { amount: number }>();
    if (!memberIds.length) return map;
    const [journals, abos, ledgers] = await Promise.all([
      this.prisma.journal.findMany({
        where: { memberID: { in: memberIds }, isPayed: false },
        select: { memberID: true, payedAmount: true, prices: { select: { price: true } } },
      }),
      this.prisma.abonnement.findMany({
        where: { memberID: { in: memberIds }, isPayed: false },
        select: { memberID: true, payedAmount: true, price: { select: { price: true } } },
      }),
      this.prisma.memberLedger.findMany({
        where: {
          memberId: { in: memberIds },
          settled: false,
          kind: 'CREDIT',
        },
        select: { memberId: true, amount: true },
      }),
    ]);
    const add = (id: string | null | undefined, amount: number) => {
      if (!id) return;
      const cur = map.get(id) || { amount: 0 };
      cur.amount += amount;
      map.set(id, cur);
    };
    for (const j of journals) {
      add(j.memberID, Number(j.prices?.price ?? j.payedAmount ?? 0));
    }
    for (const a of abos) {
      add(a.memberID, Number(a.price?.price ?? a.payedAmount ?? 0));
    }
    for (const l of ledgers) add(l.memberId, l.amount);
    return map;
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

  async remove(id: string) {
    const journal = await this.prisma.journal.findUnique({ where: { id } });
    if (!journal) {
      throw new GeneralException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Journal not found',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      if (journal.memberID) {
        await tx.seatBooking.deleteMany({
          where: {
            memberId: journal.memberID,
            isBooked: true,
            isPermanent: false,
          },
        });
      } else {
        const anonBookings = await tx.seatBooking.findMany({
          where: {
            isBooked: true,
            isPermanent: false,
            memberId: null,
          },
        });
        const guest = journal.guestName || '';
        const ids = anonBookings
          .filter((b) => guest.includes(b.seatId))
          .map((b) => b.id);
        if (ids.length) {
          await tx.seatBooking.deleteMany({ where: { id: { in: ids } } });
        }
      }
      await tx.journal.delete({ where: { id } });
    });

    return { id, deleted: true };
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
    const org = await this.prisma.organization.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!org) {
      throw new BadRequestException('Aucune organisation configurée');
    }
    let member = phone
      ? await this.prisma.member.findFirst({
          where: { organizationId: org.id, phone },
        })
      : null;

    if (!member) {
      const max = await this.prisma.member.aggregate({
        where: { organizationId: org.id },
        _max: { visitorNumber: true },
      });
      const visitorNumber = (max._max.visitorNumber || 0) + 1;
      member = await this.prisma.member.create({
        data: {
          organizationId: org.id,
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
