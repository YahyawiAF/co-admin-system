import { Module } from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';
import { MemberModule } from '../member/member.module';
import { ExpensesModule } from '../expense/expense.module';
import { PushModule } from '../push/push.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { PerformanceService } from './performance.service';
import { OutreachService } from './outreach.service';
import { CampaignService } from './campaign.service';
import { NewcomersService } from './newcomers.service';

@Module({
  imports: [MemberModule, ExpensesModule, PushModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, PerformanceService, OutreachService, CampaignService, NewcomersService, PrismaService],
  exports: [AnalyticsService, PerformanceService, OutreachService, CampaignService, NewcomersService],
})
export class AnalyticsModule {}
