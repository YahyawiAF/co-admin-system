import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from 'common/guards/accessToken.guard';
import { PrismaService } from 'database/prisma.service';
import { AdminPushController } from './admin-push.controller';
import { PushService } from './push.service';

@Module({
  imports: [JwtModule.register({ secret: process.env.JWT_ACCESS_SECRET })],
  controllers: [AdminPushController],
  providers: [PushService, PrismaService, JwtAuthGuard],
  exports: [PushService],
})
export class PushModule {}
