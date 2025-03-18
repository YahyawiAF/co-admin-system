import { Module } from '@nestjs/common';
import { JournalController } from './journal.controller';
import { JournalService } from './journal.service';
import { PrismaService } from '../../../database/prisma.service';
import { EventsModule } from '../webSocket/events.module';
import { TypedEventEmitterModule } from '../event-emitter/typed-event-emitter.module';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from 'common/guards/accessToken.guard';

@Module({
  imports: [EventsModule, TypedEventEmitterModule,
     ConfigModule.forRoot(),
        JwtModule.register({
          secret: process.env.JWT_ACCESS_SECRET,
          signOptions: { expiresIn: '20m' },
        }),
  ],
  controllers: [JournalController],
  providers: [JwtAuthGuard,JournalService, PrismaService],
  exports: [JournalService],
})
export class JournalModule {}