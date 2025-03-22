import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { UpdateJournalDto } from './dtos/updateJournal.dto';
import { Journal, Prisma } from '@prisma/client';
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
        console.log("Received DTO:", createJournalDto);
      const { memberID, priceId } = createJournalDto;
  
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
  
      const now = new Date(createJournalDto.registredTime);
      const startOfTheDay = startOfDay(now);
      const endOfTheDay = endOfDay(now);
  
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
  
      return await this.prisma.journal.create({
        data: {
          memberID: createJournalDto.memberID,
          registredTime: createJournalDto.registredTime,
          leaveTime: createJournalDto.leaveTime,
          isPayed: createJournalDto.isPayed,
          isReservation: createJournalDto.isReservation,
          payedAmount: createJournalDto.payedAmount,
          priceId: priceId,  // Ajout explicite de priceId
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
          members: true, // Include related members
        },
      },
      {
        page,
      },
    );

    return {
      data: paginatedResult.data.map((member) => new JournalEntity(member)),
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
}
