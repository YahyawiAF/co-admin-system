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

  /** Bilan: six points of the business, with the solutions to try (rules + last AI analysis). */
  @Get('health')
  health(@Query('facilityId') facilityId?: string) {
    return this.advisor.health(facilityId);
  }

  /** « Adapter » a solution with the AI, from one sentence of the owner (nothing saved). */
  @Post('solutions/adapt')
  adapt(@Query('facilityId') facilityId: string | undefined, @Body() body: Record<string, unknown>) {
    return this.advisor.adapt(facilityId, body as never);
  }

  /** A promo, event, survey, relance, tarif or product used by the solution. */
  @Post('initiatives/:id/tools')
  addTool(@Param('id') id: string, @Body() body: { kind?: string; targetId?: string; stepIndex?: number | null }) {
    return this.advisor.addTool(id, body);
  }

  @Delete('initiatives/:id/tools/:linkId')
  removeTool(@Param('id') id: string, @Param('linkId') linkId: string) {
    return this.advisor.removeTool(id, linkId);
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
      objective?: string | null;
      hypothesis?: string | null;
      channels?: string[];
      steps?: Array<{ text?: string; done?: boolean }>;
      goalAmount?: number | null;
      area?: string | null;
      leverId?: string | null;
      tools?: unknown[];
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
      objective?: string | null;
      hypothesis?: string | null;
      channels?: string[];
      steps?: Array<{ text?: string; done?: boolean; doneAt?: string | null }>;
      manualFunnel?: Array<{ date?: string; channel?: string | null; reach?: number }>;
      interested?: number | null;
      paused?: boolean;
      drop?: { reason?: string } | null;
      goalAmount?: number | null;
      area?: string | null;
      leverId?: string | null;
      tools?: unknown[];
    },
  ) {
    return this.advisor.updateInitiative(id, body);
  }

  @Get('dismissals')
  dismissals(@Query('facilityId') facilityId?: string) {
    return this.advisor.dismissals(facilityId);
  }

  @Post('dismissals')
  dismiss(
    @Query('facilityId') facilityId: string | undefined,
    @Body() body: { title?: string; category?: string | null; leverId?: string | null; reason?: string },
  ) {
    return this.advisor.dismiss(facilityId, body);
  }

  @Delete('dismissals/:id')
  undismiss(@Param('id') id: string) {
    return this.advisor.undismiss(id);
  }

  /** Tracked share link for one channel (Story, WhatsApp…). */
  @Post('initiatives/:id/links')
  createLink(@Param('id') id: string, @Body() body: { channel?: string }) {
    return this.advisor.createLink(id, body?.channel ?? '');
  }

  @Delete('initiatives/:id/links/:linkId')
  deleteLink(@Param('id') id: string, @Param('linkId') linkId: string) {
    return this.advisor.deleteLink(id, linkId);
  }

  @Delete('initiatives/:id')
  deleteInitiative(@Param('id') id: string) {
    return this.advisor.deleteInitiative(id);
  }
}
