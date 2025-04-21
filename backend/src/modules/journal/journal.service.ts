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
};

@Injectable()
export class JournalService {
  constructor(private prisma: PrismaService) {}

  async create(createJournalDto: AddJournalDto) {
    try {
      console.log("Received DTO:", createJournalDto);
      const { memberID, priceId, expenseIds } = createJournalDto;

      // Validate price
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
      const expenseConnection = expenseIds?.length 
      ? { connect: expenseIds.map(id => ({ id })) }
      : undefined;

      // Validate expenses
      if (expenseIds?.length) {
        const existingExpenses = await this.prisma.expense.findMany({
          where: { id: { in: expenseIds } }
        });

        if (existingExpenses.length !== expenseIds.length) {
          const missingIds = expenseIds.filter(id => 
            !existingExpenses.some(e => e.id === id)
          );
          throw new GeneralException(
            HttpStatus.NOT_FOUND,
            ErrorCode.NOT_FOUND,
            `Expenses not found: ${missingIds.join(', ')}`
          );
        }
      }

      // Check existing journal
      const now = new Date(createJournalDto.registredTime);
      const existingJournal = await this.prisma.journal.findFirst({
        where: {
          memberID,
          registredTime: {
            gte: startOfDay(now),
            lt: endOfDay(now),
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

      // Create journal with expenses
      return await this.prisma.journal.create({
        data: {
          memberID: createJournalDto.memberID,
          registredTime: createJournalDto.registredTime,
          leaveTime: createJournalDto.leaveTime,
          isPayed: createJournalDto.isPayed,
          isReservation: createJournalDto.isReservation,
          payedAmount: createJournalDto.payedAmount,
          priceId: createJournalDto.priceId,
          ...(expenseConnection && { expenses: expenseConnection })
        },
        include: {
          expenses: true,
          members: true,
          prices: true
        }
      });

    } catch (error) {
      throw new GeneralException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.ALREADY_EXIST,
        (error as Error).message,
      );
    }
  }

  async findMany({
    where,
    orderBy = { id: 'desc' },
    page,
    perPage = 20,
  }: {
    where?: Prisma.JournalWhereInput;
    orderBy?: Prisma.JournalOrderByWithRelationInput;
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
          members: true,
          prices: true,
          expenses: true
        },
      },
      { page },
    );

    return {
      data: paginatedResult.data.map(journal => {
        const entity = new JournalEntity(journal);
        if (!entity.priceId) {
          throw new GeneralException(
            HttpStatus.INTERNAL_SERVER_ERROR,
            ErrorCode.INVALID_DATA,
            'priceId is missing in JournalEntity'
          );
        }
        return {
          ...entity,
          priceId: entity.priceId as string, // Ensure priceId is non-optional
        };
      }),
      meta: paginatedResult.meta,
    };
  }

  findOne(id: string) {
    return this.prisma.journal.findUnique({ where: { id } });
  }


  async update(id: string, updateJournalDto: UpdateJournalDto) {
    try {
      const { priceId, expenseIds, ...restDto } = updateJournalDto; // Extraction des champs spécifiques
  
      // Déclaration de expenseUpdate
      const expenseUpdate = expenseIds !== undefined 
        ? { set: expenseIds.map(id => ({ id })) } 
        : undefined;
  
      // Validate price
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
  
      // Validate expenses
      if (expenseIds !== undefined) {
        const existingExpenses = await this.prisma.expense.findMany({
          where: { id: { in: expenseIds } }
        });
  
        if (existingExpenses.length !== expenseIds.length) {
          const missingIds = expenseIds.filter(id => 
            !existingExpenses.some(e => e.id === id)
          );
          throw new GeneralException(
            HttpStatus.NOT_FOUND,
            ErrorCode.NOT_FOUND,
            `Expenses not found: ${missingIds.join(', ')}`
          );
        }
      }
  
      // Update journal
      return await this.prisma.journal.update({
        where: { id },
        data: {
          ...restDto, // Utilisez le reste des propriétés du DTO
          priceId,    // Ajoutez priceId séparément si nécessaire
          expenses: expenseUpdate
        },
        include: {
          expenses: true,
          members: true,
          prices: true
        }
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
