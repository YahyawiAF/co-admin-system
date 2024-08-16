import { PrismaService } from '../../../database/prisma.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AddUserDto, CreateUserDto } from './dtos/create-user.dto';
import { UpdateUserDto } from './dtos/update-user.dto';
import { TypedEventEmitter } from 'src/modules/event-emitter/typed-event-emitter.class';
import { Prisma } from '@prisma/client';
import { PaginatedResult } from 'common/dtos/PaginatedOutputDto';
import * as bcrypt from 'bcrypt';
import { createPaginator } from 'prisma-pagination';
import { ErrorCode, GeneralException } from '@/exceptions';
import { UnauthorizedException } from '@nestjs/common';
import { AuthEntity } from '../auth/entity/auth.entity';

export const roundsOfHashing = 10;
@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private readonly eventEmitter: TypedEventEmitter,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(
      createUserDto.password,
      roundsOfHashing,
    );

    this.eventEmitter.emit('user.welcome', {
      name: createUserDto.fullname,
      email: createUserDto.email,
    });

    createUserDto.password = hashedPassword;
    try {
      return await this.prisma.user.create({
        data: createUserDto,
      });
    } catch (error) {
      // Handle errors from the asynchronous operation
      throw new GeneralException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.NOT_EQUAL,
        (error as Error).message,
      );
    }
  }

  async addUser(addUserDto: AddUserDto) {
    this.eventEmitter.emit('user.welcome', {
      name: addUserDto.fullname,
      email: addUserDto.email,
    });
    return this.prisma.user.create({
      data: addUserDto,
    });
  }

  findAll() {
    return this.prisma.user.findMany();
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
  }): Promise<PaginatedResult<AddUserDto>> {
    const paginate = createPaginator({ perPage });
    return paginate(
      this.prisma.user,
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
    return this.prisma.user.findUnique({ where: { id } });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(
        updateUserDto.password,
        roundsOfHashing,
      );
    }

    return this.prisma.user.update({
      where: { id },
      data: updateUserDto,
    });
  }

  remove(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }

  async changePassword(email: string, password: string): Promise<AuthEntity> {
    const user = await this.prisma.user.findUnique({
      where: { email: email },
    });
    const isPasswordValid = await bcrypt.compare(password, user.password);
    try {
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid password');
      }
      return {
        email,
        role: user.role,
        fullname: user.fullname,
        id: user.id,
        accessToken: null,
        refreshToken: null,
      };
    } catch (error) {
      // Handle errors from the asynchronous operation
      throw new GeneralException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.ALREADY_EXIST,
        (error as Error).message,
      );
    }
  }
}
