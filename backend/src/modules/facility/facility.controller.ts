import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Put,
    Delete,
  } from '@nestjs/common';
  import { FacilityService } from './facility.service';
import { UpdateFacilityDto } from './dtos/updateFac.dto';
import { CreateFacilityDto } from './dtos/createfac.dto';
  
  @Controller('facilities')
  export class FacilityController {
    constructor(private readonly facilityService: FacilityService) {}
  
    @Post()
    async create(@Body() createFacilityDto: CreateFacilityDto) {
      return this.facilityService.create(createFacilityDto);
    }
  
    @Get()
    async findAll() {
      return this.facilityService.findAll();
    }
  
    @Get(':id')
    async findOne(@Param('id') id: string) {
      return this.facilityService.findOne(id);
    }
  
    @Put(':id')
    async update(
      @Param('id') id: string,
      @Body() updateFacilityDto: UpdateFacilityDto,
    ) {
      return this.facilityService.update(id, updateFacilityDto);
    }
  
    @Delete(':id')
    async remove(@Param('id') id: string) {
      return this.facilityService.remove(id);
    }
  }