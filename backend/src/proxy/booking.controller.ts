// src/booking/booking.controller.ts
import { Body, Controller, Post, HttpException, HttpStatus } from '@nestjs/common';
import { ProxyService } from '../proxy/proxy.service';
import { BookSeatsDto } from './books.dtos';

@Controller('booking')
export class BookingController {
  constructor(private readonly proxyService: ProxyService) {}

  @Post()
  async bookSeats(@Body() body: BookSeatsDto) {
    try {
      return await this.proxyService.bookSeats(body);
    } catch (error) {
      throw new HttpException(
        {
          status: HttpStatus.BAD_REQUEST,
          error: error.message,
          suggestion: 'Vérifiez que l\'événement existe et que les places sont disponibles'
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }
}