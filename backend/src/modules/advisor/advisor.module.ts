import { Module } from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AdvisorController } from './advisor.controller';
import { AdvisorService } from './advisor.service';
import { SnapshotService } from './snapshot.service';

@Module({
  imports: [AnalyticsModule],
  controllers: [AdvisorController],
  providers: [AdvisorService, SnapshotService, PrismaService],
})
export class AdvisorModule {}
