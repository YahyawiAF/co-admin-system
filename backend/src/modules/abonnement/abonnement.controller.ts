import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpStatus,
} from '@nestjs/common';
import { AbonnementService } from './abonnement.service';
import { AddAbonnementDto } from './dtos/createAbonnement.dto';
import { UpdateAbonnementDto } from './dtos/updateAbonnement.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AbonnementEntity } from './entities/abonnement.entity';
import { PaginatedResult } from 'common/dtos/PaginatedOutputDto';

@ApiTags('Abonnements')
@Controller('abonnements')
export class AbonnementController {
  constructor(private readonly abonnementService: AbonnementService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new subscription' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Subscription created successfully',
    type: AbonnementEntity,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input or subscription already exists',
  })
  create(@Body() createAbonnementDto: AddAbonnementDto) {
    return this.abonnementService.create(createAbonnementDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all subscriptions with pagination' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of subscriptions',
    type: [AbonnementEntity],
  })
  findAll(
    @Query('page') page?: number,
    @Query('perPage') perPage?: number,
    @Query('search') search?: string,
  ): Promise<PaginatedResult<AbonnementEntity>> {
    return this.abonnementService.findMany({
      page,
      perPage: perPage || 20,
      where: search
        ? {
            OR: [
              { members: { firstName: { contains: search } } },
              { members: { lastName: { contains: search } } },
              { price: { name: { contains: search } } },
            ],
          }
        : undefined,
    });
  }

  @Get('all')
  @ApiOperation({ summary: 'Get all subscriptions without pagination' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of all subscriptions',
    type: [AbonnementEntity],
  })
  findAllWithoutPagination() {
    return this.abonnementService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a subscription by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscription details',
    type: AbonnementEntity,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Subscription not found',
  })
  findOne(@Param('id') id: string) {
    return this.abonnementService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a subscription' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscription updated successfully',
    type: AbonnementEntity,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Subscription not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input',
  })
  update(
    @Param('id') id: string,
    @Body() updateAbonnementDto: UpdateAbonnementDto,
  ) {
    return this.abonnementService.update(id, updateAbonnementDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a subscription' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscription deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Subscription not found',
  })
  remove(@Param('id') id: string) {
    return this.abonnementService.remove(id);
  }
}
