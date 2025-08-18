// src/pusher/pusher.controller.ts
import { Controller, Post, Body, Req, Headers } from '@nestjs/common';
import { PusherService } from './pusher.service';

@Controller('pusher')
export class PusherController {
  constructor(private pusherService: PusherService) {}

  @Post('auth')
  async auth(
    @Body() body: { socket_id: string; channel_name: string },
    @Headers('authorization') authHeader: string
  ) {
    // Extraire le token du header
    const token = authHeader?.replace('Bearer ', '');
    
    // Ici vous devriez valider le token JWT et extraire les infos utilisateur
    // Pour l'exemple, nous utilisons des valeurs par défaut
    
    return this.pusherService.authenticate(
      body.socket_id,
      body.channel_name,
      {
        user_id: 'unique_user_id', // À remplacer par l'ID réel de l'utilisateur
        user_info: {
          name: 'User Name'
        }
      }
    );
  }
}