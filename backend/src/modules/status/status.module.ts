import { Module } from '@nestjs/common';
import { StatusController } from './status.controller';
import { StatusService } from './status.service';
import { PrismaService } from '../../../database/prisma.service';
import { EventsModule } from '../webSocket/events.module';
import { TypedEventEmitterModule } from '../event-emitter/typed-event-emitter.module';

@Module({
  imports: [EventsModule, TypedEventEmitterModule],
  controllers: [StatusController],
  providers: [StatusService, PrismaService],
  exports: [StatusService],
})
export class StatusModule {}
