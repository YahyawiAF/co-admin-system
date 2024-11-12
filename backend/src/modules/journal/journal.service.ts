import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { UpdateJournalDto } from './dtos/updateJournal.dto';
import { Prisma } from '@prisma/client';
import { PaginatedResult } from 'common/dtos/PaginatedOutputDto';
import { createPaginator } from 'prisma-pagination';
import { AddJournalDto } from './dtos/createJournal.dto';
import { HttpStatus } from '@nestjs/common';
import { ErrorCode, GeneralException } from '@/exceptions';

export const roundsOfHashing = 10;

type SearchCriteria = {
  createdAt?: string;
  // Add other fields as needed
};

@Injectable()
export class JournalService {
  constructor(private prisma: PrismaService) {}
  async create(CreateJournalDto: AddJournalDto) {
    try {
      return await this.prisma.journal.create({
        data: CreateJournalDto,
      });
    } catch (error) {
      // Handle errors from the asynchronous operation
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
    where?: Prisma.UserWhereInput;
    orderBy?: Prisma.UserOrderByWithRelationInput;
    page?: number;
    perPage: number;
  }): Promise<PaginatedResult<AddJournalDto>> {
    const paginate = createPaginator({ perPage });
    return paginate(
      this.prisma.journal,
      {
        where,
        orderBy,
      },
      {
        page,
      },
    );
  }
  findOne(id: string) {
    return this.prisma.journal.findUnique({ where: { id } });
  }

  findByDate(criteria: SearchCriteria) {
    return this.prisma.journal.findMany({ where: { ...criteria } });
  }

  async update(id: string, UpdateJournalDto: UpdateJournalDto) {
    return this.prisma.journal.update({
      where: { id },
      data: UpdateJournalDto,
    });
  }

  remove(id: string) {
    return this.prisma.journal.delete({ where: { id } });
  }
}
