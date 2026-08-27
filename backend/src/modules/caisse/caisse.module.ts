import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from 'database/prisma.service';
import { OpsEventsModule } from '../ops-events/ops-events.module';
import { CaisseController } from './caisse.controller';
import { CaisseService } from './caisse.service';

@Module({
  imports: [ConfigModule, OpsEventsModule],
  controllers: [CaisseController],
  providers: [CaisseService, PrismaService],
  exports: [CaisseService],
})
export class CaisseModule {}
