import { Module } from '@nestjs/common';
import { UsersController } from './user.controller';
import { UsersService } from './user.service';
import { PrismaService } from '../../../database/prisma.service';
import { EventsModule } from '../webSocket/events.module';
import { TypedEventEmitterModule } from '../event-emitter/typed-event-emitter.module';

@Module({
  imports: [EventsModule, TypedEventEmitterModule],
  controllers: [UsersController],
  providers: [UsersService, PrismaService],
  exports: [UsersService],
})
export class UserModule {}
