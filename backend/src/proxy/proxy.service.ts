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

      const seats = await this.resolveSeats(data.seats, data.spaceId);
      await this.checkSeatsAvailability(
        data.eventKey,
        seats.map((s) => ({ spaceId: s.spaceId, seatId: s.label })),
      );

      const overflowLabels = new Set(
        seats.filter((s) => s.isOverflow).map((s) => s.label),
      );

      return await this.prisma
        .$transaction(async (prisma) => {
          await this.saveBookingToDatabase(data, seats, prisma);
          const created = await prisma.seatBooking.findMany({
            where: {
              eventKey: data.eventKey,
              memberId: data.memberId,
              isBooked: true,
              OR: seats.map((s) => ({
                spaceId: s.spaceId,
                seatId: s.label,
              })),
            },
          });
          return created.map((b) => ({ ...b, success: true }));
        })
        .then(async (created) => {
          for (const seat of seats) {
            await this.opsEvents.record({
              type: overflowLabels.has(seat.label)
                ? 'seat.overflow_used'
                : 'seat.assigned',
              memberId: data.memberId,
              seatId: seat.label,
              meta: {
                eventKey: data.eventKey,
                spaceId: seat.spaceId,
                isOverflow: overflowLabels.has(seat.label),
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

        let spaceId = data.spaceId || existingBooking.spaceId;
        if (data.seats && data.eventKey) {
          const seats = await this.resolveSeats(data.seats, spaceId);
          spaceId = seats[0]?.spaceId || spaceId;
          await this.checkSeatsAvailability(
            data.eventKey,
            seats.map((s) => ({ spaceId: s.spaceId, seatId: s.label })),
            bookingId,
          );
        }

        const updatedBooking = await prisma.seatBooking.update({
          where: { id: bookingId },
          data: {
            eventKey: data.eventKey,
            seatId: data.seats?.[0] ?? existingBooking.seatId,
            spaceId,
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
        meta: { eventKey: booking.eventKey, spaceId: booking.spaceId },
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

  private async resolveSeats(labels: string[], spaceId?: string) {
    const seats = await this.prisma.seat.findMany({
      where: {
        label: { in: labels },
        isActive: true,
        ...(spaceId ? { spaceId } : {}),
      },
    });
    const missing = labels.filter(
      (label) => !seats.some((s) => s.label === label && (!spaceId || s.spaceId === spaceId)),
    );
    if (missing.length) {
      throw new Error(`Places introuvables: ${missing.join(', ')}`);
    }
    if (!spaceId) {
      for (const label of labels) {
        const matches = seats.filter((s) => s.label === label);
        if (matches.length > 1) {
          throw new Error(
            `La place « ${label} » existe dans plusieurs espaces — précisez spaceId`,
          );
        }
      }
    }
    return labels.map((label) => {
      const seat = seats.find(
        (s) => s.label === label && (!spaceId || s.spaceId === spaceId),
      );
      if (!seat) throw new Error(`Place introuvable: ${label}`);
      return seat;
    });
  }

  private async checkSeatsAvailability(
    eventKey: string,
    seats: { spaceId: string; seatId: string }[],
    exceptBookingId?: string,
  ): Promise<void> {
    const existingBookings = await this.prisma.seatBooking.findMany({
      where: {
        eventKey,
        isBooked: true,
        ...(exceptBookingId ? { NOT: { id: exceptBookingId } } : {}),
        OR: seats.map((s) => ({ spaceId: s.spaceId, seatId: s.seatId })),
      },
      select: { seatId: true, spaceId: true },
    });
    if (existingBookings.length > 0) {
      const bookedSeats = existingBookings.map((b) => b.seatId);
      throw new Error(`Seats already booked: ${bookedSeats.join(', ')}`);
    }
  }

  private async saveBookingToDatabase(
    data: BookSeatsDto,
    seats: { spaceId: string; label: string }[],
    prisma: Prisma.TransactionClient,
  ): Promise<void> {
    await Promise.all(
      seats.map((seat) =>
        prisma.seatBooking.create({
          data: {
            eventKey: data.eventKey,
            seatId: seat.label,
            spaceId: seat.spaceId,
            isBooked: true,
            bookedAt: new Date(),
            memberId: data.memberId,
          },
        }),
      ),
    );
    await this.markPermanentIfPeriodSub(
      data.memberId,
      seats,
      prisma,
    );
  }

  private async markPermanentIfPeriodSub(
    memberId: string,
    seats: { spaceId: string; label: string }[],
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
    const first = seats[0];
    if (!first) return;
    await prisma.seatBooking.updateMany({
      where: {
        memberId,
        OR: seats.map((s) => ({ spaceId: s.spaceId, seatId: s.label })),
        isBooked: true,
      },
      data: { isPermanent: true },
    });
    await prisma.abonnement.update({
      where: { id: sub.id },
      data: {
        reservedSeatLabel: first.label,
        reservedSeatSpaceId: first.spaceId,
      },
    });
  }
}
