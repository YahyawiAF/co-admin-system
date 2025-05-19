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
import { PaginatedResult } from 'prisma-pagination';
import { startOfDay, endOfDay } from 'date-fns';

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
    @Query('journalDate') journalDate: string,
  ): Promise<PaginatedResult<AddJournalDto>> {
    const date = new Date(journalDate);

    // Create date range for filtering within the same day
    const startOfTheDay = startOfDay(date);
    const endOfTheDay = endOfDay(date);

    const where = {
      registredTime: {
        gte: startOfTheDay,
        lt: endOfTheDay,
      },
    };
    return await this.JournalService.findMany({ perPage, page, where });
  }

  @Get('all')
  //@Roles([Role.USER])
  //@UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: JournalEntity, isArray: true })
  async findAll(): Promise<Array<UpdateJournalDto>> {
    const journals = await this.JournalService.findAll();
    return journals.map((journal) => new JournalEntity(journal));
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: JournalEntity })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return new JournalEntity(await this.JournalService.findOne(id));
  }

  @Patch(':id')
  // @UseGuards(JwtAuthGuard)
  // @ApiBearerAuth()
  @ApiCreatedResponse({ type: JournalEntity })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateJournalDto: UpdateJournalDto, // Utiliser UpdateJournalDto
  ) {
    return new JournalEntity(
      await this.JournalService.update(id, updateJournalDto),
    );
  }

  @Delete(':id')
  // @UseGuards(JwtAuthGuard)
  // @ApiBearerAuth()
  @ApiOkResponse({ type: JournalEntity })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return new JournalEntity(await this.JournalService.remove(id));
  }
}
