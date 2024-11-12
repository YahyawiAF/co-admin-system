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
} from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { JournalService } from './journal.service';
import { AddJournalDto } from './dtos/createJournal.dto';
import { UpdateJournalDto } from './dtos/updateJournal.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JournalEntity } from './entities/journal.entity';
import { JwtAuthGuard } from '../../../common/guards/accessToken.guard';
import { Role } from '@prisma/client';
import { RolesGuard } from '../../../common/guards/auth.guard';
import { Roles } from '../../../common/decorator/roles.decorator';
import { PaginatedResult } from 'prisma-pagination';

@Controller('Journal')
@ApiTags('journal')
export class JournalController {
  constructor(private readonly JournalService: JournalService) {}

  @Post()
  // @Roles([Role.ADMIN])
  // @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: JournalEntity })
  async create(@Body() addKeyword: AddJournalDto) {
    return new JournalEntity(await this.JournalService.create(addKeyword));
  }
  @Get()
  // @Roles([Role.ADMIN])
  // @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: JournalEntity, isArray: true })
  async findAllkeyword(
    @Query('page') page: number,
    @Query('perPage') perPage: number,
  ): Promise<PaginatedResult<AddJournalDto>> {
    return await this.JournalService.findMany({ perPage, page });
  }

  @Get('all')
  // @Roles([Role.ADMIN])
  // @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: JournalEntity, isArray: true })
  async findAll(): Promise<Array<UpdateJournalDto>> {
    return await this.JournalService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: JournalEntity })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return new JournalEntity(await this.JournalService.findOne(id));
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: JournalEntity })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: AddJournalDto,
  ) {
    return new JournalEntity(
      await this.JournalService.update(id, updateUserDto),
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: JournalEntity })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return new JournalEntity(await this.JournalService.remove(id));
  }
}
