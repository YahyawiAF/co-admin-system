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

  async create(createMessageDto: CreateMessageDto) {
    try {
      console.log('Received DTO:', {
        ...createMessageDto,
        imageBase64: createMessageDto.imageBase64 ? '...' : null
      });

      if (!createMessageDto.senderId) {
        throw new Error('senderId is required');
      }

      // Create the message in the database with the full image
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
              img: true // Include img temporarily for the database response
            }
          }
        }
      });

      console.log('Message created:', {
        ...newMessage,
        imageUrl: newMessage.imageUrl ? '...' : null
      });

      // Create a lightweight version of the message for Pusher
      const pusherMessage = {
        id: newMessage.id,
        content: newMessage.content,
        imageUrl: newMessage.imageUrl ? 'HAS_IMAGE' : null,
        senderId: newMessage.senderId,
        createdAt: newMessage.createdAt,
        sender: {
          id: newMessage.sender.id,
          fullname: newMessage.sender.fullname
          // Explicitly exclude sender.img to reduce payload size
        },
        requiresImageFetch: !!newMessage.imageUrl
      };

      // Send the lightweight version via Pusher
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