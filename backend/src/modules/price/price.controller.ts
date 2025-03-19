import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { PriceService } from './price.service';
import { CreatePriceDto } from './dtos/create-price.dto';
import { UpdatePriceDto } from './dtos/update-price.dto';
import { PriceEntity } from './entities/price.entity';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('prices')
@Controller('prices')
export class PriceController {
  constructor(private readonly priceService: PriceService) {}


  @Post('add') 
  async create(@Body() createPriceDto: CreatePriceDto): Promise<PriceEntity> {
    return this.priceService.create(createPriceDto);
  }

  
  @Get('all') 
  async findAll(): Promise<PriceEntity[]> {
    return this.priceService.findAll();
  }

  
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<PriceEntity> {
    return this.priceService.findOne(id);
  }

  @Put('update/:id') 
  async update(
    @Param('id') id: string,
    @Body() updatePriceDto: UpdatePriceDto,
  ): Promise<PriceEntity> {
    return this.priceService.update(id, updatePriceDto);
  }

  
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    return this.priceService.remove(id);
  }
}
