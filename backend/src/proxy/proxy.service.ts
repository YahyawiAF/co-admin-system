import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'database/prisma.service';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { BookingResponse } from './dtos/BookingResponseDto';
import { BookSeatsDto } from './dtos/books.dtos';

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);
  private readonly axiosInstance: AxiosInstance;

  constructor(private readonly prisma: PrismaService) {
    this.axiosInstance = axios.create({
      baseURL: 'https://api-sa.seatsio.net',
      headers: {
        'Content-Type': 'application/json',
        Authorization:
          'Basic ' +
          Buffer.from(`${process.env.SEATSIO_SECRET_KEY}:`).toString('base64'),
      },
      timeout: 5000,
    });
  }

  async bookSeats(data: BookSeatsDto): Promise<BookingResponse[]> {
    try {
      // 1. Vérifier que le membre existe
      const memberExists = await this.prisma.member.findUnique({
        where: { id: data.memberId },
        select: { id: true },
      });

      if (!memberExists) {
        throw new Error('Member not found');
      }

      // 2. Vérifier la disponibilité des sièges
      await this.checkSeatsAvailability(data.eventKey, data.seats);

      // 3. Tout est OK, procéder à la réservation
      return await this.prisma.$transaction(async (prisma) => {
        // 3a. Réserver dans Seatsio
        const seatsioResponse = await this.bookSeatsInSeatsio(data);

        // 3b. Enregistrer en base de données
        await this.saveBookingToDatabase(data, prisma);

        // Map Seatsio response to BookingResponse
        return data.seats.map((seatId, index) => ({
          ...seatsioResponse[index],
          success: true,
        }));
      });
    } catch (error) {
      this.logger.error('Booking error', error.stack);
      throw error;
    }
  }

  async updateBooking(
    bookingId: string,
    data: Partial<BookSeatsDto>,
  ): Promise<BookingResponse> {
    try {
      return await this.prisma.$transaction(async (prisma) => {
        // 1. Vérifier que la réservation existe
        const existingBooking = await prisma.seatBooking.findUnique({
          where: { id: bookingId },
        });

        if (!existingBooking) {
          throw new NotFoundException('Booking not found');
        }

        // 2. Vérifier que le membre existe si mis à jour
        if (data.memberId) {
          const memberExists = await prisma.member.findUnique({
            where: { id: data.memberId },
            select: { id: true },
          });
          if (!memberExists) {
            throw new Error('Member not found');
          }
        }

        // 3. Vérifier la disponibilité des nouveaux sièges si mis à jour
        if (data.seats && data.eventKey) {
          await this.checkSeatsAvailability(data.eventKey, data.seats);
        }

        // 4. Mettre à jour dans Seatsio si nécessaire
        let seatsioResponse: BookingResponse[] | null = null;
        if (data.seats || data.eventKey) {
          seatsioResponse = await this.bookSeatsInSeatsio({
            ...data,
            seats: data.seats || existingBooking.seatId.split(','),
            eventKey: data.eventKey || existingBooking.eventKey,
            memberId: data.memberId || existingBooking.memberId,
          } as BookSeatsDto);
        }

        // 5. Mettre à jour en base de données
        const updatedBooking = await prisma.seatBooking.update({
          where: { id: bookingId },
          data: {
            eventKey: data.eventKey,
            seatId: data.seats?.join(','),
            memberId: data.memberId,
            updatedAt: new Date(),
          },
        });

        return {
          ...updatedBooking,
          success: true,
        };
      });
    } catch (error) {
      this.logger.error('Update booking error', error.stack);
      throw error;
    }
  }

  async deleteBooking(bookingId: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (prisma) => {
        // 1. Vérifier que la réservation existe
        const booking = await prisma.seatBooking.findUnique({
          where: { id: bookingId },
        });

        if (!booking) {
          throw new NotFoundException('Booking not found');
        }

        // 2. Libérer les sièges dans Seatsio
        await this.axiosInstance.post(
          `/events/${booking.eventKey}/actions/release`,
          {
            objects: booking.seatId.split(','),
          },
        );

        // 3. Supprimer la réservation en base
        await prisma.seatBooking.delete({
          where: { id: bookingId },
        });

        this.logger.log(`Booking ${bookingId} deleted successfully`);
      });
    } catch (error) {
      this.logger.error('Delete booking error', error.stack);
      throw error;
    }
  }

  async getAllBookings(): Promise<BookingResponse[]> {
    try {
      const bookings = await this.prisma.seatBooking.findMany({
        where: { isBooked: true },
      });

      return bookings.map((booking) => ({
        ...booking,
        success: true,
      }));
    } catch (error) {
      this.logger.error('Get all bookings error', error.stack);
      throw error;
    }
  }

  async getBookingById(bookingId: string): Promise<BookingResponse> {
    try {
      const booking = await this.prisma.seatBooking.findUnique({
        where: { id: bookingId },
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      return {
        ...booking,
        success: true,
      };
    } catch (error) {
      this.logger.error('Get booking by ID error', error.stack);
      throw error;
    }
  }

  private async bookSeatsInSeatsio(
    data: BookSeatsDto,
  ): Promise<BookingResponse[]> {
    const url = `/events/${data.eventKey}/actions/book`;
    const payload = {
      objects: data.seats,
      orderId: `order-${Date.now()}`,
    };

    this.logger.debug(`Calling Seatsio: ${url}`, payload);

    await this.axiosInstance.post(url, payload);

    return data.seats.map((seatId) => ({
      id: '', // Will be set in saveBookingToDatabase
      eventKey: data.eventKey,
      seatId,
      memberId: data.memberId,
      isBooked: true,
      bookedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      success: true,
    }));
  }

  private async checkSeatsAvailability(
    eventKey: string,
    seats: string[],
  ): Promise<void> {
    const existingBookings = await this.prisma.seatBooking.findMany({
      where: {
        eventKey,
        seatId: { in: seats },
        isBooked: true,
      },
      select: { seatId: true },
    });

    if (existingBookings.length > 0) {
      const bookedSeats = existingBookings.map((b) => b.seatId);
      throw new Error(`Seats already booked: ${bookedSeats.join(', ')}`);
    }
  }

  private async saveBookingToDatabase(
    data: BookSeatsDto,
    prisma: Prisma.TransactionClient,
  ): Promise<void> {
    try {
      await Promise.all(
        data.seats.map((seatId) =>
          prisma.seatBooking.create({
            data: {
              eventKey: data.eventKey,
              seatId,
              isBooked: true,
              bookedAt: new Date(),
              memberId: data.memberId,
            },
          }),
        ),
      );
      this.logger.log(`Booking saved for member ${data.memberId}`);
    } catch (dbError) {
      this.logger.error('Database error', dbError.stack);
      throw new Error('Failed to save booking');
    }
  }
}
