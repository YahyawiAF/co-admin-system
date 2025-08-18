// src/messages/messages.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UsePipes, ValidationPipe } from '@nestjs/common';
@Controller('messages')
@UsePipes(new ValidationPipe({ transform: true }))
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  async create(@Body() createMessageDto: CreateMessageDto) {
    console.log('Message reçu:', {
      content: createMessageDto.content,
      senderId: createMessageDto.senderId,
      hasImage: !!createMessageDto.imageBase64
    });

    return this.messagesService.create(createMessageDto);
  }

  @Get()
  findAll() {
    return this.messagesService.findAll();
  }
}