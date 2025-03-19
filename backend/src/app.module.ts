import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { EventsModule } from 'src/modules/webSocket/events.module';
import { JournalModule } from 'src/modules/journal/journal.modal';
import { MemberModule } from 'src/modules/member/member.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PriceModule } from './modules/price/price.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot(),
    EventEmitterModule.forRoot(),
    UserModule,
    AuthModule,
    EventsModule,
    JournalModule,
    MemberModule,
    PriceModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}