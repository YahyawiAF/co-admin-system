// src/messages/messages.service.ts
import { Injectable } from '@nestjs/common';
import { CreateMessageDto } from './dto/create-message.dto';
import { PrismaService } from 'database/prisma.service';
import { PusherService } from '../pusher/pusher.service';

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private pusherService: PusherService
  ) {}


// src/messages/messages.service.ts
async create(createMessageDto: CreateMessageDto) {
  try {
    console.log('Received DTO:', {
      ...createMessageDto,
      imageBase64: createMessageDto.imageBase64 ? '...' : null
    });

    if (!createMessageDto.senderId) {
      throw new Error('senderId is required');
    }

    // Créez le message dans la base de données avec l'image complète
    const newMessage = await this.prisma.message.create({
      data: {
        content: createMessageDto.content || null,
        imageUrl: createMessageDto.imageBase64 || null,
        senderId: createMessageDto.senderId
      },
      include: {
        sender: {
          select: {
            id: true,
            fullname: true,
            img: true
          }
        }
      }
    });

    console.log('Message created:', {
      ...newMessage,
      imageUrl: newMessage.imageUrl ? '...' : null
    });

    // Créez une version légère du message pour Pusher (sans l'image complète)
    const pusherMessage = {
      ...newMessage,
      imageUrl: newMessage.imageUrl ? 'HAS_IMAGE' : null,
      // Ajoutez un indicateur que le client doit récupérer l'image séparément
      requiresImageFetch: !!newMessage.imageUrl
    };

    // Envoyez la version légère via Pusher
    await this.pusherService.trigger('chat', 'new-message', pusherMessage);

    return newMessage;
  } catch (error) {
    console.error('Error in create message:', error);
    throw error;
  }
}

  async findAll() {
    return this.prisma.message.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        sender: {
          select: {
            id: true,
            fullname: true,
            img: true
          }
        }
      }
    });
  }
}
