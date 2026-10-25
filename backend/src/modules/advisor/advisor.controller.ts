import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AdvisorService } from './advisor.service';

@Controller('advisor')
export class AdvisorController {
  constructor(private readonly advisor: AdvisorService) {}

  @Get('settings')
  settings(@Query('facilityId') facilityId?: string) {
    return this.advisor.settings(facilityId);
  }

  @Patch('settings')
  updateSettings(
    @Query('facilityId') facilityId: string | undefined,
    @Body() body: { businessContext?: string },
  ) {
    return this.advisor.updateSettings(facilityId, body);
  }

  /** Data problems that would make advice wrong (rules, no AI). */
  @Get('data-check')
  dataCheck(@Query('facilityId') facilityId?: string) {
    return this.advisor.dataCheck(facilityId);
  }

  /** The figures Claude would receive (free, no AI call). */
  @Get('snapshot')
  snapshot(@Query('facilityId') facilityId?: string, @Query('days') days?: string) {
    return this.advisor.snapshot(facilityId, Number(days) || undefined);
  }

  /** The full prompt (system + data + schema) to paste into claude.ai without an API key. */
  @Get('prompt')
  prompt(@Query('facilityId') facilityId?: string, @Query('days') days?: string) {
    return this.advisor.prompt(facilityId, Number(days) || undefined);
  }

  @Post('reports/import')
  importReport(
    @Query('facilityId') facilityId: string | undefined,
    @Body() body: { days?: number; result?: unknown },
  ) {
    return this.advisor.importReport(facilityId, body);
  }

  @Get('reports')
  reports(@Query('facilityId') facilityId?: string) {
    return this.advisor.reports(facilityId);
  }

  @Post('reports')
  generate(
    @Query('facilityId') facilityId: string | undefined,
    @Body() body: { days?: number },
  ) {
    return this.advisor.generate(facilityId, { days: body?.days });
  }

  @Get('reports/:id')
  report(@Param('id') id: string) {
    return this.advisor.report(id);
  }

  @Get('initiatives')
  initiatives(@Query('facilityId') facilityId?: string) {
    return this.advisor.initiatives(facilityId);
  }

  @Post('initiatives')
  createInitiative(
    @Query('facilityId') facilityId: string | undefined,
    @Body()
    body: {
      title?: string;
      description?: string;
      category?: string;
      startDate?: string;
      sourceReportId?: string;
      recommendationTitle?: string;
      metric?: string;
      targetPct?: number | null;
      cost?: number | null;
      targetKind?: string;
      targetDays?: number[];
      targetFromHour?: number | null;
      targetToHour?: number | null;
      targetSegment?: string | null;
      linkedKind?: string | null;
      linkedId?: string | null;
    },
  ) {
    return this.advisor.createInitiative(facilityId, body);
  }

  @Patch('initiatives/:id')
  updateInitiative(
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      description?: string | null;
      category?: string;
      startDate?: string;
      endDate?: string | null;
      metric?: string | null;
      targetPct?: number | null;
      cost?: number | null;
      ownerVerdict?: string | null;
      notes?: Array<{ date?: string; text?: string }>;
      targetKind?: string;
      targetDays?: number[];
      targetFromHour?: number | null;
      targetToHour?: number | null;
      targetSegment?: string | null;
      linkedKind?: string | null;
      linkedId?: string | null;
    },
  ) {
    return this.advisor.updateInitiative(id, body);
  }

  @Delete('initiatives/:id')
  deleteInitiative(@Param('id') id: string) {
    return this.advisor.deleteInitiative(id);
  }
}
