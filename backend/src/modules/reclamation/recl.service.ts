import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '@prisma/client';
import { PaginatedResult } from 'common/dtos/PaginatedOutputDto';
import { createPaginator } from 'prisma-pagination';
import { ErrorCode, GeneralException } from '@/exceptions';
import { CreateReclamationDto } from './dtos/createreclamation.dtos';
import { UpdateReclamationDto } from './dtos/updatereclamation.dtos';
import { ReclamationEntity } from './entity/reclamation.entity';

@Injectable()
export class ReclamationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new reclamation.
   * @param createReclamationDto - Data to create a reclamation.
   * @returns The created reclamation.
   */
  async create(createReclamationDto: CreateReclamationDto): Promise<ReclamationEntity> {
    try {
      const reclamation = await this.prisma.reclamation.create({
        data: {
          ...createReclamationDto,
          status: createReclamationDto.status || 'PENDING',
        },
        include: { member: true },
      });
      return new ReclamationEntity(reclamation);
    } catch (error) {
      throw new GeneralException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.ALREADY_EXIST,
        `Failed to create reclamation: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Fetch all reclamations.
   * @returns List of reclamations.
   */
  async findAll(): Promise<ReclamationEntity[]> {
    const reclamations = await this.prisma.reclamation.findMany({
      include: { member: true },
    });
    return reclamations.map((reclamation) => new ReclamationEntity(reclamation));
  }

  /**
   * Paginated fetch of reclamations.
   * @param where - Filter criteria.
   * @param orderBy - Sort order.
   * @param page - Page number.
   * @param perPage - Items per page.
   * @returns Paginated result of reclamations.
   */
  async findMany({
    where,
    orderBy = { createdAt: 'desc' },
    page = 1,
    perPage = 20,
  }: {
    where?: Prisma.ReclamationWhereInput;
    orderBy?: Prisma.ReclamationOrderByWithRelationInput;
    page?: number;
    perPage?: number;
  }): Promise<PaginatedResult<ReclamationEntity>> {
    const paginate = createPaginator({ perPage });
    const paginatedResult = await paginate(
      this.prisma.reclamation,
      {
        where,
        orderBy,
        include: { member: true },
      },
      { page },
    );
    return {
      data: paginatedResult.data.map((reclamation) => new ReclamationEntity(reclamation)),
      meta: paginatedResult.meta,
    };
  }

  /**
   * Find a specific reclamation by ID.
   * @param id - Reclamation ID.
   * @returns The found reclamation or null.
   */
  async findOne(id: string): Promise<ReclamationEntity> {
    try {
      const reclamation = await this.prisma.reclamation.findUnique({
        where: { id },
        include: { member: true, responses: true },
      });
      if (!reclamation) {
        throw new GeneralException(
          HttpStatus.NOT_FOUND,
          ErrorCode.NOT_FOUND,
          `Reclamation with ID ${id} not found.`,
        );
      }
      return new ReclamationEntity(reclamation);
    } catch (error) {
      throw new GeneralException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        `Reclamation with ID ${id} not found: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Update a reclamation's information.
   * @param id - Reclamation ID.
   * @param updateReclamationDto - Data to update the reclamation.
   * @returns The updated reclamation.
   */
  async update(
    id: string,
    updateReclamationDto: UpdateReclamationDto,
  ): Promise<ReclamationEntity> {
    try {
      const reclamation = await this.prisma.reclamation.update({
        where: { id },
        data: updateReclamationDto,
        include: { member: true },
      });
      return new ReclamationEntity(reclamation);
    } catch (error) {
      throw new GeneralException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.UPDATE_FAILED,
        `Failed to update reclamation: ${(error as Error).message}`,
      );
    }
  }
  async findByMemberId(
    memberId: string,
    page: number = 1,
    perPage: number = 20,
  ): Promise<PaginatedResult<ReclamationEntity>> {
    try {
      const paginate = createPaginator({ perPage });
      const paginatedResult = await paginate(
        this.prisma.reclamation,
        {
          where: { memberId },
          orderBy: { createdAt: 'desc' },
          include: { member: true },
        },
        { page },
      );
      return {
        data: paginatedResult.data.map((reclamation) => new ReclamationEntity(reclamation)),
        meta: paginatedResult.meta,
      };
    } catch (error) {
      throw new GeneralException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.UNKNOWN_ERROR,
        `Failed to fetch reclamations for member ${memberId}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Delete a reclamation by ID.
   * @param id - Reclamation ID.
   * @returns The deleted reclamation.
   */
  async remove(id: string): Promise<ReclamationEntity> {
    try {
      const reclamation = await this.prisma.reclamation.delete({
        where: { id },
        include: { member: true },
      });
      return new ReclamationEntity(reclamation);
    } catch (error) {
      throw new GeneralException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_EXIST,
        `Failed to delete reclamation with ID ${id}: ${(error as Error).message}`,
      );
    }
  }
}