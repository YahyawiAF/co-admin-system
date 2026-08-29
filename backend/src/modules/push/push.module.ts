import { Module } from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';
import { PushService } from './push.service';

@Module({
  providers: [PushService, PrismaService],
  exports: [PushService],
})
export class PushModule {}
