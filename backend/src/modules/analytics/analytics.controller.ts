import { Body, Controller, Get, Param, Patch, Put, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { PerformanceService, PerformanceSettings } from './performance.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly performance: PerformanceService,
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

  @Get('performance/insights')
  performanceInsights(@Query('facilityId') facilityId?: string) {
    return this.performance.insights(facilityId);
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
