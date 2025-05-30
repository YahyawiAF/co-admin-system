import {
  Body,
  Controller,
  Post,
  Put,
  Delete,
  Get,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ProxyService } from '../proxy/proxy.service';
import { BookingResponse } from './dtos/BookingResponseDto';
import { BookSeatsDto } from './dtos/books.dtos';

@Controller('booking')
export class BookingController {
  constructor(private readonly proxyService: ProxyService) {}

  @Post()
  async bookSeats(@Body() body: BookSeatsDto): Promise<BookingResponse[]> {
    try {
      return await this.proxyService.bookSeats(body);
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          error: error.message,
          suggestion: this.getSuggestion(error.message),
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Put(':id')
  async updateBooking(
    @Param('id') id: string,
    @Body() body: Partial<BookSeatsDto>,
  ): Promise<BookingResponse> {
    try {
      return await this.proxyService.updateBooking(id, body);
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          error: error.message,
          suggestion: this.getSuggestion(error.message),
        },
        error.message.includes('not found')
          ? HttpStatus.NOT_FOUND
          : HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Delete(':id')
  async deleteBooking(@Param('id') id: string): Promise<void> {
    try {
      await this.proxyService.deleteBooking(id);
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          error: error.message,
          suggestion: this.getSuggestion(error.message),
        },
        error.message.includes('not found')
          ? HttpStatus.NOT_FOUND
          : HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get()
  async getAllBookings(): Promise<BookingResponse[]> {
    try {
      return await this.proxyService.getAllBookings();
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          error: error.message,
          suggestion: this.getSuggestion(error.message),
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get(':id')
  async getBookingById(@Param('id') id: string): Promise<BookingResponse> {
    try {
      return await this.proxyService.getBookingById(id);
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          error: error.message,
          suggestion: this.getSuggestion(error.message),
        },
        error.message.includes('not found')
          ? HttpStatus.NOT_FOUND
          : HttpStatus.BAD_REQUEST,
      );
    }
  }

  private getSuggestion(errorMsg: string): string {
    if (errorMsg.includes('already booked')) {
      return 'Please choose different seats';
    }
    if (errorMsg.includes('Member not found')) {
      return 'Please provide a valid member ID';
    }
    if (errorMsg.includes('Booking not found')) {
      return 'Please provide a valid booking ID';
    }
    if (errorMsg.includes('Failed to save')) {
      return 'Booking created but database save failed - contact support';
    }
    return 'Please verify event and seat availability';
  }
}
