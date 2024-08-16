import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { StatusService } from './status.service';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { StatusEntity } from './entities/status.entity';
import { ApiPaginatedResponse } from 'common/decorator/ApiPaginatedResponse';
import { AddStatusDto } from './dtos/create-status.dto';
import { PaginatedResult } from 'prisma-pagination';
import { Roles } from 'common/decorator/roles.decorator';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from 'common/guards/accessToken.guard';
import { RolesGuard } from 'common/guards/auth.guard';
@ApiTags('status')
@Controller('status')
export class StatusController {
  constructor(private statusService: StatusService) {}

  @Get()
  @Roles([Role.ADMIN, Role.USER])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiPaginatedResponse(AddStatusDto)
  @ApiBearerAuth()
  @ApiOkResponse({ type: StatusEntity, isArray: true })
  async findAll(
    @Query('page') page: number,
    @Query('perPage') perPage: number,
  ): Promise<PaginatedResult<AddStatusDto>> {
    return await this.statusService.findMany({ perPage, page });
  }
}
