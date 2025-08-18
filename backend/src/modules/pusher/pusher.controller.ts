// src/pusher/pusher.controller.ts
import { Controller, Post, Body, Req } from '@nestjs/common';
import { PusherService } from './pusher.service';

@Controller('pusher')
export class PusherController {
  constructor(private pusherService: PusherService) {}

  @Post('auth')
  async auth(@Body() body: { socket_id: string; channel_name: string }) {
    return this.pusherService.authenticate(
      body.socket_id,
      body.channel_name,
      {
        user_id: 'unique_user_id', // Vous devriez utiliser l'ID de l'utilisateur authentifié
        user_info: {
          name: 'User Name'
        }
      }
    );
  }
}