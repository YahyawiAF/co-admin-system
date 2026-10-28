import { Module } from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';
import {
  EventsAdminReadController,
  EventsAdminWriteController,
  MobileEventsController,
  MobileLinksController,
} from './events.controller';
import { SpaceEventsService } from './events.service';

@Module({
  controllers: [
    EventsAdminWriteController,
    EventsAdminReadController,
    MobileEventsController,
    MobileLinksController,
  ],
  providers: [SpaceEventsService, PrismaService],
  exports: [SpaceEventsService],
})
export class SpaceEventsModule {}
