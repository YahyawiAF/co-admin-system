import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { UpdateAbonnementDto } from './dtos/updateAbonnement.dto';
import { Abonnement, Prisma } from '@prisma/client';
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

      return await this.prisma.abonnement.create({
        data: {
          memberID: createAbonnementDto.memberID,
          registredDate: createAbonnementDto.registredDate,
          leaveDate: createAbonnementDto.leaveDate,
          isPayed: createAbonnementDto.isPayed,
          isReservation: createAbonnementDto.isReservation,
          payedAmount: createAbonnementDto.payedAmount,
          stayedPeriode: createAbonnementDto.stayedPeriode, // fornt end calculate leave time

          priceId: priceId,
        },
        include: {
          members: true,
          price: true,
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

      return await this.prisma.abonnement.update({
        where: { id },
        data: updateAbonnementDto,
        include: {
          members: true,
          price: true,
        },
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
    return this.prisma.abonnement.delete({
      where: { id },
      include: {
        members: true,
        price: true,
      },
    });
  }
}
