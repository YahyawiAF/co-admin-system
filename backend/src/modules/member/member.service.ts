import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AddMemberDto } from './dtos/createMember.dto';
import { UpdateMemberDto } from './dtos/updateMember.dto';
import { Prisma, Member } from '@prisma/client';
import { PaginatedResult } from 'common/dtos/PaginatedOutputDto';
import { createPaginator } from 'prisma-pagination';
import { ErrorCode, GeneralException } from '@/exceptions';
import { MemberEntity } from './entities/member.entity';

@Injectable()
export class MemberService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new member.
   * @param addMemberDto - Data to create a member.
   * @returns The created member.
   */
  async create(addMemberDto: AddMemberDto): Promise<MemberEntity> {
    try {
      const member = await this.prisma.member.create({
        data: addMemberDto,
      });
      return new MemberEntity(member);
    } catch (error) {
      throw new GeneralException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.ALREADY_EXIST,
        `Failed to create member: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Fetch all members.
   * @returns List of members.
   */
  async findAll(): Promise<MemberEntity[]> {
    const members = await this.prisma.member.findMany();
    return members.map((member) => new MemberEntity(member));
  }

  /**
   * Paginated fetch of members.
   * @param where - Filter criteria.
   * @param orderBy - Sort order.
   * @param page - Page number.
   * @param perPage - Items per page.
   * @returns Paginated result of members.
   */
  async findMany({
    where,
    orderBy = { id: 'desc' },
    page = 1,
    perPage = 20,
  }: {
    where?: Prisma.MemberWhereInput;
    orderBy?: Prisma.MemberOrderByWithRelationInput;
    page?: number;
    perPage?: number;
  }): Promise<PaginatedResult<MemberEntity>> {
    const paginate = createPaginator({ perPage });
    const paginatedResult = await paginate(
      this.prisma.member,
      {
        where,
        orderBy,
      },
      { page },
    );
    return {
      data: paginatedResult.data.map((member) => new MemberEntity(member)),
      meta: paginatedResult.meta,
    };
  }

  /**
   * Find a specific member by ID.
   * @param id - Member ID.
   * @returns The found member or null.
   */
  async findOne(id: string): Promise<MemberEntity | null> {
    try {
      const member = await this.prisma.member.findUnique({
        where: { id },
      });
      return new MemberEntity(member);
    } catch (error) {
      throw new GeneralException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        `Member with ID ${id} not found.`,
      );
    }
  }

  /**
   * Search members by criteria.
   * @param criteria - Search criteria (e.g., createdAt, isActive).
   * @returns List of members matching the criteria.
   */
  async findByCriteria(criteria: Prisma.MemberWhereInput): Promise<Member[]> {
    return this.prisma.member.findMany({ where: criteria });
  }

  /**
   * Update a member's information.
   * @param id - Member ID.
   * @param updateMemberDto - Data to update the member.
   * @returns The updated member.
   */
  async update(
    id: string,
    updateMemberDto: UpdateMemberDto,
  ): Promise<MemberEntity> {
    try {
      const member = await this.prisma.member.update({
        where: { id },
        data: updateMemberDto,
      });
      return new MemberEntity(member);
    } catch (error) {
      throw new GeneralException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.UPDATE_FAILED,
        `Failed to update member: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Delete a member by ID.
   * @param id - Member ID.
   * @returns The deleted member.
   */
  async remove(id: string): Promise<MemberEntity> {
    try {
      const member = await this.prisma.member.delete({
        where: { id },
      });
      return new MemberEntity(member);
    } catch (error) {
      throw new GeneralException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_EXIST,
        `Failed to delete member with ID ${id}: ${(error as Error).message}`,
      );
    }
  }
}