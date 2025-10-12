import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '@prisma/client';
import { PaginatedResult } from 'common/dtos/PaginatedOutputDto';
import { createPaginator } from 'prisma-pagination';
import { ErrorCode, GeneralException } from '@/exceptions';
import { CreateResponseDto } from './dtos/createreponse.dtos';
import { UpdateResponseDto } from './dtos/updatereponse.dtos';
import { ResponseEntity } from './entity/reponse.entity';

@Injectable()
export class ResponseService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new response.
   * @param createResponseDto - Data to create a response.
   * @returns The created response.
   */
  async create(createResponseDto: CreateResponseDto): Promise<ResponseEntity> {
    try {
      const response = await this.prisma.response.create({
        data: createResponseDto,
        include: { reclamation: true },
      });
      return new ResponseEntity(response);
    } catch (error) {
      throw new GeneralException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.ALREADY_EXIST,
        `Failed to create response: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Fetch all responses.
   * @returns List of responses.
   */
  async findAll(): Promise<ResponseEntity[]> {
    const responses = await this.prisma.response.findMany({
      include: { reclamation: true },
    });
    return responses.map((response) => new ResponseEntity(response));
  }

  /**
   * Paginated fetch of responses.
   * @param where - Filter criteria.
   * @param orderBy - Sort order.
   * @param page - Page number.
   * @param perPage - Items per page.
   * @returns Paginated result of responses.
   */
  async findMany({
    where,
    orderBy = { createdAt: 'desc' },
    page = 1,
    perPage = 20,
  }: {
    where?: Prisma.ResponseWhereInput;
    orderBy?: Prisma.ResponseOrderByWithRelationInput;
    page?: number;
    perPage?: number;
  }): Promise<PaginatedResult<ResponseEntity>> {
    const paginate = createPaginator({ perPage });
    const paginatedResult = await paginate(
      this.prisma.response,
      {
        where,
        orderBy,
        include: { reclamation: true },
      },
      { page },
    );
    return {
      data: paginatedResult.data.map(
        (response) => new ResponseEntity(response),
      ),
      meta: paginatedResult.meta,
    };
  }

  /**
   * Find a specific response by ID.
   * @param id - Response ID.
   * @returns The found response or null.
   */
  async findOne(id: string): Promise<ResponseEntity> {
    try {
      const response = await this.prisma.response.findUnique({
        where: { id },
        include: { reclamation: true },
      });
      if (!response) {
        throw new GeneralException(
          HttpStatus.NOT_FOUND,
          ErrorCode.NOT_FOUND,
          `Response with ID ${id} not found.`,
        );
      }
      return new ResponseEntity(response);
    } catch (error) {
      throw new GeneralException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        `Response with ID ${id} not found: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Update a response's information.
   * @param id - Response ID.
   * @param updateResponseDto - Data to update the response.
   * @returns The updated response.
   */
  async update(
    id: string,
    updateResponseDto: UpdateResponseDto,
  ): Promise<ResponseEntity> {
    try {
      const response = await this.prisma.response.update({
        where: { id },
        data: updateResponseDto,
        include: { reclamation: true },
      });
      return new ResponseEntity(response);
    } catch (error) {
      throw new GeneralException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.UPDATE_FAILED,
        `Failed to update response: ${(error as Error).message}`,
      );
    }
  }

  async findByClaimsId(reclamationId: string): Promise<ResponseEntity[]> {
    try {
      const responses = await this.prisma.response.findMany({
        where: { reclamationId },
        include: { reclamation: true },
      });
      if (!responses.length) {
        throw new GeneralException(
          HttpStatus.NOT_FOUND,
          ErrorCode.NOT_FOUND,
          `No responses found for reclamation ID ${reclamationId}.`,
        );
      }
      return responses.map((response) => new ResponseEntity(response));
    } catch (error) {
      throw new GeneralException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        `Failed to fetch responses for reclamation ID ${reclamationId}: ${
          (error as Error).message
        }`,
      );
    }
  }

  /**
   * Delete a response by ID.
   * @param id - Response ID.
   * @returns The deleted response.
   */
  async remove(id: string): Promise<ResponseEntity> {
    try {
      const response = await this.prisma.response.delete({
        where: { id },
        include: { reclamation: true },
      });
      return new ResponseEntity(response);
    } catch (error) {
      throw new GeneralException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_EXIST,
        `Failed to delete response with ID ${id}: ${(error as Error).message}`,
      );
    }
  }
}
