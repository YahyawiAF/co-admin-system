import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AnalyticsService } from './analytics.service';
import { PerformanceService, PerformanceSettings } from './performance.service';
import { OutreachService } from './outreach.service';
import { CampaignService } from './campaign.service';
import { NewcomersService } from './newcomers.service';
import { ForecastService } from './forecast.service';
import { FinanceYearService } from './finance-year.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly performance: PerformanceService,
    private readonly outreach: OutreachService,
    private readonly campaigns: CampaignService,
    private readonly newcomers: NewcomersService,
    private readonly forecasts: ForecastService,
    private readonly financeYear: FinanceYearService,
  ) {}

  @Get('performance/settings')
  performanceSettings(@Query('facilityId') facilityId?: string) {
    return this.performance.settings(facilityId);
  }

  @Patch('performance/settings')
  updatePerformanceSettings(
    @Query('facilityId') facilityId: string | undefined,
    @Body() body: Partial<Omit<PerformanceSettings, 'facilityId'>>,
  ) {
    return this.performance.updateSettings(facilityId, body);
  }

  @Get('performance/targets')
  performanceTargets(
    @Query('facilityId') facilityId?: string,
    @Query('year') year?: string,
  ) {
    return this.performance.targets(
      facilityId,
      Number(year) || new Date().getFullYear(),
    );
  }

  @Put('performance/targets')
  setPerformanceTarget(
    @Body()
    body: {
      facilityId?: string;
      year: number;
      month: number;
      revenue?: number | null;
      netRevenue?: number | null;
      occupancyPct?: number | null;
    },
  ) {
    return this.performance.setTarget(body);
  }

  @Get('performance/overview')
  performanceOverview(
    @Query('facilityId') facilityId?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    return this.performance.overview({
      facilityId,
      year: Number(year) || undefined,
      month: Number(month) || undefined,
    });
  }

  @Get('performance/forecast')
  performanceForecast(
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('facilityId') facilityId?: string,
  ) {
    return this.forecasts.forecast({ year: Number(year) || undefined, month: Number(month) || undefined, facilityId });
  }

  /** Download the forecast and the numbers behind it: `format=csv` (day by day) or json (everything). */
  @Get('performance/forecast/export')
  async performanceForecastExport(
    @Res() res: Response,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('format') format?: string,
    @Query('facilityId') facilityId?: string,
  ) {
    const x = await this.forecasts.exportForecast({ year: Number(year) || undefined, month: Number(month) || undefined, format, facilityId });
    res.setHeader('Content-Type', x.type);
    res.setHeader('Content-Disposition', `attachment; filename="${x.filename}"`);
    // The admin app runs on another origin: let it read the file name
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.setHeader('Cache-Control', 'no-store');
    res.send(x.body);
  }

  /** Stored predictions of the last finished months against what happened. */
  @Get('performance/forecast/accuracy')
  performanceForecastAccuracy(@Query('facilityId') facilityId?: string) {
    return this.forecasts.accuracy(facilityId);
  }

  @Get('performance/changes')
  performanceChanges(@Query('facilityId') facilityId?: string) {
    return this.forecasts.changes(facilityId);
  }

  @Post('performance/changes/answer')
  answerPerformanceChange(
    @Query('facilityId') facilityId: string | undefined,
    @Body() body: { metric?: string; direction?: string; from?: string; to?: string; cause?: string; note?: string },
  ) {
    return this.forecasts.answerChange(facilityId, body);
  }

  /** Days that peaked or dropped with no known reason (last 60 days). */
  @Get('performance/unusual-days')
  unusualDays(@Query('facilityId') facilityId?: string) {
    return this.financeYear.unusual(facilityId);
  }

  @Post('performance/unusual-days/answer')
  answerUnusualDay(@Query('facilityId') facilityId: string | undefined, @Body() body: { day?: string; reason?: string; note?: string }) {
    return this.financeYear.answerUnusual(facilityId, body);
  }

  /** The school year (September → August) as one curve, rent per month and the summer reserve. */
  @Get('performance/school-year')
  schoolYear(@Query('facilityId') facilityId?: string) {
    return this.financeYear.schoolYear(facilityId);
  }

  /** Café of a month: DT per visit, change of habit, days, products. */
  @Get('performance/cafe')
  cafe(@Query('year') year?: string, @Query('month') month?: string, @Query('facilityId') facilityId?: string) {
    return this.financeYear.cafe(facilityId, Number(year) || undefined, Number(month) || undefined);
  }

  @Get('performance/levers')
  performanceLevers(@Query('facilityId') facilityId?: string) {
    return this.forecasts.levers(facilityId);
  }

  @Get('performance/insights')
  performanceInsights(@Query('facilityId') facilityId?: string) {
    return this.performance.insights(facilityId);
  }

  @Get('performance/offers')
  performanceOffers(@Query('memberIds') memberIds?: string) {
    return this.performance.offers(
      (memberIds || '').split(',').map((s) => s.trim()).filter(Boolean),
    );
  }

  @Get('outreach')
  outreachList(@Query('facilityId') facilityId?: string) {
    return this.outreach.list(facilityId);
  }

  /** Finance → Nouveaux: first visits, returns within 14 days, what goes with coming back. */
  @Get('newcomers')
  newcomersOverview(@Query('weeks') weeks?: string) {
    return this.newcomers.overview({ weeks: Number(weeks) || undefined });
  }

  /** Finance → Nouveaux: newcomers list (NOT_BACK | NEW | BACK), paginated, with relance message. */
  @Get('newcomers/list')
  newcomersList(
    @Query('status') status?: string,
    @Query('days') days?: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return this.outreach.newcomersList({
      status,
      days: Number(days) || undefined,
      page: Number(page) || undefined,
      perPage: Number(perPage) || undefined,
    });
  }

  /** Relances: why the member stopped coming (+ recall date). */
  @Post('outreach/away-reason')
  outreachAwayReason(@Body() body: { memberId?: string; reason?: string | null; recallAt?: string | null }) {
    return this.outreach.setAwayReason(body);
  }

  @Post('outreach/log')
  outreachLog(
    @Body() body: { memberId?: string; reason?: string; channel?: string; message?: string; contactedAt?: string | null },
  ) {
    return this.outreach.log(body);
  }

  /** Relances: several people reached the same way (WhatsApp group, at the desk…). */
  @Post('outreach/log-many')
  outreachLogMany(
    @Body() body: { items?: Array<{ memberId?: string; reason?: string }>; channel?: string; message?: string },
  ) {
    return this.outreach.logMany(body);
  }

  /** Check-in: the relance to do with this member, if any. */
  /** Relances modal: member, contacts with answers, last visit, abonnement. */
  @Get('outreach/member/:memberId/history')
  outreachHistory(@Param('memberId') memberId: string) {
    return this.outreach.history(memberId);
  }

  @Get('outreach/member/:memberId')
  outreachForMember(@Param('memberId') memberId: string, @Query('facilityId') facilityId?: string) {
    return this.outreach.forMember(memberId, facilityId);
  }

  /** Relances: staff mark a member as contacted — answer, note, follow-up date. */
  @Post('outreach/answer')
  outreachAnswer(
    @Body()
    body: {
      memberId?: string;
      reason?: string;
      outreachId?: string;
      outcome?: string;
      note?: string | null;
      followUpAt?: string | null;
      channel?: string | null;
    },
  ) {
    return this.outreach.answer(body);
  }

  /** Relances → Suivi: contacted members and whether they converted (OPEN | CLOSED, paginated). */
  @Get('outreach/suivi')
  outreachSuivi(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return this.outreach.suivi({ status, page: Number(page) || undefined, perPage: Number(perPage) || undefined });
  }

  /** Relances → Suivi: close by hand (WON | LOST). */
  @Post('outreach/:id/close')
  outreachClose(@Param('id') id: string, @Body() body: { result?: string }) {
    return this.outreach.close(id, body.result);
  }

  /** Relances → Suivi: undo a hand-made close. */
  @Post('outreach/:id/reopen')
  outreachReopen(@Param('id') id: string) {
    return this.outreach.reopen(id);
  }

  /** Saved relances (e.g. from an AI suggestion) with their progress. */
  @Get('outreach/campaigns')
  campaignList(@Query('facilityId') facilityId?: string) {
    return this.campaigns.list(facilityId);
  }

  /** People of a list, to pick one by one. */
  @Get('outreach/candidates')
  campaignCandidates(
    @Query('facilityId') facilityId?: string,
    @Query('segment') segment?: string,
    @Query('groupId') groupId?: string,
  ) {
    return this.campaigns.candidates(facilityId, segment, groupId || null);
  }

  /** "Relance passée": abonnement taken since that day? */
  @Get('outreach/past-check')
  outreachPastCheck(@Query('memberId') memberId?: string, @Query('date') date?: string) {
    return this.outreach.pastCheck(memberId, date);
  }

  @Get('outreach/segments')
  campaignSegments(@Query('facilityId') facilityId?: string, @Query('groupId') groupId?: string) {
    return this.campaigns.segmentCounts(facilityId, groupId || null);
  }

  @Post('outreach/campaigns')
  campaignCreate(
    @Query('facilityId') facilityId: string | undefined,
    @Body() body: Parameters<CampaignService['create']>[1],
  ) {
    return this.campaigns.create(facilityId, body);
  }

  @Get('outreach/campaigns/:id')
  campaignDetail(@Param('id') id: string) {
    return this.campaigns.detail(id);
  }

  @Patch('outreach/campaigns/:id')
  campaignUpdate(
    @Param('id') id: string,
    @Body() body: { title?: string; message?: string; status?: string },
  ) {
    return this.campaigns.update(id, body);
  }

  @Delete('outreach/campaigns/:id')
  campaignDelete(@Param('id') id: string) {
    return this.campaigns.remove(id);
  }

  @Post('outreach/campaigns/:id/log')
  campaignLog(
    @Param('id') id: string,
    @Body() body: { memberId?: string; channel?: string; message?: string },
  ) {
    return this.campaigns.log(id, body);
  }

  @Post('outreach/campaigns/:id/members')
  campaignMembers(@Param('id') id: string, @Body() body: { add?: string[]; remove?: string[] }) {
    return this.campaigns.members(id, body);
  }

  @Post('outreach/campaigns/:id/answer')
  campaignAnswer(
    @Param('id') id: string,
    @Body() body: { memberId?: string; outcome?: string | null; note?: string | null; followUpAt?: string | null },
  ) {
    return this.campaigns.answer(id, body);
  }

  @Post('outreach/push')
  outreachPush(
    @Body() body: { memberId?: string; reason?: string; message?: string; title?: string },
  ) {
    return this.outreach.sendPush(body);
  }

  @Get('finance/monthly')
  financeMonthly(@Query('year') year?: string) {
    return this.analytics.financeMonthly(
      Number(year) || new Date().getFullYear(),
    );
  }

  @Get('finance/month-days')
  financeMonthDays(
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const now = new Date();
    return this.analytics.financeMonthDays(
      Number(year) || now.getFullYear(),
      Number(month) || now.getMonth() + 1,
    );
  }

  @Get('products/performance')
  productsPerformance(@Query('from') from?: string, @Query('to') to?: string) {
    return this.analytics.productsPerformance(from, to);
  }

  @Get('services/demand')
  servicesDemand(@Query('from') from?: string, @Query('to') to?: string) {
    return this.analytics.servicesDemand(from, to);
  }

  @Get('services/:priceId/clients')
  serviceClients(
    @Param('priceId') priceId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.serviceClients(priceId, from, to);
  }

  @Get('spaces/usage')
  spacesUsage(@Query('from') from?: string, @Query('to') to?: string) {
    return this.analytics.spacesUsage(from, to);
  }

  @Get('spaces/:spaceId/clients')
  spaceClients(
    @Param('spaceId') spaceId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.spaceClients(spaceId, from, to);
  }

  @Get('attendance/regulars')
  attendanceRegulars(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.analytics.attendanceRegulars({
      from,
      to,
      limit: Number(limit) || undefined,
      organizationId,
    });
  }

  @Get('members/top-points')
  topPoints(
    @Query('limit') limit?: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.analytics.topPoints({
      limit: Number(limit) || undefined,
      organizationId,
    });
  }

  @Get('traffic/weekly')
  trafficWeekly(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.analytics.trafficWeekly({ from, to, organizationId });
  }

  @Get('traffic/day')
  trafficDay(
    @Query('date') date?: string,
    @Query('compare') compare?: string,
    @Query('count') count?: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.analytics.trafficDay({
      date,
      compare: compare === 'previous' ? 'previous' : 'weekday',
      count: Number(count) || undefined,
      organizationId,
    });
  }

  @Get('members')
  members(
    @Query('topServiceId') topServiceId?: string,
    @Query('topSpaceId') topSpaceId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.membersByTop({
      topServiceId,
      topSpaceId,
      from,
      to,
    });
  }
}
