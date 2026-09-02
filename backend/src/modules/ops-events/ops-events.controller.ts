import { Controller, Get, Query } from '@nestjs/common';
import { OpsEventsService } from './ops-events.service';

@Controller('ops-events')
export class OpsEventsController {
  constructor(private readonly opsEvents: OpsEventsService) {}

  @Get('seat-history')
  seatHistory(@Query('date') date?: string) {
    return this.opsEvents.seatHistory(date);
  }

  @Get()
  list(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('type') type?: string,
  ) {
    return this.opsEvents.list({ from, to, type });
  }
}
