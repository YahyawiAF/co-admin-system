import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'database/prisma.service';
import { BookingResponse } from './dtos/BookingResponseDto';
import { BookSeatsDto } from './dtos/books.dtos';
import { OpsEventsService } from '../modules/ops-events/ops-events.service';

/** Local seat booking — no Seats.io. Persistence only in PostgreSQL. */
@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly opsEvents: OpsEventsService,
  ) {}

  async bookSeats(data: BookSeatsDto): Promise<BookingResponse[]> {
    try {
      const memberExists = await this.prisma.member.findUnique({
        where: { id: data.memberId },
        select: { id: true },
      });
      if (!memberExists) throw new Error('Member not found');

      await this.checkSeatsAvailability(data.eventKey, data.seats);

      const seatMeta = await this.prisma.seat.findMany({
        where: { label: { in: data.seats }, isActive: true },
      });
      const overflowLabels = new Set(
        seatMeta.filter((s) => s.isOverflow).map((s) => s.label),
      );

      return await this.prisma
        .$transaction(async (prisma) => {
          await this.saveBookingToDatabase(data, prisma);
          const created = await prisma.seatBooking.findMany({
            where: {
              eventKey: data.eventKey,
              seatId: { in: data.seats },
              memberId: data.memberId,
              isBooked: true,
            },
          });
          return created.map((b) => ({ ...b, success: true }));
        })
        .then(async (created) => {
          for (const seatId of data.seats) {
            await this.opsEvents.record({
              type: overflowLabels.has(seatId)
                ? 'seat.overflow_used'
                : 'seat.assigned',
              memberId: data.memberId,
              seatId,
              meta: {
                eventKey: data.eventKey,
                isOverflow: overflowLabels.has(seatId),
              },
            });
          }
          return created;
        });
    } catch (error) {
      this.logger.error('Booking error', (error as Error).stack);
      throw error;
    }
  }

  async updateBooking(
    bookingId: string,
    data: Partial<BookSeatsDto>,
  ): Promise<BookingResponse> {
    try {
      return await this.prisma.$transaction(async (prisma) => {
        const existingBooking = await prisma.seatBooking.findUnique({
          where: { id: bookingId },
        });
        if (!existingBooking) {
          throw new NotFoundException('Booking not found');
        }

        if (data.memberId) {
          const memberExists = await prisma.member.findUnique({
            where: { id: data.memberId },
            select: { id: true },
          });
          if (!memberExists) throw new Error('Member not found');
        }

        if (data.seats && data.eventKey) {
          await this.checkSeatsAvailability(data.eventKey, data.seats);
        }

        const updatedBooking = await prisma.seatBooking.update({
          where: { id: bookingId },
          data: {
            eventKey: data.eventKey,
            seatId: data.seats?.join(','),
            memberId: data.memberId,
            updatedAt: new Date(),
          },
        });

        return { ...updatedBooking, success: true };
      });
    } catch (error) {
      this.logger.error('Update booking error', (error as Error).stack);
      throw error;
    }
  }

  async deleteBooking(bookingId: string): Promise<void> {
    try {
      const booking = await this.prisma.seatBooking.findUnique({
        where: { id: bookingId },
      });
      if (!booking) throw new NotFoundException('Booking not found');
      await this.prisma.seatBooking.delete({ where: { id: bookingId } });
      await this.opsEvents.record({
        type: 'seat.released',
        memberId: booking.memberId,
        seatId: booking.seatId,
        meta: { eventKey: booking.eventKey },
      });
      this.logger.log(`Booking ${bookingId} deleted successfully`);
    } catch (error) {
      this.logger.error('Delete booking error', (error as Error).stack);
      throw error;
    }
  }

  async getAllBookings(): Promise<BookingResponse[]> {
    const bookings = await this.prisma.seatBooking.findMany({
      where: { isBooked: true },
    });
    return bookings.map((booking) => ({ ...booking, success: true }));
  }

  async getBookingById(bookingId: string): Promise<BookingResponse> {
    const booking = await this.prisma.seatBooking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return { ...booking, success: true };
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
    await this.markPermanentIfPeriodSub(data.memberId, data.seats, prisma);
  }

  private async markPermanentIfPeriodSub(
    memberId: string,
    seats: string[],
    prisma: Prisma.TransactionClient,
  ) {
    const now = new Date();
    const sub = await prisma.abonnement.findFirst({
      where: {
        memberID: memberId,
        registredDate: { lte: now },
        OR: [{ leaveDate: null }, { leaveDate: { gte: now } }],
      },
      include: { price: true },
      orderBy: { leaveDate: 'desc' },
    });
    if (!sub?.price) return;
    const isHours = sub.price.billingUnit === 'HOURLY';
    const isAbo =
      sub.price.category === 'ABONNEMENT' || sub.price.type === 'abonnement';
    if (!isAbo || isHours) return;
    const label = seats[0];
    if (!label) return;
    await prisma.seatBooking.updateMany({
      where: {
        memberId,
        seatId: { in: seats },
        isBooked: true,
      },
      data: { isPermanent: true },
    });
    await prisma.abonnement.update({
      where: { id: sub.id },
      data: { reservedSeatLabel: label },
    });
  }
}
