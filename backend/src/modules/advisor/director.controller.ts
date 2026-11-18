import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { DirectorService } from './director.service';

type EntryBody = Parameters<DirectorService['createEntry']>[1];

/** Directeur: the business mastermind (goal, memory, corners). */
@Controller('director')
export class DirectorController {
  constructor(private readonly director: DirectorService) {}

  @Get()
  overview(@Query('facilityId') facilityId?: string) {
    return this.director.overview(facilityId);
  }

  /** One JSON with memory + numbers + the answer format, to paste into a Claude chat. */
  @Get('export')
  exportForClaude(@Query('facilityId') facilityId?: string) {
    return this.director.exportForClaude(facilityId);
  }

  @Post('update/preview')
  previewUpdate(@Query('facilityId') facilityId: string | undefined, @Body() body: { json?: unknown }) {
    return this.director.previewUpdate(facilityId, body);
  }

  @Post('update')
  applyUpdate(@Query('facilityId') facilityId: string | undefined, @Body() body: { json?: unknown }) {
    return this.director.applyUpdate(facilityId, body);
  }

  @Patch('goal')
  setGoal(@Query('facilityId') facilityId: string | undefined, @Body() body: { profit?: number; date?: string | null }) {
    return this.director.setGoal(facilityId, body);
  }

  @Post('entries')
  createEntry(@Query('facilityId') facilityId: string | undefined, @Body() body: EntryBody) {
    return this.director.createEntry(facilityId, body);
  }

  @Post('entries/import')
  importEntries(@Query('facilityId') facilityId: string | undefined, @Body() body: { text?: string }) {
    return this.director.importEntries(facilityId, body);
  }

  @Patch('entries/:id')
  updateEntry(@Param('id') id: string, @Body() body: EntryBody) {
    return this.director.updateEntry(id, body);
  }

  @Delete('entries/:id')
  deleteEntry(@Param('id') id: string) {
    return this.director.deleteEntry(id);
  }

  @Post('corners')
  addCorner(@Query('facilityId') facilityId: string | undefined, @Body() body: { name?: string }) {
    return this.director.addCorner(facilityId, body);
  }

  @Delete('corners/:id')
  removeCorner(@Query('facilityId') facilityId: string | undefined, @Param('id') id: string) {
    return this.director.removeCorner(facilityId, id);
  }
}
