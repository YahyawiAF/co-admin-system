import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { PusherModule } from '../pusher/pusher.module';
import { PrismaModule } from 'database/prisma.module';
import { UserModule } from '../user/user.module';


@Module({
  imports: [PrismaModule, PusherModule, UserModule],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}