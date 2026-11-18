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

  @Patch('priorities/:id')
  closePriority(@Query('facilityId') facilityId: string | undefined, @Param('id') id: string, @Body() body: { status?: string }) {
    return this.director.closePriority(facilityId, id, body);
  }

  @Patch('priorities/:id/legs/:index')
  setLeg(
    @Query('facilityId') facilityId: string | undefined,
    @Param('id') id: string,
    @Param('index') index: string,
    @Body() body: { targetId?: string | null; status?: string },
  ) {
    return this.director.setLeg(facilityId, id, Number(index), body);
  }

  @Patch('priorities/:id/steps/:index')
  setStep(@Query('facilityId') facilityId: string | undefined, @Param('id') id: string, @Param('index') index: string, @Body() body: { done?: boolean }) {
    return this.director.setStep(facilityId, id, Number(index), body);
  }

  @Patch('watches/:id/stop')
  stopWatch(@Query('facilityId') facilityId: string | undefined, @Param('id') id: string) {
    return this.director.stopWatch(facilityId, id);
  }

  @Patch('needs/:key')
  setNeed(@Query('facilityId') facilityId: string | undefined, @Param('key') key: string, @Body() body: { stage?: string }) {
    return this.director.setNeed(facilityId, key, body);
  }

  @Post('learn')
  addLearn(@Query('facilityId') facilityId: string | undefined, @Body() body: { text?: string }) {
    return this.director.addLearn(facilityId, body);
  }

  @Delete('learn/:id')
  removeLearn(@Query('facilityId') facilityId: string | undefined, @Param('id') id: string) {
    return this.director.removeLearn(facilityId, id);
  }

  @Post('lessons/:id/contest')
  contestLesson(@Query('facilityId') facilityId: string | undefined, @Param('id') id: string, @Body() body: { text?: string }) {
    return this.director.contestLesson(facilityId, id, body);
  }

  /** Principles to take to another project (directeur-lessons/v1). */
  @Get('lessons/file')
  lessonsFile(@Query('facilityId') facilityId?: string) {
    return this.director.lessonsFile(facilityId);
  }

  @Post('lessons/file')
  importLessonsFile(@Query('facilityId') facilityId: string | undefined, @Body() body: { json?: unknown }) {
    return this.director.importLessonsFile(facilityId, body);
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
