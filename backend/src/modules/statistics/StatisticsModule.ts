// statistics.module.ts
import { Module } from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';
import { StatisticsController } from './StatisticsController';
import { StatisticsService } from './StatisticsService';

@Module({
  controllers: [StatisticsController],
  providers: [StatisticsService, PrismaService],
})
export class StatisticsModule {}