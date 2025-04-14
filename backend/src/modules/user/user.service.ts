import { PrismaService } from '../../../database/prisma.service';
import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
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
import { ChangePasswordDto } from './dtos/change-password.dto';

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
  
    // Vérification fullname
    if (updateUserDto.fullname) {
      const existingUserByUsername = await this.prisma.user.findFirst({
        where: { fullname: updateUserDto.fullname },
      });
      if (existingUserByUsername && existingUserByUsername.id !== id) {
        throw new ConflictException('Ce nom d\'utilisateur est déjà pris.');
      }
    }
  
    // Vérification phoneNumber
    if (updateUserDto.phoneNumber) {
      const existingUserByPhone = await this.prisma.user.findFirst({
        where: { phoneNumber: updateUserDto.phoneNumber },
      });
      if (existingUserByPhone && existingUserByPhone.id !== id) {
        throw new ConflictException('Ce numéro de téléphone est déjà utilisé.');
      }
    }
  
    // Mise à jour avec sélection explicite des champs retournés
    return this.prisma.user.update({
      where: { id },
      data: updateUserDto,
      select: { // Ajout crucial
        id: true,
        fullname: true,
        email: true,
        phoneNumber: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }
  
  

  remove(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }


 async changePassword(userId: string, oldPassword: string, newPassword: string) {
    console.log('User ID:', userId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { password: true } 
    });
  
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }
  
    // Vérifier l'ancien mot de passe
    const isPasswordValid = await bcrypt.compare(
      oldPassword,
      user.password
    );
  
    if (!isPasswordValid) {
      throw new UnauthorizedException('Ancien mot de passe incorrect');
    }
  
    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(
      newPassword,
      roundsOfHashing
    );
  
    // Mettre à jour le mot de passe
    return this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
      select: {
        id: true,
        fullname: true,
        email: true,
        phoneNumber: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }
  
  
}
