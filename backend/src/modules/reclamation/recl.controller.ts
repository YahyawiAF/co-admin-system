import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/accessToken.guard';
import { Role } from '@prisma/client';
import { Roles } from '../../../common/decorator/roles.decorator';
import { RolesGuard } from '../../../common/guards/auth.guard';
import { PaginatedResult } from 'prisma-pagination';
import { CreateReclamationDto } from './dtos/createreclamation.dtos';
import { UpdateReclamationDto } from './dtos/updatereclamation.dtos';
import { ReclamationEntity } from './entity/reclamation.entity';
import { ReclamationService } from './recl.service';

@Controller('reclamations')
@ApiTags('reclamations')
export class ReclamationController {
  constructor(private readonly reclamationService: ReclamationService) {}

  @Post()
  
  @ApiCreatedResponse({ type: ReclamationEntity })
  async create(@Body() createReclamationDto: CreateReclamationDto): Promise<ReclamationEntity> {
    return await this.reclamationService.create(createReclamationDto);
  }

  @Get()
  
  @ApiOkResponse({ type: ReclamationEntity, isArray: true })
  async findMany(
    @Query('page') page: number,
    @Query('perPage') perPage: number,
  ): Promise<PaginatedResult<ReclamationEntity>> {
    return await this.reclamationService.findMany({ page, perPage });
  }

  @Get('all')
 
  @ApiOkResponse({ type: ReclamationEntity, isArray: true })
  async findAll(): Promise<ReclamationEntity[]> {
    return await this.reclamationService.findAll();
  }

  @Get(':id')
  
  @ApiOkResponse({ type: ReclamationEntity })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ReclamationEntity> {
    return await this.reclamationService.findOne(id);
  }

  @Patch(':id')
  
  @ApiCreatedResponse({ type: ReclamationEntity })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateReclamationDto: UpdateReclamationDto,
  ): Promise<ReclamationEntity> {
    return await this.reclamationService.update(id, updateReclamationDto);
  }

  @Delete(':id')
  
  @ApiOkResponse({ type: ReclamationEntity })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<ReclamationEntity> {
    return await this.reclamationService.remove(id);
  }
}