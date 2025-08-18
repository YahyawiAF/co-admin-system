// src/pusher/pusher.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PusherService } from './pusher.service';
import { PusherController } from './pusher.controller';

@Module({
  imports: [ConfigModule],
  providers: [PusherService],
  controllers: [PusherController],
  exports: [PusherService],
})
export class PusherModule {}