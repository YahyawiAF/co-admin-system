import { Module } from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';
import { OpsEventsController } from './ops-events.controller';
import { OpsEventsService } from './ops-events.service';

@Module({
  controllers: [OpsEventsController],
  providers: [OpsEventsService, PrismaService],
  exports: [OpsEventsService],
})
export class OpsEventsModule {}
