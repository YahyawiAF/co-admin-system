import { Module } from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';
import {
  EventsAdminReadController,
  EventsAdminWriteController,
  MobileEventsController,
  MobileLinksController,
} from './events.controller';
import { SpaceEventsService } from './events.service';
import { MobileModule } from '../mobile/mobile.module';

@Module({
  imports: [MobileModule],
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
