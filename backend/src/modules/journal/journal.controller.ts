// src/journal/journal.controller.ts

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
  HttpStatus,
} from '@nestjs/common';
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
import { PaginatedResult } from 'common/dtos/PaginatedOutputDto';
import { startOfDay, endOfDay } from 'date-fns';
import { Prisma } from '@prisma/client';
import { ErrorCode, GeneralException } from '@/exceptions';

@Controller('journal')
@ApiTags('journal')
export class JournalController {
  constructor(private readonly journalService: JournalService) {}

  @Post()
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: JournalEntity })
  async create(@Body() dto: AddJournalDto) {
    try {
      const journal = await this.journalService.create(dto);
      if (!journal.members) {
        throw new GeneralException(
          HttpStatus.INTERNAL_SERVER_ERROR,
          ErrorCode.INTERNAL_ERROR,
          'Member data is missing',
        );
      }
      return new JournalEntity({
        ...journal,
        members: {
          ...journal.members,
          fullName: `${journal.members.firstName} ${journal.members.lastName}`,
          fullNameWithEmail: `${journal.members.firstName} ${journal.members.lastName} <${journal.members.email}>`,
        },
      });
    } catch (error) {
      // Ensure the error is properly propagated
      if (error instanceof GeneralException) {
        throw error;
      }
      throw new GeneralException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.INTERNAL_ERROR,
        'An unexpected error occurred',
      );
    }
  }

  @Get()
  // @Roles([Role.ADMIN])
  // @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: JournalEntity, isArray: true })
  async findMany(
    @Query('page') page = 1,
    @Query('perPage') perPage = 20,
    @Query('journalDate') journalDate?: string,
  ): Promise<PaginatedResult<JournalEntity>> {
    let where: Prisma.JournalWhereInput | undefined;

    if (journalDate) {
      const date = new Date(journalDate);
      where = {
        registredTime: {
          gte: startOfDay(date),
          lt: endOfDay(date),
        },
      };
    }

    const result = await this.journalService.findMany({ page, perPage, where });

    return {
      ...result,
      data: result.data.map((journal) => new JournalEntity(journal)),
    };
  }

  @Get('all')
  // @Roles([Role.ADMIN])
  // @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: JournalEntity, isArray: true })
  async findAll(): Promise<JournalEntity[]> {
    const result = await this.journalService.findMany({
      page: 1,
      perPage: 9999,
    });
    return result.data.map((journal) => new JournalEntity(journal));
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: JournalEntity })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return new JournalEntity(await this.journalService.findOne(id));
  }

  @Patch(':id')
  // @UseGuards(JwtAuthGuard)
  // @Roles([Role.ADMIN])
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: JournalEntity })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateJournalDto: UpdateJournalDto,
  ) {
    const journal = await this.journalService.update(id, updateJournalDto);
    return new JournalEntity({
      ...journal,
      members: {
        ...journal.members,
        fullName: `${journal.members.firstName} ${journal.members.lastName}`,
        fullNameWithEmail: `${journal.members.firstName} ${journal.members.lastName} <${journal.members.email}>`,
      },
    });
  }

  @Delete(':id')
  // @UseGuards(JwtAuthGuard)
  // @Roles([Role.ADMIN])
  @ApiBearerAuth()
  @ApiOkResponse({ type: JournalEntity })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    const journal = await this.journalService.remove(id);
    return new JournalEntity(journal);
  }
}
