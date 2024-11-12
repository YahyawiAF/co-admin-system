import { Module } from '@nestjs/common';
import { JournalController } from './journal.controller';
import { JournalService } from './journal.service';
import { PrismaService } from '../../../database/prisma.service';
import { EventsModule } from '../webSocket/events.module';
import { TypedEventEmitterModule } from '../event-emitter/typed-event-emitter.module';

@Module({
  imports: [EventsModule, TypedEventEmitterModule],
  controllers: [JournalController],
  providers: [JournalService, PrismaService],
  exports: [JournalService],
})
export class JournalModule {}
