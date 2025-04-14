// src/users/users.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import { UsersService } from './user.service';
import { CreateUserDto, AddUserDto } from './dtos/create-user.dto';

import { UpdateUserDto } from './dtos/update-user.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserEntity } from './entities/user.entity';
import { JwtAuthGuard } from '../../../common/guards/accessToken.guard';
import { Role } from '@prisma/client';
import { RolesGuard } from '../../../common/guards/auth.guard';
import { Roles } from '../../../common/decorator/roles.decorator';
import { PaginatedResult } from 'prisma-pagination';
import { LoginDto } from '../auth/dto/login.dto';
import { AuthEntity } from '../auth/entity/auth.entity';
import { ChangePasswordDto } from './dtos/change-password.dto';
@Controller('users')
@ApiTags('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles([Role.ADMIN])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: UserEntity })
  async create(@Body() addUser: AddUserDto) {
    return new UserEntity(await this.usersService.addUser(addUser));
  }

  @Post('/create')
  @Roles([Role.ADMIN])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: UserEntity })
  async createAdmin(@Body() addUser: CreateUserDto) {
    return new UserEntity(await this.usersService.create(addUser));
  }

  @Get()
  @Roles([Role.ADMIN])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: UserEntity, isArray: true })
  async findAll(
    @Query('page') page: number,
    @Query('perPage') perPage: number,
  ): Promise<PaginatedResult<AddUserDto>> {
    const paginationData = await this.usersService.findMany({ perPage, page });
    const users = paginationData.data.map((user) => new UserEntity(user));
    paginationData.data = users;
    return paginationData;
  }

  @Get('all')
  @Roles([Role.ADMIN])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: UserEntity, isArray: true })
  async findOneByEmail(): Promise<Array<AddUserDto>> {
    const users = await this.usersService.findAll();
    return users.map((user) => new UserEntity(user));
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: UserEntity })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return new UserEntity(await this.usersService.findOne(id));
  }
  @Patch('change-password')
@UseGuards(JwtAuthGuard)
@Roles([Role.ADMIN, Role.USER])
@ApiBearerAuth()
@ApiOkResponse({ type: UserEntity })
async changePassword(
  @Req() req,
  @Body() changePasswordDto: ChangePasswordDto
) {
  const userId = req.user.userId; // Accéder à userId depuis le payload JWT
  const updatedUser = await this.usersService.changePassword(
    userId,
    changePasswordDto.oldPassword,
    changePasswordDto.newPassword
  );
  return new UserEntity(updatedUser);
}
  @Patch(':id')
  @Roles([Role.ADMIN, Role.USER])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: UserEntity })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return new UserEntity(await this.usersService.update(id, updateUserDto));
  }

  @Delete(':id')
  @Roles([Role.ADMIN])
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: UserEntity })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return new UserEntity(await this.usersService.remove(id));
  }

 
}
