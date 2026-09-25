import { Controller, Get, Param, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

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
