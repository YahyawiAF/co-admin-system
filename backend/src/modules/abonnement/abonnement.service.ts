import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { UpdateAbonnementDto } from './dtos/updateAbonnement.dto';
import { Abonnement, PriceCategory, Prisma, Subscription } from '@prisma/client';
import { memberDiscountPercent } from '../mobile/session-pricing-context';
import { PaginatedResult } from 'common/dtos/PaginatedOutputDto';
import { createPaginator } from 'prisma-pagination';
import { AddAbonnementDto } from './dtos/createAbonnement.dto';
import { HttpStatus } from '@nestjs/common';
import { ErrorCode, GeneralException } from '@/exceptions';
import { AbonnementEntity } from './entities/abonnement.entity';
import { EventsGateway } from '../webSocket/events.gateway';
import { saleSnapshotFromPrice } from '../mobile/sale-snapshot';
import { switchOpenSessionToSubscription } from '../mobile/session-to-subscription';
import { syncAbonnementPayments } from './abonnement-revenue';
import { endOfDay, isSameDay, startOfDay } from 'date-fns';
import { SyncOutboxService } from '../erp-sync/sync-outbox.service';

const PAYMENTS_INCLUDE = {
  select: { id: true, amount: true, paidAt: true },
  orderBy: { paidAt: 'asc' },
} satisfies Prisma.Abonnement$paymentsArgs;

/** promoLabel prefix of a top-up abonnement (passes already paid deducted). */
export const PASS_CREDIT_LABEL = 'Passes déduits';

@Injectable()
export class AbonnementService {
  constructor(
    private prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
    private readonly syncOutbox: SyncOutboxService,
  ) {}

  async create(createAbonnementDto: AddAbonnementDto) {
    try {
      const { memberID, priceId } = createAbonnementDto;

      // Vérifier si le prix existe
      const existingPrice = await this.prisma.price.findUnique({
        where: { id: priceId },
      });

      if (!existingPrice) {
        throw new GeneralException(
          HttpStatus.NOT_FOUND,
          ErrorCode.NOT_FOUND,
          `The selected price does not exist.`,
        );
      }

      // Vérifier si le membre existe
      const existingMember = await this.prisma.member.findUnique({
        where: { id: memberID },
      });

      if (!existingMember) {
        throw new GeneralException(
          HttpStatus.NOT_FOUND,
          ErrorCode.NOT_FOUND,
          `The selected member does not exist.`,
        );
      }

      // Update user plan
      //   const updatedUser = await this.prisma.member.update({

      const hoursQuota =
        createAbonnementDto.hoursQuota ??
        (existingPrice.billingUnit === 'HOURLY'
          ? existingPrice.durationHours
          : null);

      let spaceName: string | null = null;
      const spaceId =
        createAbonnementDto.reservedSeatSpaceId ||
        existingPrice.spaceId ||
        null;
      if (spaceId) {
        const space = await this.prisma.space.findUnique({
          where: { id: spaceId },
          select: { name: true },
        });
        spaceName = space?.name || null;
      }
      const snap = saleSnapshotFromPrice(existingPrice, {
        id: spaceId,
        name: spaceName,
      });
      const discount = await this.discountFor(memberID, existingPrice);
      // Top-up: passes already paid are deducted, the client pays only the rest
      const credit = Math.min(
        Math.max(0, Number(createAbonnementDto.passCredit) || 0),
        discount.amountDue,
      );
      const creditSnapshot =
        credit > 0.009
          ? {
              priceBeforePromo: discount.amountDue,
              promoDiscount: Math.round(credit * 100) / 100,
              promoLabel: `${PASS_CREDIT_LABEL} (${Math.round(credit * 100) / 100} DT)`,
            }
          : {};
      if (credit > 0.009) {
        discount.amountDue = Math.round((discount.amountDue - credit) * 100) / 100;
      }
      // "Offert": staff gives part of the price away — lowers what is owed, no debt
      const offered = this.clampOffered(createAbonnementDto.offeredAmount, discount.amountDue);
      if (offered) {
        discount.amountDue = Math.round((discount.amountDue - offered) * 100) / 100;
      }
      const payment = this.settlePayment(
        createAbonnementDto.isPayed,
        createAbonnementDto.payedAmount,
        discount.amountDue,
      );
      const paidOn = this.paymentMoment(createAbonnementDto.paymentDate);

      const created = await this.prisma.abonnement.create({
        data: {
          memberID: createAbonnementDto.memberID,
          registredDate: createAbonnementDto.registredDate,
          leaveDate: createAbonnementDto.leaveDate,
          isPayed: payment.isPayed,
          paidAt: payment.isPayed ? paidOn : null,
          isReservation: createAbonnementDto.isReservation,
          payedAmount: payment.payedAmount,
          discountPercent: discount.discountPercent,
          amountDue: discount.amountDue,
          offeredAmount: offered,
          ...creditSnapshot,
          stayedPeriode: createAbonnementDto.stayedPeriode, // fornt end calculate leave time
          priceId: priceId,
          hoursQuota,
          hoursUsed: createAbonnementDto.hoursUsed ?? 0,
          reservedSeatLabel: createAbonnementDto.reservedSeatLabel || null,
          reservedSeatSpaceId:
            createAbonnementDto.reservedSeatSpaceId || null,
          paymentRemindAt: createAbonnementDto.paymentRemindAt ?? null,
          serviceName: snap.serviceName,
          listPrice: snap.listPrice,
          spaceId: snap.spaceId,
          spaceName: snap.spaceName,
        },
        include: {
          members: true,
          price: true,
        },
      });
      await syncAbonnementPayments(
        this.prisma,
        created.id,
        0,
        created.payedAmount,
        paidOn,
      );
      await this.syncOutbox.enqueue('abonnement', created.id, 'CREATE');
      await this.syncReservedSeat(
        created.memberID,
        created.reservedSeatLabel,
        existingPrice,
        created.leaveDate,
        created.reservedSeatSpaceId,
        created.registredDate,
      );
      const switchedJournalId = this.startsAfterToday(created.registredDate)
        ? null
        : await switchOpenSessionToSubscription(
            this.prisma,
            created.memberID,
            existingPrice,
          );
      if (switchedJournalId) {
        this.eventsGateway.sendTableUpdates({
          type: 'session_switched_to_subscription',
          journalId: switchedJournalId,
          memberId: created.memberID,
        });
        this.eventsGateway.sendSessionPricingChanged({
          journalId: switchedJournalId,
          memberId: created.memberID,
          mode: 'SUBSCRIPTION',
          tierName: existingPrice.name,
          amountDue: 0,
        });
      }
      await this.refreshMemberPlan(created.memberID);
      this.eventsGateway.sendMemberStatusChanged({
        memberId: created.memberID,
        reason: 'abonnement_created',
        abonnementId: created.id,
      });
      this.eventsGateway.sendTableUpdates({
        type: 'abonnement_created',
        memberId: created.memberID,
        abonnementId: created.id,
      });
      return created;
    } catch (error) {
      throw new GeneralException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.ALREADY_EXIST,
        (error as Error).message,
      );
    }
  }

  findAllAbonnements() {
    return this.prisma.abonnement.findMany({
      include: {
        members: true,
        price: true,
        payments: PAYMENTS_INCLUDE,
      },
    });
  }

  findAll() {
    return this.prisma.abonnement.findMany({
      include: {
        members: true,
        price: true,
        payments: PAYMENTS_INCLUDE,
      },
    });
  }

  async findMany({
    where,
    orderBy = [{ registredDate: 'desc' }, { id: 'desc' }],
    page,
    perPage = 20,
  }: {
    where?: Prisma.AbonnementWhereInput;
    orderBy?:
      | Prisma.AbonnementOrderByWithRelationInput
      | Prisma.AbonnementOrderByWithRelationInput[];
    page?: number;
    perPage: number;
  }): Promise<PaginatedResult<AbonnementEntity & { stayedPeriode: string }>> {
    const paginate = createPaginator({ perPage });
    const paginatedResult = await paginate(
      this.prisma.abonnement,
      {
        where,
        orderBy,
        include: { members: true, price: true, payments: PAYMENTS_INCLUDE },
      },
      { page },
    );

    return {
      data: paginatedResult.data.map(
        (abonnement) => new AbonnementEntity(abonnement),
      ),
      meta: paginatedResult.meta,
    };
  }

  findOne(id: string) {
    return this.prisma.abonnement.findUnique({
      where: { id },
      include: {
        members: true,
        price: true,
        payments: PAYMENTS_INCLUDE,
      },
    });
  }

  async update(id: string, updateAbonnementDto: UpdateAbonnementDto) {
    try {
      const { priceId, memberID } = updateAbonnementDto;

      // Vérifier si le prix existe
      if (priceId) {
        const existingPrice = await this.prisma.price.findUnique({
          where: { id: priceId },
        });

        if (!existingPrice) {
          throw new GeneralException(
            HttpStatus.NOT_FOUND,
            ErrorCode.NOT_FOUND,
            `The selected price does not exist.`,
          );
        }
      }

      // Vérifier si le membre existe
      if (memberID) {
        const existingMember = await this.prisma.member.findUnique({
          where: { id: memberID },
        });

        if (!existingMember) {
          throw new GeneralException(
            HttpStatus.NOT_FOUND,
            ErrorCode.NOT_FOUND,
            `The selected member does not exist.`,
          );
        }
      }

      const current = await this.prisma.abonnement.findUnique({
        where: { id },
        include: { price: true },
      });
      if (!current) {
        throw new GeneralException(
          HttpStatus.NOT_FOUND,
          ErrorCode.NOT_FOUND,
          `Abonnement not found.`,
        );
      }
      const priceChanged = !!priceId && priceId !== current.priceId;
      const memberChanged = !!memberID && memberID !== current.memberID;
      let discount: { discountPercent: number | null; amountDue: number } | null =
        null;
      if (priceChanged || memberChanged || current.amountDue == null) {
        const price = priceChanged
          ? await this.prisma.price.findUnique({ where: { id: priceId } })
          : current.price;
        if (price) {
          discount = await this.discountFor(memberID || current.memberID, price);
          // Keep the passes credit of a top-up when the price or member changes
          if (current.promoLabel?.startsWith(PASS_CREDIT_LABEL) && current.promoDiscount) {
            discount.amountDue = Math.max(
              0,
              Math.round((discount.amountDue - current.promoDiscount) * 100) / 100,
            );
          }
        }
      }
      // Price before any gift: freshly computed, or the stored one plus the old gift
      const baseDue =
        discount?.amountDue ??
        (current.amountDue != null
          ? Math.round((current.amountDue + (current.offeredAmount || 0)) * 100) / 100
          : null);
      const offerSent = updateAbonnementDto.offeredAmount !== undefined;
      const offered =
        baseDue == null
          ? current.offeredAmount
          : this.clampOffered(
              offerSent ? updateAbonnementDto.offeredAmount : current.offeredAmount,
              baseDue,
            );
      const amountDue =
        baseDue == null
          ? current.amountDue
          : Math.round((baseDue - (offered || 0)) * 100) / 100;
      // "Marquer payé" without an amount means the remainder was collected now.
      const markedPaid =
        updateAbonnementDto.isPayed === true &&
        updateAbonnementDto.payedAmount === undefined &&
        !current.isPayed;
      const payment =
        amountDue != null &&
        (updateAbonnementDto.isPayed !== undefined ||
          updateAbonnementDto.payedAmount !== undefined ||
          offerSent)
          ? this.settlePayment(
              updateAbonnementDto.isPayed ?? current.isPayed,
              markedPaid
                ? amountDue
                : updateAbonnementDto.payedAmount ?? current.payedAmount,
              amountDue,
            )
          : null;

      // passCredit only applies when the abonnement is created
      const {
        reservedSeatLabel,
        reservedSeatSpaceId,
        passCredit: _credit,
        offeredAmount: _offered,
        paymentDate,
        ...rest
      } = updateAbonnementDto;
      const paidOn = this.paymentMoment(paymentDate);
      // Moving the end date back to today or later undoes a termination
      const reopened =
        rest.terminatedAt === undefined &&
        rest.leaveDate != null &&
        current.terminatedAt != null &&
        new Date(rest.leaveDate) >= startOfDay(new Date());
      const updated = await this.prisma.abonnement.update({
        where: { id },
        data: {
          ...rest,
          ...(discount ?? {}),
          ...(amountDue != null ? { amountDue, offeredAmount: offered ?? null } : {}),
          ...(payment
            ? {
                ...payment,
                paidAt: !payment.isPayed
                  ? null
                  : current.isPayed
                    ? current.paidAt ?? current.createdAt ?? paidOn
                    : paidOn,
              }
            : {}),
          ...(reopened ? { terminatedAt: null } : {}),
          ...(reservedSeatLabel !== undefined
            ? { reservedSeatLabel: reservedSeatLabel?.trim() || null }
            : {}),
          ...(reservedSeatSpaceId !== undefined
            ? { reservedSeatSpaceId: reservedSeatSpaceId || null }
            : {}),
        },
        include: {
          members: true,
          price: true,
        },
      });
      await syncAbonnementPayments(
        this.prisma,
        updated.id,
        current.payedAmount,
        updated.payedAmount,
        paidOn,
      );
      await this.syncReservedSeat(
        updated.memberID,
        updated.reservedSeatLabel,
        updated.price,
        updated.leaveDate,
        updated.reservedSeatSpaceId,
        updated.registredDate,
      );
      await this.refreshMemberPlan(updated.memberID);
      this.eventsGateway.sendMemberStatusChanged({
        memberId: updated.memberID,
        reason: 'abonnement_updated',
        abonnementId: updated.id,
      });
      this.eventsGateway.sendTableUpdates({
        type: 'abonnement_updated',
        memberId: updated.memberID,
        abonnementId: updated.id,
      });
      await this.syncOutbox.enqueue('abonnement', updated.id, 'UPDATE');
      return updated;
    } catch (error) {
      throw new GeneralException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.UPDATE_FAILED,
        (error as Error).message,
      );
    }
  }

  async remove(id: string) {
    const existing = await this.prisma.abonnement.findUnique({
      where: { id },
    });
    const deleted = await this.prisma.abonnement.delete({
      where: { id },
      include: {
        members: true,
        price: true,
      },
    });
    if (existing) {
      const other = await this.prisma.abonnement.findFirst({
        where: {
          memberID: existing.memberID,
          registredDate: { lte: new Date() },
          OR: [{ leaveDate: null }, { leaveDate: { gt: new Date() } }],
        },
      });
      if (!other) {
        await this.prisma.seatBooking.deleteMany({
          where: {
            memberId: existing.memberID,
            isPermanent: true,
            eventKey: 'collabora-hub',
          },
        });
      }
      await this.refreshMemberPlan(existing.memberID);
      this.eventsGateway.sendMemberStatusChanged({
        memberId: existing.memberID,
        reason: 'abonnement_deleted',
        abonnementId: existing.id,
      });
      this.eventsGateway.sendTableUpdates({
        type: 'abonnement_deleted',
        memberId: existing.memberID,
        abonnementId: existing.id,
      });
    }
    return deleted;
  }

  /**
   * Moves one recorded payment to the day the money was really collected,
   * so it is counted in that day's caisse instead of the day it was typed.
   */
  async updatePaymentDate(abonnementId: string, paymentId: string, paidAt: Date) {
    const payment = await this.prisma.abonnementPayment.findFirst({
      where: { id: paymentId, abonnementId },
    });
    if (!payment) {
      throw new GeneralException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Paiement introuvable.',
      );
    }
    const at = this.paymentMoment(paidAt);
    await this.prisma.abonnementPayment.update({
      where: { id: paymentId },
      data: { paidAt: at },
    });
    const abo = await this.prisma.abonnement.findUnique({
      where: { id: abonnementId },
      include: { payments: { orderBy: { paidAt: 'desc' }, take: 1 } },
    });
    if (abo?.isPayed && abo.payments[0]) {
      // Fully paid on the day of the last payment
      await this.prisma.abonnement.update({
        where: { id: abonnementId },
        data: { paidAt: abo.payments[0].paidAt },
      });
    }
    this.eventsGateway.sendTableUpdates({
      type: 'abonnement_updated',
      memberId: abo?.memberID,
      abonnementId,
    });
    await this.syncOutbox.enqueue('abonnement', abonnementId, 'UPDATE');
    return this.findOne(abonnementId);
  }

  /**
   * When the money was collected: now, or the chosen past day (late entry).
   * A past day keeps its date at noon so it lands in that day's caisse.
   */
  private paymentMoment(day?: Date | string | null) {
    const now = new Date();
    if (!day) return now;
    const d = new Date(day);
    if (Number.isNaN(d.getTime())) return now;
    if (d > endOfDay(now)) {
      throw new GeneralException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.INVALID_INPUT,
        'La date de paiement ne peut pas être dans le futur.',
      );
    }
    if (isSameDay(d, now)) return now;
    const noon = startOfDay(d);
    noon.setHours(12);
    return noon;
  }

  /** Member (or group) abonnement discount and the resulting price owed. */
  private async discountFor(memberId: string, price: { price: number }) {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      include: { group: true },
    });
    const percent = memberDiscountPercent(member, PriceCategory.ABONNEMENT);
    const amountDue =
      Math.round((price.price || 0) * (1 - (percent || 0) / 100) * 100) / 100;
    return { discountPercent: percent > 0 ? percent : null, amountDue };
  }

  /** Gift amount kept between 0 and the price; null when nothing is given away. */
  private clampOffered(value: number | null | undefined, max: number): number | null {
    const n = Math.round(Math.min(Math.max(0, Number(value) || 0), Math.max(0, max)) * 100) / 100;
    return n > 0.009 ? n : null;
  }

  /** A full payment is snapped to the discounted price; a partial one stays unpaid. */
  private settlePayment(
    isPayed: boolean | undefined,
    payedAmount: number | undefined,
    amountDue: number,
  ) {
    const paid = Number(payedAmount ?? 0);
    if (!isPayed) return { isPayed: false, payedAmount: paid };
    if (paid < amountDue - 0.009) return { isPayed: false, payedAmount: paid };
    return { isPayed: true, payedAmount: amountDue };
  }

  private async refreshMemberPlan(memberId: string) {
    const now = new Date();
    const others = await this.prisma.abonnement.findMany({
      where: {
        memberID: memberId,
        registredDate: { lte: now },
        OR: [{ leaveDate: null }, { leaveDate: { gt: now } }],
      },
      include: { price: true },
    });
    const active = others.some((sub) => {
      if (sub.price?.billingUnit === 'HOURLY') {
        const quota = sub.hoursQuota || sub.price.durationHours || 0;
        if (quota > 0 && (sub.hoursUsed || 0) >= quota) return false;
      }
      return true;
    });
    await this.prisma.member.update({
      where: { id: memberId },
      data: { plan: active ? Subscription.Membership : Subscription.Journal },
    });
  }

  private isPeriodPrice(
    price: {
      category?: string | null;
      type?: string;
      billingUnit?: string | null;
      reserveSeat?: boolean | null;
    } | null,
  ) {
    if (!price) return false;
    if (price.category !== 'ABONNEMENT' && price.type !== 'abonnement') {
      return false;
    }
    return price.billingUnit !== 'HOURLY';
  }

  private shouldReserveSeat(
    price: {
      category?: string | null;
      type?: string;
      billingUnit?: string | null;
      reserveSeat?: boolean | null;
    } | null,
    seatLabel: string | null | undefined,
  ) {
    if (!seatLabel?.trim()) return false;
    return !!price?.reserveSeat;
  }

  private async releasePermanentSeat(memberId: string) {
    await this.prisma.seatBooking.deleteMany({
      where: {
        memberId,
        isPermanent: true,
        eventKey: 'collabora-hub',
      },
    });
  }

  private startsAfterToday(registredDate?: Date | string | null) {
    return !!registredDate && new Date(registredDate) > endOfDay(new Date());
  }

  private async syncReservedSeat(
    memberId: string,
    seatLabel: string | null | undefined,
    price: {
      category?: string | null;
      type?: string;
      billingUnit?: string | null;
      reserveSeat?: boolean | null;
    } | null,
    leaveDate?: Date | null,
    spaceId?: string | null,
    registredDate?: Date | null,
  ) {
    // A renewal starting later must not move or release the seat of the current abonnement.
    if (this.startsAfterToday(registredDate)) return;
    const expired = !!leaveDate && new Date(leaveDate) <= new Date();
    const label = seatLabel?.trim() || '';
    if (expired || !this.shouldReserveSeat(price, label)) {
      await this.releasePermanentSeat(memberId);
      return;
    }
    const seat = await this.prisma.seat.findFirst({
      where: {
        label,
        isActive: true,
        ...(spaceId ? { spaceId } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!seat) return;
    const taken = await this.prisma.seatBooking.findFirst({
      where: {
        eventKey: 'collabora-hub',
        seatId: label,
        spaceId: seat.spaceId,
        isBooked: true,
        NOT: { memberId },
      },
    });
    if (taken) return;
    await this.prisma.seatBooking.deleteMany({
      where: {
        memberId,
        isBooked: true,
        eventKey: 'collabora-hub',
        NOT: { seatId: label, spaceId: seat.spaceId },
      },
    });
    await this.prisma.seatBooking.upsert({
      where: {
        eventKey_spaceId_seatId: {
          eventKey: 'collabora-hub',
          spaceId: seat.spaceId,
          seatId: label,
        },
      },
      create: {
        eventKey: 'collabora-hub',
        seatId: label,
        spaceId: seat.spaceId,
        isBooked: true,
        isPermanent: true,
        bookedAt: new Date(),
        memberId,
      },
      update: {
        isBooked: true,
        memberId,
        isPermanent: true,
        bookedAt: new Date(),
      },
    });
  }
}
