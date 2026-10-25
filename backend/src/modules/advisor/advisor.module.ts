import { Module } from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AdvisorContextController } from './advisor-context.controller';
import { AdvisorController } from './advisor.controller';
import { AdvisorService } from './advisor.service';
import { ContextService } from './context.service';
import { InitiativeMeasure } from './initiative-measure';
import { SnapshotService } from './snapshot.service';

@Module({
  imports: [AnalyticsModule],
  controllers: [AdvisorController, AdvisorContextController],
  providers: [AdvisorService, SnapshotService, ContextService, InitiativeMeasure, PrismaService],
})
export class AdvisorModule {}
