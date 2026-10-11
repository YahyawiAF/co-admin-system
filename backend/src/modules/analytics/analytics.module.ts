import { Module } from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';
import { MemberModule } from '../member/member.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { PerformanceService } from './performance.service';

@Module({
  imports: [MemberModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, PerformanceService, PrismaService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
