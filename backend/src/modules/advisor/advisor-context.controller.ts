import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ContextService } from './context.service';

type FactBody = Parameters<ContextService['createFact']>[1];

/** Owner context for the advisor: checklist, location, calendar, neighbours, clientele, AI questions. */
@Controller('advisor')
export class AdvisorContextController {
  constructor(private readonly context: ContextService) {}

  @Get('missing')
  missing(@Query('facilityId') facilityId?: string) {
    return this.context.missing(facilityId);
  }

  @Get('location')
  location(@Query('facilityId') facilityId?: string) {
    return this.context.location(facilityId);
  }

  @Patch('location')
  setLocation(
    @Query('facilityId') facilityId: string | undefined,
    @Body() body: { input?: string; latitude?: number | null; longitude?: number | null },
  ) {
    return this.context.setLocation(facilityId, body);
  }

  /** Places around the facility from OpenStreetMap (free, no key). */
  @Get('nearby')
  nearby(@Query('facilityId') facilityId?: string, @Query('radius') radius?: string) {
    return this.context.nearby(facilityId, Number(radius) || undefined);
  }

  @Get('facts')
  facts(@Query('facilityId') facilityId?: string) {
    return this.context.facts(facilityId);
  }

  @Post('facts')
  createFact(@Query('facilityId') facilityId: string | undefined, @Body() body: FactBody) {
    return this.context.createFact(facilityId, body);
  }

  @Post('facts/holidays')
  seedHolidays(@Query('facilityId') facilityId?: string) {
    return this.context.seedHolidays(facilityId);
  }

  @Patch('facts/:id')
  updateFact(@Param('id') id: string, @Body() body: FactBody) {
    return this.context.updateFact(id, body);
  }

  @Delete('facts/:id')
  deleteFact(@Param('id') id: string) {
    return this.context.deleteFact(id);
  }

  @Get('questions')
  questions(@Query('facilityId') facilityId?: string) {
    return this.context.questions(facilityId);
  }

  @Patch('questions/:id')
  answerQuestion(
    @Param('id') id: string,
    @Body() body: { answer?: string | null; status?: string },
  ) {
    return this.context.answerQuestion(id, body);
  }
}
