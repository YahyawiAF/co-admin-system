import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AddStatusDto } from './dtos/create-status.dto';
import { UpdateStatusDto } from './dtos/UpdateStatusDto.dto';
import { TypedEventEmitter } from 'src/modules/event-emitter/typed-event-emitter.class';
import { Prisma } from '@prisma/client';
import { PaginatedResult } from 'common/dtos/PaginatedOutputDto';
import { createPaginator } from 'prisma-pagination';

@Injectable()
export class StatusService {
  constructor(
    private prisma: PrismaService,
    private readonly eventEmitter: TypedEventEmitter,
  ) {}

  async addStatus(addStatusDto: AddStatusDto) {
    this.eventEmitter.emit('status.create', {
      ...addStatusDto,
    });
    return this.prisma.status.create({
      data: addStatusDto,
    });
  }

  findAll() {
    return this.prisma.status.findMany();
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
  }): Promise<PaginatedResult<AddStatusDto>> {
    const paginate = createPaginator({ perPage });
    return paginate(
      this.prisma.status,
      {
        where,
        orderBy: {
          timestamp: 'desc',
        },
      },
      {
        page,
      },
    );
  }

  findOne(id: string) {
    return this.prisma.status.findUnique({ where: { id } });
  }

  async update(id: string, updateUserDto: UpdateStatusDto) {
    return this.prisma.status.update({
      where: { id },
      data: updateUserDto,
    });
  }

  remove(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }
}
