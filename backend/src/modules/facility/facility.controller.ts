import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Patch,
  Delete,
  Query,
} from '@nestjs/common';
import { FacilityService } from './facility.service';
import { UpdateFacilityDto } from './dtos/updateFac.dto';
import { PriceCategory, SpaceReserveMode } from '@prisma/client';

@Controller('facilities')
export class FacilityController {
  constructor(private readonly facilityService: FacilityService) {}

  @Post()
  create() {
    return this.facilityService.create();
  }

  @Get()
  findAll() {
    return this.facilityService.findAll();
  }

  @Get('layout')
  layout(@Query('facilityId') facilityId?: string) {
    return this.facilityService.listLayout(facilityId);
  }

  @Get('occupancy')
  occupancy() {
    return this.facilityService.occupancy();
  }

  @Post('spaces')
  createSpace(
    @Body()
    body: {
      facilityId: string;
      name: string;
      floorPlanUrl?: string;
      capacityNormal?: number;
      category?: PriceCategory;
    },
  ) {
    return this.facilityService.createSpace(body);
  }

  @Patch('spaces/:id')
  updateSpace(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      name: string;
      floorPlanUrl: string | null;
      sortOrder: number;
      capacityNormal: number;
      category: PriceCategory;
      wifiSsid: string | null;
      wifiPassword: string | null;
      openForReservation: boolean;
      reserveMode: SpaceReserveMode;
      galleryUrls: string[];
    }>,
  ) {
    return this.facilityService.updateSpace(id, body);
  }

  @Delete('spaces/:id')
  deleteSpace(@Param('id') id: string) {
    return this.facilityService.deleteSpace(id);
  }

  @Post('tables')
  createTable(
    @Body()
    body: {
      spaceId: string;
      name: string;
      imageUrl?: string;
      galleryUrls?: string[];
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      seatCount?: number;
      overflowCount?: number;
    },
  ) {
    return this.facilityService.createTable(body);
  }

  @Patch('tables/:id')
  updateTable(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      name: string;
      imageUrl: string | null;
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
      sortOrder: number;
      galleryUrls: string[];
    }>,
  ) {
    return this.facilityService.updateTable(id, body);
  }

  @Delete('tables/:id')
  deleteTable(@Param('id') id: string) {
    return this.facilityService.deleteTable(id);
  }

  @Post('seats')
  createSeat(
    @Body()
    body: {
      spaceId: string;
      tableId?: string;
      label: string;
      offsetX?: number;
      offsetY?: number;
      isOverflow?: boolean;
    },
  ) {
    return this.facilityService.createSeat(body);
  }

  @Patch('seats/:id')
  updateSeat(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      label: string;
      offsetX: number;
      offsetY: number;
      isOverflow: boolean;
      isActive: boolean;
      tableId: string | null;
    }>,
  ) {
    return this.facilityService.updateSeat(id, body);
  }

  @Delete('seats/:id')
  deleteSeat(@Param('id') id: string) {
    return this.facilityService.deleteSeat(id);
  }

  @Post('walls')
  createWall(
    @Body()
    body: {
      spaceId: string;
      label?: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      rotation?: number;
    },
  ) {
    return this.facilityService.createWall(body);
  }

  @Patch('walls/:id')
  updateWall(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      label: string | null;
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
    }>,
  ) {
    return this.facilityService.updateWall(id, body);
  }

  @Delete('walls/:id')
  deleteWall(@Param('id') id: string) {
    return this.facilityService.deleteWall(id);
  }

  @Post('fixtures')
  createFixture(
    @Body()
    body: {
      spaceId: string;
      kind: string;
      label?: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      rotation?: number;
    },
  ) {
    return this.facilityService.createFixture({
      ...body,
      kind: body.kind as import('@prisma/client').FixtureKind,
    });
  }

  @Patch('fixtures/:id')
  updateFixture(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      kind: import('@prisma/client').FixtureKind;
      label: string | null;
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
    }>,
  ) {
    return this.facilityService.updateFixture(id, body);
  }

  @Delete('fixtures/:id')
  deleteFixture(@Param('id') id: string) {
    return this.facilityService.deleteFixture(id);
  }

  @Get(':id/away-arrivals')
  awayArrivals(@Param('id') id: string) {
    return this.facilityService.listAwayArrivals(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.facilityService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFacilityDto) {
    return this.facilityService.update(id, dto);
  }

  @Patch(':id')
  patch(@Param('id') id: string, @Body() dto: UpdateFacilityDto) {
    return this.facilityService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.facilityService.remove(id);
  }
}
