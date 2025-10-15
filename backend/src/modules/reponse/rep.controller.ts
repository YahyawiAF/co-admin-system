import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';

import { PaginatedResult } from 'prisma-pagination';
import { CreateResponseDto } from './dtos/createreponse.dtos';
import { UpdateResponseDto } from './dtos/updatereponse.dtos';
import { ResponseEntity } from './entity/reponse.entity';
import { ResponseService } from './rep.service';

@Controller('responses')
@ApiTags('responses')
export class ResponseController {
  constructor(private readonly responseService: ResponseService) {}

  @Post()
  @ApiCreatedResponse({ type: ResponseEntity })
  async create(
    @Body() createResponseDto: CreateResponseDto,
  ): Promise<ResponseEntity> {
    return await this.responseService.create(createResponseDto);
  }

  @Get()
  @ApiOkResponse({ type: ResponseEntity, isArray: true })
  async findMany(
    @Query('page') page: number,
    @Query('perPage') perPage: number,
  ): Promise<PaginatedResult<ResponseEntity>> {
    return await this.responseService.findMany({ page, perPage });
  }

  @Get('all')
  @ApiOkResponse({ type: ResponseEntity, isArray: true })
  async findAll(): Promise<ResponseEntity[]> {
    return await this.responseService.findAll();
  }

  @Get(':id')
  @ApiOkResponse({ type: ResponseEntity })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResponseEntity> {
    return await this.responseService.findOne(id);
  }

  @Patch(':id')
  @ApiCreatedResponse({ type: ResponseEntity })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateResponseDto: UpdateResponseDto,
  ): Promise<ResponseEntity> {
    return await this.responseService.update(id, updateResponseDto);
  }

  @Get('reclamation/:reclamationId')
  @ApiOkResponse({ type: ResponseEntity, isArray: true })
  async findByClaimsId(
    @Param('reclamationId', ParseUUIDPipe) reclamationId: string,
  ): Promise<ResponseEntity[]> {
    return await this.responseService.findByClaimsId(reclamationId);
  }

  @Delete(':id')
  @ApiOkResponse({ type: ResponseEntity })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResponseEntity> {
    return await this.responseService.remove(id);
  }
}
