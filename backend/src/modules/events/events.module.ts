import { Module } from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';
import {
  EventsAdminReadController,
  EventsAdminWriteController,
  MobileEventsController,
} from './events.controller';
import { SpaceEventsService } from './events.service';

@Module({
  controllers: [
    EventsAdminWriteController,
    EventsAdminReadController,
    MobileEventsController,
  ],
  providers: [SpaceEventsService, PrismaService],
  exports: [SpaceEventsService],
})
export class SpaceEventsModule {}
