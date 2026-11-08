import { Module } from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';
import { AnalyticsModule } from '../analytics/analytics.module';
import { CaisseModule } from '../caisse/caisse.module';
import { ExpensesModule } from '../expense/expense.module';
import { MemberModule } from '../member/member.module';
import { AdvisorContextController } from './advisor-context.controller';
import { AdvisorController } from './advisor.controller';
import { AdvisorService } from './advisor.service';
import { ContextService } from './context.service';
import { InitiativeMeasure } from './initiative-measure';
import { HealthService } from './health.service';
import { ManagerController } from './manager.controller';
import { ManagerService } from './manager.service';
import { SnapshotService } from './snapshot.service';

@Module({
  imports: [AnalyticsModule, CaisseModule, MemberModule, ExpensesModule],
  controllers: [AdvisorController, AdvisorContextController, ManagerController],
  providers: [AdvisorService, HealthService, SnapshotService, ContextService, InitiativeMeasure, ManagerService, PrismaService],
})
export class AdvisorModule {}
