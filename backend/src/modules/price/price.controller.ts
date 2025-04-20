import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Put,
    Delete,
  } from '@nestjs/common';
  import { PriceService } from './price.service';
  import { CreatePriceDto } from './dtos/create-price.dto';
  import { UpdatePriceDto } from './dtos/update-price.dto';
  
  @Controller('prices')
  export class PriceController {
    constructor(private readonly priceService: PriceService) {}
  
    @Post()
    async create(@Body() createPriceDto: CreatePriceDto) {
      return this.priceService.create(createPriceDto);
    }
  
    @Get()
    async findAll() {
      return this.priceService.findAll();
    }
  
    @Get(':id')
    async findOne(@Param('id') id: string) {
      return this.priceService.findOne(id);
    }
  
    @Put(':id')
    async update(
      @Param('id') id: string,
      @Body() updatePriceDto: UpdatePriceDto,
    ) {
      return this.priceService.update(id, updatePriceDto);
    }
  
    @Delete(':id')
    async remove(@Param('id') id: string) {
      return this.priceService.remove(id);
    }
  }