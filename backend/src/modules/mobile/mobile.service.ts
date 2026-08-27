import { randomUUID } from 'crypto';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { addDays, addHours, endOfDay, startOfDay } from 'date-fns';
import { PrismaService } from 'database/prisma.service';
import {
  CheckoutSessionDto,
  CreateVisitRequestDto,
  MobileLoginDto,
  MobileRegisterDto,
  QuickCheckInDto,
  QuickRegisterDto,
  StartDaySessionDto,
  StartSubscriptionDto,
  MoveSeatDto,
} from './dtos/mobile.dto';
import {
  BillingUnit,
  MobileSeatMode,
  PriceCategory,
  ProductOrderStatus,
  Subscription,
  VisitRequestStatus,
  VisitRequestType,
} from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventsGateway } from '../webSocket/events.gateway';

export const roundsOfHashing = 10;

@Injectable()
export class MobileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async sweepExpiredSubscriptionSeats() {
    await this.releaseStaleBookings();
  }

  private isPeriodKind(kind: 'HOURS_POOL' | 'SEMI_DAY' | 'FULL_DAY' | null) {
    return kind === 'SEMI_DAY' || kind === 'FULL_DAY';
  }

  private async releaseStaleBookings() {
    await this.prisma.seatBooking.deleteMany({
      where: {
        eventKey: 'collabora-hub',
        isPermanent: false,
        bookedAt: { lt: startOfDay(new Date()) },
      },
    });
    const permanent = await this.prisma.seatBooking.findMany({
      where: { eventKey: 'collabora-hub', isPermanent: true, isBooked: true },
    });
    for (const booking of permanent) {
      if (!booking.memberId) {
        await this.prisma.seatBooking.delete({ where: { id: booking.id } });
        continue;
      }
      const sub = await this.getActiveSubscription(booking.memberId);
      if (!sub) {
        await this.prisma.seatBooking.delete({ where: { id: booking.id } });
        continue;
      }
      const kind = sub.price ? this.subscriptionKind(sub.price) : null;
      const keepDedicated =
        !!sub.reservedSeatLabel ||
        !!(sub.price as { reserveSeat?: boolean } | null)?.reserveSeat ||
        this.isPeriodKind(kind);
      if (!keepDedicated) {
        await this.prisma.seatBooking.delete({ where: { id: booking.id } });
        continue;
      }
      if (sub.reservedSeatLabel && sub.reservedSeatLabel !== booking.seatId) {
        await this.prisma.seatBooking.delete({ where: { id: booking.id } });
      }
    }
  }

  private isOpenSpaceDay(price: {
    category?: string | null;
    billingUnit?: string | null;
  }) {
    return (
      price.category === PriceCategory.OPEN_SPACE &&
      price.billingUnit !== BillingUnit.HOURLY
    );
  }

  private inferSpaceCategory(name: string): PriceCategory {
    if (/salle|r[ée]union|meeting/i.test(name || '')) {
      return PriceCategory.SALLE;
    }
    if (/open|ouvert/i.test(name || '')) {
      return PriceCategory.OPEN_SPACE;
    }
    return PriceCategory.JOURNEE;
  }

  private spaceKind(space: {
    name?: string | null;
    category?: PriceCategory | null;
  }): PriceCategory {
    return space.category || this.inferSpaceCategory(space.name || '');
  }

  /** Quarter-hour billing, minimum 15 minutes. 1.5h stay → 1.5 × hourly rate. */
  private billableHours(from: Date, to: Date): number {
    const h = (to.getTime() - from.getTime()) / 3_600_000;
    return Math.max(0.25, Math.round(h * 4) / 4);
  }

  private isHourlyVisit(price: {
    billingUnit?: string | null;
    category?: string | null;
    type?: string | null;
  }) {
    return (
      price.billingUnit === BillingUnit.HOURLY &&
      price.category !== PriceCategory.ABONNEMENT &&
      price.type !== 'abonnement'
    );
  }

  private isFullDayPack(price: {
    category?: string | null;
    durationHours?: number | null;
  }) {
    if (price.category === PriceCategory.OPEN_SPACE) return false;
    return (price.durationHours || 0) >= 12;
  }

  private discountKind(price: {
    category?: string | null;
  }): 'forfait' | 'salle' | 'open' {
    if (price.category === PriceCategory.SALLE) return 'salle';
    if (price.category === PriceCategory.OPEN_SPACE) return 'open';
    return 'forfait';
  }

  private applyPercentOff(amount: number, percent: number) {
    if (!percent) return Math.round(amount * 100) / 100;
    return Math.round(amount * (1 - percent / 100) * 100) / 100;
  }

  private async resolveVisitDiscount(
    memberId: string | null | undefined,
    price: { category?: string | null },
  ): Promise<{ percent: number; groupName: string | null }> {
    if (!memberId) return { percent: 0, groupName: null };
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      include: { group: true },
    });
    if (!member) return { percent: 0, groupName: null };
    const kind = this.discountKind(price);
    const override =
      kind === 'salle'
        ? member.discountSalle
        : kind === 'open'
        ? member.discountOpenSpace
        : member.discountForfait;
    if (override != null) {
      return { percent: override, groupName: member.group?.name || null };
    }
    if (!member.group) return { percent: 0, groupName: null };
    const percent =
      kind === 'salle'
        ? member.group.discountSalle
        : kind === 'open'
        ? member.group.discountOpenSpace
        : member.group.discountForfait;
    return { percent: percent || 0, groupName: member.group.name };
  }

  private async seatOccupants(labels: string[]) {
    if (!labels.length) return [];
    const taken = await this.prisma.seatBooking.findMany({
      where: {
        eventKey: 'collabora-hub',
        isBooked: true,
        seatId: { in: labels },
      },
      include: { member: true },
    });
    if (!taken.length) return [];
    const seats = await this.prisma.seat.findMany({
      where: { label: { in: taken.map((t) => t.seatId) }, isActive: true },
      include: { space: true },
    });
    const spaceByLabel = new Map(
      seats.map((s) => [s.label, s.space?.name || null]),
    );
    return taken.map((t) => ({
      memberId: t.memberId,
      name: t.member
        ? [t.member.firstName, t.member.lastName].filter(Boolean).join(' ') ||
          t.member.phone ||
          'Visiteur'
        : 'Visiteur',
      seatLabel: t.seatId,
      spaceName: spaceByLabel.get(t.seatId) || null,
    }));
  }

  private async throwOccupied(
    message: string,
    labels: string[],
  ): Promise<never> {
    const occupants = await this.seatOccupants(labels);
    throw new ConflictException({ message, occupants });
  }

  private subscriptionKind(price: {
    category?: string | null;
    type?: string;
    billingUnit?: string | null;
    durationHours?: number | null;
  }): 'HOURS_POOL' | 'SEMI_DAY' | 'FULL_DAY' | null {
    if (
      price.category !== PriceCategory.ABONNEMENT &&
      price.type !== 'abonnement'
    ) {
      return null;
    }
    if (price.billingUnit === BillingUnit.HOURLY) return 'HOURS_POOL';
    if ((price.durationHours || 0) <= 6) return 'SEMI_DAY';
    return 'FULL_DAY';
  }

  private mapOrder(r: {
    id: string;
    quantite: number;
    status: ProductOrderStatus | string;
    isPayed: boolean;
    createdAt: Date;
    product?: {
      name?: string;
      sellingPrice?: number;
      img?: string | null;
    } | null;
  }) {
    return {
      id: r.id,
      productName: r.product?.name || 'Produit',
      quantity: r.quantite,
      amount: (r.product?.sellingPrice || 0) * r.quantite,
      img: r.product?.img || null,
      status: r.status,
      isPayed: r.isPayed,
      createdAt: r.createdAt,
      canEdit: r.status === ProductOrderStatus.PENDING,
    };
  }

  normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  private parseTunisiaPhone(raw: string): string {
    const input = (raw || '').trim();
    const parsed =
      parsePhoneNumberFromString(input, 'TN') ||
      parsePhoneNumberFromString(input);
    if (!parsed || parsed.country !== 'TN' || !parsed.isValid()) {
      throw new BadRequestException(
        'Seuls les numéros tunisiens (+216) sont acceptés',
      );
    }
    return parsed.number;
  }

  private phoneLookupVariants(phone: string): string[] {
    const digits = phone.replace(/\D/g, '');
    const national = digits.replace(/^216/, '');
    return Array.from(
      new Set(
        [phone, `+${digits}`, digits, national, `0${national}`].filter(Boolean),
      ),
    );
  }

  private async findMemberByPhone(phone: string) {
    const variants = this.phoneLookupVariants(phone);
    return this.prisma.member.findFirst({
      where: { phone: { in: variants } },
    });
  }

  async resolveFacilityBySlug(orgSlug?: string) {
    if (orgSlug) {
      const org = await this.prisma.organization.findUnique({
        where: { slug: orgSlug },
        include: {
          facilities: { orderBy: { createdAt: 'asc' }, take: 1 },
        },
      });
      if (!org) throw new NotFoundException('Organisation introuvable');
      const facility = org.facilities[0];
      if (!facility) {
        throw new NotFoundException('Aucun espace pour cette organisation');
      }
      return facility;
    }
    return this.prisma.facility.findFirst({
      orderBy: { createdAt: 'asc' },
    });
  }

  private async signMemberToken(memberId: string, phone: string | null) {
    return this.jwtService.signAsync(
      { sub: memberId, phone, kind: 'member' },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: '7d',
      },
    );
  }

  private todayVisitLabel(d = new Date()): string {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `Visite ${dd}/${mm}/${yyyy}`;
  }

  private async nextVisitorNumber(): Promise<number> {
    const last = await this.prisma.member.findFirst({
      where: { visitorNumber: { not: null } },
      orderBy: { visitorNumber: 'desc' },
      select: { visitorNumber: true },
    });
    return (last?.visitorNumber || 0) + 1;
  }

  private async ensureVisitorIdentity(
    member: {
      id: string;
      firstName: string | null;
      visitorNumber: number | null;
      plan: Subscription | null;
      passwordHash: string | null;
    },
    opts: { requirePassword: boolean; firstName?: string },
  ) {
    const updates: {
      visitorNumber?: number;
      firstName?: string;
      plan?: Subscription;
    } = {};

    if (member.visitorNumber == null) {
      updates.visitorNumber = await this.nextVisitorNumber();
    }

    // Non-subscribers keep a "Visite dd/mm/yyyy" label unless they set a real name after subscribe
    const isSubscribing = opts.requirePassword;
    if (!isSubscribing) {
      if (!member.firstName || member.firstName.startsWith('Visite ')) {
        updates.firstName = this.todayVisitLabel();
      }
    } else if (opts.firstName) {
      updates.firstName = opts.firstName;
    }

    if (Object.keys(updates).length === 0) {
      return this.prisma.member.findUnique({ where: { id: member.id } });
    }

    return this.prisma.member.update({
      where: { id: member.id },
      data: updates,
    });
  }

  async register(dto: MobileRegisterDto) {
    const phone = this.normalizePhone(dto.phone);
    if (!phone) {
      throw new BadRequestException('Phone number is required');
    }
    if (dto.requirePassword && !dto.password) {
      throw new BadRequestException(
        'Password is required for subscription signup',
      );
    }

    const existing = await this.prisma.member.findUnique({ where: { phone } });
    if (existing) {
      if (dto.password) {
        if (!existing.passwordHash) {
          const passwordHash = await bcrypt.hash(dto.password, roundsOfHashing);
          await this.prisma.member.update({
            where: { id: existing.id },
            data: {
              passwordHash,
              isActive: true,
              plan: dto.requirePassword
                ? Subscription.Membership
                : existing.plan,
            },
          });
        } else {
          const ok = await bcrypt.compare(dto.password, existing.passwordHash);
          if (!ok) {
            throw new UnauthorizedException('Invalid phone or password');
          }
        }
      }

      const refreshed = await this.ensureVisitorIdentity(
        { ...existing, passwordHash: existing.passwordHash },
        {
          requirePassword: dto.requirePassword,
          firstName: dto.firstName,
        },
      );
      const member = refreshed || existing;
      const accessToken = await this.signMemberToken(member.id, member.phone);
      return { member: this.sanitizeMember(member as any), accessToken };
    }

    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, roundsOfHashing)
      : null;

    const visitorNumber = await this.nextVisitorNumber();
    const firstName = dto.requirePassword
      ? dto.firstName || null
      : dto.firstName || this.todayVisitLabel();

    const member = await this.prisma.member.create({
      data: {
        phone,
        passwordHash,
        firstName,
        visitorNumber,
        credits: 0,
        isActive: true,
        plan: dto.requirePassword
          ? Subscription.Membership
          : Subscription.Journal,
      },
    });

    const accessToken = await this.signMemberToken(member.id, member.phone);
    return { member: this.sanitizeMember(member), accessToken };
  }

  async quickRegister(dto: QuickRegisterDto) {
    await this.resolveFacilityBySlug(dto.orgSlug);
    const firstName = (dto.firstName || '').trim();
    const lastName = (dto.lastName || '').trim();
    if (!firstName || !lastName) {
      throw new BadRequestException('Nom et prénom obligatoires');
    }
    const phone = this.parseTunisiaPhone(dto.phone);
    let member = await this.findMemberByPhone(phone);
    if (member) {
      member = await this.prisma.member.update({
        where: { id: member.id },
        data: {
          firstName,
          lastName,
          phone,
          visitorNumber:
            member.visitorNumber == null
              ? await this.nextVisitorNumber()
              : undefined,
          isActive: true,
        },
      });
    } else {
      member = await this.prisma.member.create({
        data: {
          phone,
          firstName,
          lastName,
          visitorNumber: await this.nextVisitorNumber(),
          credits: 0,
          isActive: true,
          plan: Subscription.Journal,
        },
      });
    }
    const accessToken = await this.signMemberToken(member.id, member.phone);
    return { member: this.sanitizeMember(member as any), accessToken };
  }

  async login(dto: MobileLoginDto) {
    const phone = this.normalizePhone(dto.phone);
    const member =
      (await this.findMemberByPhone(dto.phone)) ||
      (await this.prisma.member.findUnique({ where: { phone } }));
    if (!member) {
      throw new NotFoundException('Member not found');
    }
    if (member.passwordHash) {
      if (!dto.password) {
        throw new BadRequestException('Password required');
      }
      const ok = await bcrypt.compare(dto.password, member.passwordHash);
      if (!ok) {
        throw new UnauthorizedException('Invalid phone or password');
      }
    }
    const ensured = await this.ensureVisitorIdentity(member, {
      requirePassword: !!member.passwordHash,
    });
    const accessToken = await this.signMemberToken(
      (ensured || member).id,
      (ensured || member).phone,
    );
    return {
      member: this.sanitizeMember((ensured || member) as any),
      accessToken,
    };
  }

  private sanitizeMember(member: {
    id: string;
    phone: string | null;
    firstName: string | null;
    lastName: string | null;
    plan: Subscription | null;
    isActive: boolean;
    visitorNumber?: number | null;
    passwordHash?: string | null;
    bio?: string | null;
    functionality?: string | null;
    avatarUrl?: string | null;
    email?: string | null;
    skills?: string[] | null;
    services?: string[] | null;
    linkedinUrl?: string | null;
    openToCollaboration?: boolean | null;
    showInDirectory?: boolean | null;
  }) {
    return {
      id: member.id,
      phone: member.phone,
      firstName: member.firstName,
      lastName: member.lastName,
      plan: member.plan,
      isActive: member.isActive,
      visitorNumber: member.visitorNumber ?? null,
      isSubscribed:
        member.plan === Subscription.Membership || !!member.passwordHash,
      bio: member.bio || null,
      functionality: member.functionality || null,
      avatarUrl: member.avatarUrl || null,
      email: member.email || null,
      skills: member.skills || [],
      services: member.services || [],
      linkedinUrl: member.linkedinUrl || null,
      openToCollaboration: !!member.openToCollaboration,
      showInDirectory: !!member.showInDirectory,
    };
  }

  private hoursRemainingOnSub(sub: {
    hoursQuota?: number | null;
    hoursUsed?: number | null;
    price?: {
      category?: string | null;
      type?: string;
      billingUnit?: string | null;
      durationHours?: number | null;
    } | null;
  }) {
    if (this.subscriptionKind(sub.price || {}) !== 'HOURS_POOL') return null;
    return Math.max(
      0,
      (sub.hoursQuota || sub.price?.durationHours || 0) - (sub.hoursUsed || 0),
    );
  }

  private isHoursPoolExhausted(sub: {
    hoursQuota?: number | null;
    hoursUsed?: number | null;
    price?: {
      category?: string | null;
      type?: string;
      billingUnit?: string | null;
      durationHours?: number | null;
    } | null;
  }) {
    const left = this.hoursRemainingOnSub(sub);
    return left !== null && left <= 0;
  }

  async getActiveSubscription(memberId: string) {
    const now = new Date();
    const candidates = await this.prisma.abonnement.findMany({
      where: {
        memberID: memberId,
        registredDate: { lte: now },
        OR: [{ leaveDate: null }, { leaveDate: { gt: now } }],
      },
      include: { price: true },
      orderBy: { leaveDate: 'desc' },
    });
    const exhausted: string[] = [];
    for (const sub of candidates) {
      if (this.isHoursPoolExhausted(sub)) {
        exhausted.push(sub.id);
        continue;
      }
      if (exhausted.length) {
        await this.prisma.abonnement.updateMany({
          where: { id: { in: exhausted } },
          data: { leaveDate: now },
        });
      }
      return sub;
    }
    if (exhausted.length) {
      await this.prisma.abonnement.updateMany({
        where: { id: { in: exhausted } },
        data: { leaveDate: now },
      });
      await this.prisma.member.update({
        where: { id: memberId },
        data: { plan: Subscription.Journal },
      });
    }
    return null;
  }

  async getOpenSession(memberId: string) {
    const now = new Date();
    return this.prisma.journal.findFirst({
      where: {
        memberID: memberId,
        leaveTime: null,
        registredTime: {
          gte: startOfDay(now),
          lt: endOfDay(now),
        },
      },
      include: { prices: true, members: true },
      orderBy: { registredTime: 'desc' },
    });
  }

  async getStatus(memberId: string) {
    const [session, subscription, pendingRequest, seat, member] =
      await Promise.all([
        this.getOpenSession(memberId),
        this.getActiveSubscription(memberId),
        this.prisma.visitRequest.findFirst({
          where: {
            memberId,
            status: VisitRequestStatus.PENDING,
          },
          include: { price: true, member: true },
          orderBy: { createdAt: 'desc' },
        }),
        this.resolveSeatForMember(memberId),
        this.prisma.member.findUnique({ where: { id: memberId } }),
      ]);
    const daysRemaining = subscription?.leaveDate
      ? Math.max(
          0,
          Math.ceil(
            (new Date(subscription.leaveDate).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : null;
    const kind = subscription?.price
      ? this.subscriptionKind(subscription.price)
      : null;
    const hoursRemaining =
      kind === 'HOURS_POOL'
        ? Math.max(
            0,
            (subscription?.hoursQuota ||
              subscription?.price?.durationHours ||
              0) - (subscription?.hoursUsed || 0),
          )
        : null;

    return {
      session: session
        ? await this.enrichSessionWithSeat(session as any)
        : null,
      subscription: subscription
        ? {
            ...subscription,
            kind,
            daysRemaining,
            hoursRemaining,
            reservedSeatLabel: subscription.reservedSeatLabel || null,
          }
        : null,
      hasActiveSubscription: !!subscription,
      canChooseForfait: this.isPeriodKind(kind),
      mustScanToEnter: kind === 'HOURS_POOL' || this.isPeriodKind(kind),
      pendingRequest,
      hasOpenSession: !!session,
      seat,
      seatSettings: await this.getSeatSettings(),
      member: member ? this.sanitizeMember(member as any) : null,
    };
  }

  async getSeatSettings(orgSlug?: string) {
    const facility = orgSlug
      ? await this.resolveFacilityBySlug(orgSlug)
      : await this.prisma.facility.findFirst({
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            mobileSeatMode: true,
            receptionAway: true,
          },
        });
    return {
      facilityId: facility?.id || null,
      mobileSeatMode: facility?.mobileSeatMode || MobileSeatMode.ADMIN_ASSIGN,
      receptionAway: facility?.receptionAway ?? false,
    };
  }

  /** First free non-overflow seat (stable order), then overflow if needed. */
  async pickFreeSeatLabel(allowOverflow = true): Promise<string | null> {
    const seats = await this.prisma.seat.findMany({
      where: { isActive: true },
      include: { space: { select: { sortOrder: true, name: true } } },
      orderBy: [
        { isOverflow: 'asc' },
        { space: { sortOrder: 'asc' } },
        { label: 'asc' },
      ],
    });
    const bookings = await this.prisma.seatBooking.findMany({
      where: { isBooked: true, eventKey: 'collabora-hub' },
      select: { seatId: true },
    });
    const booked = new Set(bookings.map((b) => b.seatId));
    const normal = seats.find((s) => !s.isOverflow && !booked.has(s.label));
    if (normal) return normal.label;
    if (!allowOverflow) return null;
    const overflow = seats.find((s) => s.isOverflow && !booked.has(s.label));
    return overflow?.label || null;
  }

  async getFloorPlanForVisitor(orgSlug?: string) {
    const resolved = orgSlug
      ? await this.resolveFacilityBySlug(orgSlug)
      : await this.prisma.facility.findFirst({
          orderBy: { createdAt: 'asc' },
        });
    const facility = resolved
      ? await this.prisma.facility.findUnique({
          where: { id: resolved.id },
          include: {
            spaces: {
              orderBy: { sortOrder: 'asc' },
              include: {
                tables: {
                  orderBy: { sortOrder: 'asc' },
                  include: { seats: { where: { isActive: true } } },
                },
                seats: { where: { isActive: true } },
                walls: true,
              },
            },
          },
        })
      : null;
    const bookings = await this.prisma.seatBooking.findMany({
      where: { eventKey: 'collabora-hub', isBooked: true },
    });
    const settings = await this.getSeatSettings(orgSlug);
    return {
      facility: facility
        ? {
            id: facility.id,
            name: facility.name,
            mobileSeatMode: facility.mobileSeatMode,
            receptionAway: facility.receptionAway,
          }
        : null,
      spaces: facility?.spaces || [],
      bookings,
      seatSettings: settings,
    };
  }

  async claimSeat(memberId: string, seatLabel: string) {
    const settings = await this.getSeatSettings();
    if (settings.mobileSeatMode !== MobileSeatMode.VISITOR_CHOOSE) {
      throw new BadRequestException(
        'Le choix de place par le visiteur n’est pas activé',
      );
    }
    const open = await this.getOpenSession(memberId);
    if (!open) {
      throw new BadRequestException('Aucune session ouverte');
    }
    const sub = await this.getActiveSubscription(memberId);
    const kind = sub?.price ? this.subscriptionKind(sub.price) : null;
    if (kind === 'HOURS_POOL') {
      throw new BadRequestException(
        'Abonnement heures : l’accueil attribue votre place',
      );
    }
    if (this.isPeriodKind(kind)) {
      throw new BadRequestException(
        'Votre place d’abonnement est déjà réservée',
      );
    }
    const existing = await this.resolveSeatForMember(memberId);
    if (existing) {
      throw new ConflictException('Une place est déjà assignée');
    }
    await this.bookSeatForMember(memberId, seatLabel.trim());
    const seat = await this.resolveSeatForMember(memberId);
    this.eventsGateway.sendTableUpdates({
      type: 'seat_claimed',
      memberId,
      seatLabel: seatLabel.trim(),
    });
    return { seat };
  }

  async startDaySession(dto: StartDaySessionDto) {
    const member = await this.prisma.member.findUnique({
      where: { id: dto.memberId },
    });
    if (!member) throw new NotFoundException('Member not found');

    const price = await this.prisma.price.findUnique({
      where: { id: dto.priceId },
    });
    if (!price) throw new NotFoundException('Price not found');
    if (
      price.category === PriceCategory.ABONNEMENT ||
      price.type === 'abonnement'
    ) {
      throw new BadRequestException(
        'Les abonnements ne démarrent pas comme visite journalière',
      );
    }

    const activeSub = await this.getActiveSubscription(dto.memberId);
    const subKind = activeSub?.price
      ? this.subscriptionKind(activeSub.price)
      : null;
    if (subKind === 'HOURS_POOL') {
      throw new BadRequestException(
        'Abonnement heures : pointez (scan) pour entrer. L’accueil attribue la place.',
      );
    }

    await this.releaseStaleBookings();

    const existing = await this.getOpenSession(dto.memberId);
    if (existing) {
      throw new ConflictException('An open session already exists today');
    }

    const now = new Date();
    const isHourly = this.isHourlyVisit(price);
    const prepaidHours =
      dto.hours && dto.hours > 0
        ? dto.hours
        : isHourly && price.durationHours && price.durationHours > 0
        ? price.durationHours
        : null;
    const durationHours = isHourly ? prepaidHours : price.durationHours || 2;
    const expectedLeave =
      durationHours != null ? addHours(now, durationHours) : null;

    const payedAmountRaw = isHourly
      ? prepaidHours
        ? price.price * prepaidHours
        : 0
      : price.price;
    const discount = await this.resolveVisitDiscount(dto.memberId, price);
    const payedAmount = this.applyPercentOff(payedAmountRaw, discount.percent);

    const journal = await this.prisma.journal.create({
      data: {
        memberID: dto.memberId,
        priceId: dto.priceId,
        registredTime: now,
        leaveTime: null,
        isPayed: false,
        isReservation: false,
        payedAmount,
        groupVisitId: dto.groupVisitId || null,
      },
      include: { prices: true, members: { include: { group: true } } },
    });

    try {
      await this.applyVisitSpaceBooking(dto.memberId, price, {
        spaceId: dto.spaceId,
        reserveKind: dto.reserveKind,
        tableId: dto.tableId,
        seatLabel: dto.seatLabel,
        seatLabels: dto.seatLabels,
      });
    } catch (err) {
      await this.prisma.journal.delete({ where: { id: journal.id } });
      throw err;
    }

    return {
      ...journal,
      expectedLeaveTime: expectedLeave,
      remainingMs: expectedLeave
        ? Math.max(0, expectedLeave.getTime() - Date.now())
        : null,
      overtime: false,
      amountDue: payedAmount,
      coveredBySubscription: false,
      discountPercent: discount.percent,
      discountGroup: discount.groupName,
    };
  }

  async resumeByPhone(phoneRaw: string) {
    const phone = this.normalizePhone(phoneRaw || '');
    if (!phone) throw new BadRequestException('Phone is required');
    const member = await this.prisma.member.findUnique({ where: { phone } });
    if (!member) throw new NotFoundException('Member not found');
    const accessToken = await this.signMemberToken(member.id, member.phone);
    const status = await this.getStatus(member.id);
    return {
      member: this.sanitizeMember(member),
      accessToken,
      ...status,
      session: this.enrichSession(status.session as any),
    };
  }

  async checkoutSession(journalId: string, dto: CheckoutSessionDto) {
    const journal = await this.prisma.journal.findUnique({
      where: { id: journalId },
      include: { prices: true, members: true },
    });
    if (!journal) throw new NotFoundException('Session not found');
    // Checkout = leaveTime only. Payment (isPayed) is independent.
    if (journal.leaveTime) {
      throw new ConflictException('Session already checked out');
    }

    const now = new Date();
    const activeSub = journal.memberID
      ? await this.getActiveSubscription(journal.memberID)
      : null;
    const kind = activeSub?.price
      ? this.subscriptionKind(activeSub.price)
      : null;
    const isSubscriptionVisit =
      !!kind && !!activeSub && journal.priceId === activeSub.priceId;

    let payedAmount = journal.payedAmount;
    if (
      !isSubscriptionVisit &&
      journal.prices &&
      this.isHourlyVisit(journal.prices)
    ) {
      const elapsed = this.billableHours(new Date(journal.registredTime), now);
      const discount = await this.resolveVisitDiscount(
        journal.memberID,
        journal.prices,
      );
      const rate = this.applyPercentOff(journal.prices.price, discount.percent);
      payedAmount = Math.max(journal.payedAmount || 0, elapsed * rate);
    } else if (isSubscriptionVisit) {
      payedAmount = 0;
    }

    const updated = await this.prisma.journal.update({
      where: { id: journalId },
      data: {
        leaveTime: now,
        // Keep existing payment status unless explicitly sent
        ...(dto.isPayed !== undefined ? { isPayed: dto.isPayed } : {}),
        payedAmount,
        ...(isSubscriptionVisit ? { isPayed: true } : {}),
      },
      include: { prices: true, members: true },
    });
    if (kind === 'HOURS_POOL' && activeSub) {
      const hours = Math.max(
        0.25,
        Math.ceil(
          ((now.getTime() - new Date(journal.registredTime).getTime()) /
            (1000 * 60 * 60)) *
            4,
        ) / 4,
      );
      await this.prisma.abonnement.update({
        where: { id: activeSub.id },
        data: { hoursUsed: { increment: hours } },
      });
      const after = await this.prisma.abonnement.findUnique({
        where: { id: activeSub.id },
        include: { price: true },
      });
      if (after && this.isHoursPoolExhausted(after)) {
        await this.prisma.abonnement.update({
          where: { id: after.id },
          data: { leaveDate: now },
        });
        const still = await this.getActiveSubscription(after.memberID);
        if (!still) {
          await this.prisma.member.update({
            where: { id: after.memberID },
            data: { plan: Subscription.Journal },
          });
        }
      }
    }

    if (journal.memberID) {
      const keepDaySeat =
        this.isFullDayPack(journal.prices || {}) || kind === 'FULL_DAY';
      if (this.isPeriodKind(kind)) {
        await this.prisma.seatBooking.deleteMany({
          where: {
            memberId: journal.memberID,
            isBooked: true,
            isPermanent: false,
          },
        });
      } else if (this.isOpenSpaceDay(journal.prices || {}) || !keepDaySeat) {
        await this.prisma.seatBooking.deleteMany({
          where: {
            memberId: journal.memberID,
            isBooked: true,
            isPermanent: false,
          },
        });
      }
    }

    const durationMs = Math.max(
      0,
      now.getTime() - new Date(journal.registredTime).getTime(),
    );
    const totalMinutes = Math.floor(durationMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const durationLabel =
      hours > 0
        ? `${hours}h${minutes.toString().padStart(2, '0')}m`
        : `${minutes}min`;

    this.eventsGateway.sendVisitorCheckout({
      journalId: updated.id,
      memberId: updated.memberID,
      visitorNumber: updated.members?.visitorNumber ?? null,
      visitLabel: updated.members?.firstName || 'Visiteur',
      memberPhone: updated.members?.phone || null,
      priceName: updated.prices?.name || null,
      payedAmount: updated.payedAmount,
      isPayed: updated.isPayed,
      durationLabel,
      leaveTime: updated.leaveTime,
      registredTime: updated.registredTime,
    });
    this.eventsGateway.sendTableUpdates({
      type: 'visitor_checkout',
      journalId: updated.id,
      memberId: updated.memberID,
    });

    return updated;
  }

  /** Mark payment without checking out — visitor can stay. */
  async setPaymentStatus(journalId: string, isPayed: boolean) {
    const journal = await this.prisma.journal.findUnique({
      where: { id: journalId },
      include: { prices: true, members: true },
    });
    if (!journal) throw new NotFoundException('Session not found');

    const updated = await this.prisma.journal.update({
      where: { id: journalId },
      data: { isPayed },
      include: { prices: true, members: true },
    });

    this.eventsGateway.sendTableUpdates({
      type: 'payment_updated',
      journalId: updated.id,
      memberId: updated.memberID,
      isPayed: updated.isPayed,
    });

    return updated;
  }

  async startSubscription(dto: StartSubscriptionDto) {
    const member = await this.prisma.member.findUnique({
      where: { id: dto.memberId },
    });
    if (!member) throw new NotFoundException('Member not found');

    const price = await this.prisma.price.findUnique({
      where: { id: dto.priceId },
    });
    if (!price) throw new NotFoundException('Price not found');
    if (
      price.category !== PriceCategory.ABONNEMENT &&
      price.type !== 'abonnement'
    ) {
      throw new BadRequestException('Selected price is not a subscription');
    }

    const active = await this.getActiveSubscription(dto.memberId);
    if (active) {
      throw new ConflictException('An active subscription already exists');
    }

    const now = new Date();
    const periodDays = price.periodDays || 30;
    const leaveDate = addDays(now, periodDays);

    const abonnement = await this.prisma.abonnement.create({
      data: {
        memberID: dto.memberId,
        priceId: dto.priceId,
        registredDate: now,
        leaveDate,
        stayedPeriode: `${periodDays} days`,
        isPayed: dto.isPayed ?? true,
        isReservation: false,
        payedAmount: price.price,
        hoursQuota:
          price.billingUnit === BillingUnit.HOURLY ? price.durationHours : null,
        hoursUsed: 0,
        reservedSeatLabel: dto.reservedSeatLabel?.trim() || null,
      },
      include: { price: true, members: true },
    });

    await this.prisma.member.update({
      where: { id: dto.memberId },
      data: { plan: Subscription.Membership },
    });

    if (
      (price.reserveSeat || this.isPeriodKind(this.subscriptionKind(price))) &&
      dto.reservedSeatLabel
    ) {
      await this.bookSeatForMember(dto.memberId, dto.reservedSeatLabel.trim(), {
        permanent: true,
      });
    }

    return abonnement;
  }

  async quickCheckIn(dto: QuickCheckInDto) {
    const labels = [
      ...(dto.seatLabels || []),
      ...(dto.seatLabel ? [dto.seatLabel] : []),
    ]
      .map((s) => s.trim())
      .filter(Boolean);
    const unique = [...new Set(labels)];
    if (unique.length > 1) {
      return this.groupVisitCheckIn({ ...dto, seatLabels: unique });
    }

    if (dto.anonymous) {
      return this.startAnonymousDaySession(dto);
    }

    let memberId = dto.memberId;

    if (!memberId) {
      if (!dto.phone) {
        throw new BadRequestException('memberId or phone is required');
      }
      const phone = this.normalizePhone(dto.phone);
      let member = await this.prisma.member.findUnique({ where: { phone } });
      if (!member) {
        const visitorNumber = await this.nextVisitorNumber();
        member = await this.prisma.member.create({
          data: {
            phone,
            firstName: dto.firstName || this.todayVisitLabel(),
            visitorNumber,
            credits: 0,
            isActive: true,
            plan: Subscription.Journal,
          },
        });
      } else {
        member = (await this.ensureVisitorIdentity(member, {
          requirePassword: false,
          firstName: dto.firstName,
        })) as typeof member;
      }
      memberId = member.id;
    } else {
      const member = await this.prisma.member.findUnique({
        where: { id: memberId },
      });
      if (member) {
        await this.ensureVisitorIdentity(member, { requirePassword: false });
      }
    }

    const activeSub = await this.getActiveSubscription(memberId);
    const subKind = activeSub?.price
      ? this.subscriptionKind(activeSub.price)
      : null;
    if (subKind === 'HOURS_POOL') {
      return this.startSubscriptionSession(memberId);
    }

    return this.startDaySession({
      memberId,
      priceId: dto.priceId,
      spaceId: dto.spaceId,
      reserveKind: dto.reserveKind,
      hours: dto.hours,
      tableId: dto.tableId,
      seatLabel: dto.seatLabel || unique[0],
      seatLabels: dto.seatLabels,
      groupVisitId: dto.groupVisitId,
    });
  }

  async groupVisitCheckIn(dto: QuickCheckInDto) {
    const labels = [...new Set((dto.seatLabels || []).map((s) => s.trim()))];
    if (labels.length < 2) {
      return this.quickCheckIn({
        ...dto,
        seatLabels: undefined,
        seatLabel: labels[0],
      });
    }
    const groupVisitId = dto.groupVisitId || randomUUID();
    const hostDto: QuickCheckInDto = {
      ...dto,
      seatLabel: labels[0],
      seatLabels: undefined,
      groupVisitId,
      reserveKind: 'none',
      spaceId: undefined,
      tableId: undefined,
    };
    const host = dto.anonymous
      ? await this.startAnonymousDaySession(hostDto)
      : await this.quickCheckIn({ ...hostDto, anonymous: false });
    const baseName =
      (dto.guestName || dto.firstName || '').trim() ||
      (host as { members?: { firstName?: string | null } }).members
        ?.firstName ||
      'Groupe';
    const extras = [];
    for (let i = 1; i < labels.length; i++) {
      extras.push(
        await this.startAnonymousDaySession({
          ...dto,
          anonymous: true,
          guestName: `${baseName} · ${labels[i]}`,
          seatLabel: labels[i],
          seatLabels: undefined,
          groupVisitId,
          reserveKind: 'none',
          spaceId: undefined,
          tableId: undefined,
        }),
      );
    }
    return {
      groupVisitId,
      count: 1 + extras.length,
      journals: [host, ...extras],
      ...host,
    };
  }

  /** Walk-in journal with no Member row — counts in finance/journal. */
  async startAnonymousDaySession(dto: QuickCheckInDto) {
    const price = await this.prisma.price.findUnique({
      where: { id: dto.priceId },
    });
    if (!price) throw new NotFoundException('Price not found');

    const now = new Date();
    const isHourly = this.isHourlyVisit(price);
    const prepaidHours =
      dto.hours && dto.hours > 0
        ? dto.hours
        : isHourly && price.durationHours && price.durationHours > 0
        ? price.durationHours
        : null;
    const durationHours = isHourly ? prepaidHours : price.durationHours || 2;
    const expectedLeave =
      durationHours != null ? addHours(now, durationHours) : null;
    const payedAmountRaw = isHourly
      ? prepaidHours
        ? price.price * prepaidHours
        : 0
      : price.price;
    const discount = await this.resolveVisitDiscount(
      dto.bookForMemberId || dto.memberId,
      price,
    );
    const payedAmount = this.applyPercentOff(payedAmountRaw, discount.percent);

    const guestName =
      (dto.guestName || dto.firstName || '').trim() || 'Visiteur anonyme';

    const journal = await this.prisma.journal.create({
      data: {
        memberID: null,
        isAnonymous: true,
        guestName,
        priceId: dto.priceId,
        registredTime: now,
        leaveTime: null,
        isPayed: false,
        isReservation: false,
        payedAmount,
        createdbyUserID: dto.createdbyUserID || null,
        groupVisitId: dto.groupVisitId || null,
      },
      include: { prices: true, members: true },
    });

    try {
      const seat = dto.seatLabel || dto.seatLabels?.[0];
      if (seat) {
        if (dto.bookForMemberId) {
          await this.bookSeatForMember(dto.bookForMemberId, seat, {
            keepExisting: true,
          });
        } else {
          await this.bookAnonymousSeat(seat);
        }
      }
    } catch (err) {
      await this.prisma.journal.delete({ where: { id: journal.id } });
      throw err;
    }

    this.eventsGateway.sendTableUpdates({
      type: 'anonymous_checkin',
      journalId: journal.id,
    });

    return {
      ...journal,
      expectedLeaveTime: expectedLeave,
      remainingMs: expectedLeave
        ? Math.max(0, expectedLeave.getTime() - Date.now())
        : null,
      overtime: false,
      amountDue: payedAmount,
      coveredBySubscription: false,
      discountPercent: discount.percent,
      discountGroup: discount.groupName,
    };
  }

  private async resolveSeatForMember(memberId: string | null | undefined) {
    if (!memberId) return null;
    const booking = await this.prisma.seatBooking.findFirst({
      where: { memberId, isBooked: true, eventKey: 'collabora-hub' },
    });
    if (!booking) return null;
    const seat = await this.prisma.seat.findFirst({
      where: { label: booking.seatId, isActive: true },
      include: {
        table: true,
        space: true,
      },
    });
    if (!seat) {
      return {
        seatLabel: booking.seatId,
        tableName: null as string | null,
        spaceName: null as string | null,
        isOverflow: false,
      };
    }
    return {
      seatLabel: seat.label,
      tableName: seat.table?.name || null,
      spaceName: seat.space?.name || null,
      isOverflow: seat.isOverflow,
    };
  }

  async bookSeatForMember(
    memberId: string,
    seatLabel: string,
    opts?: { permanent?: boolean; keepExisting?: boolean },
  ) {
    const permanent = !!opts?.permanent;
    const existing = await this.prisma.seatBooking.findUnique({
      where: {
        eventKey_seatId: { eventKey: 'collabora-hub', seatId: seatLabel },
      },
    });
    if (
      existing?.isBooked &&
      existing.memberId &&
      existing.memberId !== memberId
    ) {
      await this.throwOccupied('Cette place est déjà prise', [seatLabel]);
    }
    if (!opts?.keepExisting) {
      await this.prisma.seatBooking.deleteMany({
        where: {
          memberId,
          isBooked: true,
          eventKey: 'collabora-hub',
          ...(permanent ? {} : { isPermanent: false }),
          NOT: { seatId: seatLabel },
        },
      });
    }
    return this.prisma.seatBooking.upsert({
      where: {
        eventKey_seatId: { eventKey: 'collabora-hub', seatId: seatLabel },
      },
      create: {
        eventKey: 'collabora-hub',
        seatId: seatLabel,
        isBooked: true,
        isPermanent: permanent,
        bookedAt: new Date(),
        memberId,
      },
      update: {
        isBooked: true,
        memberId,
        isPermanent: permanent || existing?.isPermanent || false,
        bookedAt: new Date(),
      },
    });
  }

  async bookAnonymousSeat(seatLabel: string) {
    const existing = await this.prisma.seatBooking.findFirst({
      where: {
        eventKey: 'collabora-hub',
        seatId: seatLabel,
        isBooked: true,
      },
    });
    if (existing) {
      await this.throwOccupied('Cette place est déjà prise', [seatLabel]);
    }
    return this.prisma.seatBooking.create({
      data: {
        eventKey: 'collabora-hub',
        seatId: seatLabel,
        isBooked: true,
        bookedAt: new Date(),
        memberId: null,
      },
    });
  }

  async applyVisitSpaceBooking(
    memberId: string,
    price: {
      spaceId?: string | null;
      category?: string | null;
      billingUnit?: string | null;
    },
    opts?: {
      spaceId?: string;
      reserveKind?: 'open' | 'salle' | 'all' | 'none';
      tableId?: string;
      seatLabel?: string;
      seatLabels?: string[];
    },
  ) {
    const labels = [
      ...(opts?.seatLabels || []),
      ...(opts?.seatLabel ? [opts.seatLabel] : []),
    ]
      .map((s) => s.trim())
      .filter(Boolean);
    const unique = [...new Set(labels)];
    if (unique.length) {
      for (let i = 0; i < unique.length; i++) {
        await this.bookSeatForMember(memberId, unique[i], {
          keepExisting: i > 0,
        });
      }
      return;
    }
    if (opts?.reserveKind === 'none') return;
    if (opts?.reserveKind) {
      await this.bookSeatsForMemberByKind(memberId, {
        kind: opts.reserveKind,
      });
      return;
    }
    if (opts?.spaceId || opts?.tableId) {
      await this.bookSeatsForMemberByKind(memberId, {
        spaceId: opts.spaceId,
        tableId: opts?.tableId,
      });
    }
  }

  async bookSeatsForMemberByKind(
    memberId: string,
    opts: {
      spaceId?: string;
      kind?: 'open' | 'salle' | 'all' | 'none';
      tableId?: string;
    },
  ) {
    if (opts.kind === 'none') return;
    const spaces = await this.prisma.space.findMany({
      include: { seats: { where: { isActive: true } } },
      orderBy: { sortOrder: 'asc' },
    });
    let target = spaces;
    let label = 'espace';
    if (opts.tableId) {
      const table = await this.prisma.table.findUnique({
        where: { id: opts.tableId },
        include: { seats: { where: { isActive: true } }, space: true },
      });
      if (!table) throw new BadRequestException('Table introuvable');
      const seats = table.seats.filter((seat) => !seat.isOverflow);
      const labels = seats.map((seat) => seat.label);
      if (!labels.length) {
        throw new BadRequestException(`Aucune place sur ${table.name}`);
      }
      await this.bookSeatLabels(memberId, labels, table.name);
      return { booked: labels.length, label: table.name };
    }
    if (opts.spaceId) {
      target = spaces.filter((s) => s.id === opts.spaceId);
      label = target[0]?.name || 'espace';
    } else if (opts.kind === 'open') {
      const open = spaces.filter(
        (s) => this.spaceKind(s) === PriceCategory.OPEN_SPACE,
      );
      if (!open.length) {
        throw new BadRequestException('Aucun open space créé');
      }
      target = open;
      label = 'open space';
    } else if (opts.kind === 'salle') {
      const salle = spaces.filter(
        (s) => this.spaceKind(s) === PriceCategory.SALLE,
      );
      if (!salle.length) {
        throw new BadRequestException('Aucune salle de réunion créée');
      }
      target = salle;
      label = 'salle de réunion';
    } else if (opts.kind === 'all') {
      label = 'tous les espaces';
    } else if (!opts.spaceId) {
      return;
    }

    const labels = target.flatMap((s) =>
      s.seats.filter((seat) => !seat.isOverflow).map((seat) => seat.label),
    );
    if (!labels.length) {
      throw new BadRequestException(`Aucune place à réserver (${label})`);
    }
    await this.bookSeatLabels(memberId, labels, label);
    return { booked: labels.length, label };
  }

  async moveSeat(dto: MoveSeatDto) {
    const toLabel = dto.toSeatLabel.trim();
    if (!toLabel) throw new BadRequestException('Place cible requise');
    if (!dto.memberId && !dto.fromSeatLabel) {
      throw new BadRequestException('memberId ou fromSeatLabel requis');
    }

    const dest = await this.prisma.seatBooking.findFirst({
      where: {
        eventKey: 'collabora-hub',
        seatId: toLabel,
        isBooked: true,
      },
    });
    if (dest) {
      await this.throwOccupied('La place cible est déjà prise', [toLabel]);
    }

    let booking = dto.fromSeatLabel
      ? await this.prisma.seatBooking.findFirst({
          where: {
            eventKey: 'collabora-hub',
            seatId: dto.fromSeatLabel.trim(),
            isBooked: true,
          },
        })
      : null;
    if (!booking && dto.memberId) {
      const many = await this.prisma.seatBooking.findMany({
        where: {
          memberId: dto.memberId,
          isBooked: true,
          eventKey: 'collabora-hub',
        },
      });
      if (many.length > 1 && !dto.fromSeatLabel) {
        throw new BadRequestException(
          'Plusieurs places — précisez fromSeatLabel',
        );
      }
      booking = many[0] || null;
    }
    if (!booking) throw new NotFoundException('Place source introuvable');
    if (dto.memberId && booking.memberId && booking.memberId !== dto.memberId) {
      throw new BadRequestException('Cette place n’appartient pas au visiteur');
    }

    const updated = await this.prisma.seatBooking.update({
      where: { id: booking.id },
      data: { seatId: toLabel, bookedAt: new Date() },
    });
    this.eventsGateway.sendTableUpdates({
      type: 'seat_moved',
      memberId: booking.memberId,
      fromSeatLabel: booking.seatId,
      toSeatLabel: toLabel,
    });
    return updated;
  }

  private async bookSeatLabels(
    memberId: string,
    labels: string[],
    label: string,
  ) {
    const taken = await this.prisma.seatBooking.findMany({
      where: {
        eventKey: 'collabora-hub',
        isBooked: true,
        seatId: { in: labels },
        NOT: { memberId },
      },
    });
    if (taken.length) {
      await this.throwOccupied(
        `${label} occupé (${taken.length} place(s) déjà prises)`,
        taken.map((t) => t.seatId),
      );
    }
    await this.prisma.seatBooking.deleteMany({
      where: {
        memberId,
        isBooked: true,
        eventKey: 'collabora-hub',
        isPermanent: false,
      },
    });
    await this.prisma.seatBooking.createMany({
      data: labels.map((seatId) => ({
        eventKey: 'collabora-hub',
        seatId,
        isBooked: true,
        bookedAt: new Date(),
        memberId,
      })),
    });
  }

  async bookAllOpenSpaceSeats(memberId: string) {
    return this.bookSeatsForMemberByKind(memberId, { kind: 'open' });
  }

  /** Check-in for active subscription — creates a journal row (visible in admin journal). */
  async startSubscriptionSession(memberId: string) {
    const sub = await this.getActiveSubscription(memberId);
    if (!sub?.price) {
      throw new BadRequestException('Aucun abonnement actif');
    }

    await this.releaseStaleBookings();

    if (await this.getOpenSession(memberId)) {
      throw new ConflictException('Session déjà ouverte');
    }

    const kind = this.subscriptionKind(sub.price);
    if (kind === 'SEMI_DAY') {
      const today = await this.prisma.journal.findFirst({
        where: {
          memberID: memberId,
          registredTime: {
            gte: startOfDay(new Date()),
            lt: endOfDay(new Date()),
          },
        },
      });
      if (today) {
        throw new ConflictException('Demi-journée : un seul check-in par jour');
      }
    }
    if (kind === 'HOURS_POOL') {
      const remaining =
        (sub.hoursQuota || sub.price.durationHours || 0) - (sub.hoursUsed || 0);
      if (remaining <= 0) {
        throw new BadRequestException('Heures d’abonnement épuisées');
      }
    }

    const now = new Date();
    const packHours =
      kind === 'SEMI_DAY'
        ? 6
        : kind === 'FULL_DAY'
        ? sub.price.durationHours || 12
        : null;
    const expectedLeave = packHours ? addHours(now, packHours) : null;

    const journal = await this.prisma.journal.create({
      data: {
        memberID: memberId,
        priceId: sub.priceId,
        registredTime: now,
        leaveTime: null,
        isPayed: true,
        isReservation: false,
        payedAmount: 0,
      },
      include: { prices: true, members: true },
    });

    if (
      sub.reservedSeatLabel &&
      (this.isPeriodKind(kind) ||
        !!(sub.price as { reserveSeat?: boolean }).reserveSeat)
    ) {
      await this.bookSeatForMember(memberId, sub.reservedSeatLabel, {
        permanent: true,
      });
    }

    const seat = await this.resolveSeatForMember(memberId);

    this.eventsGateway.sendTableUpdates({
      type: 'subscription_scan_in',
      journalId: journal.id,
      memberId,
      seatLabel: seat?.seatLabel || null,
    });

    return {
      ...journal,
      expectedLeaveTime: expectedLeave,
      remainingMs: expectedLeave
        ? Math.max(0, expectedLeave.getTime() - Date.now())
        : kind === 'HOURS_POOL'
        ? Math.max(
            0,
            ((sub.hoursQuota || sub.price.durationHours || 0) -
              (sub.hoursUsed || 0)) *
              3600_000,
          )
        : null,
      overtime: false,
      amountDue: 0,
      coveredBySubscription: true,
      subscriptionKind: kind,
      seat,
    };
  }

  async scanIn(memberId: string) {
    return this.startSubscriptionSession(memberId);
  }

  enrichSession(
    session: {
      id: string;
      registredTime: Date;
      leaveTime: Date | null;
      payedAmount: number;
      isPayed: boolean;
      prices: {
        durationHours: number | null;
        billingUnit: BillingUnit | null;
        price: number;
        name: string;
        category?: PriceCategory | null;
      } | null;
    } | null,
  ) {
    if (!session) return null;
    const isHourly = session.prices
      ? this.isHourlyVisit(session.prices)
      : false;
    const durationHours = isHourly
      ? session.prices?.durationHours && session.prices.durationHours > 0
        ? session.prices.durationHours
        : null
      : session.prices?.durationHours || 2;
    const expectedLeaveTime =
      durationHours != null
        ? addHours(new Date(session.registredTime), durationHours)
        : null;
    const now = Date.now();
    const remainingMs = expectedLeaveTime
      ? expectedLeaveTime.getTime() - now
      : null;
    const overtime = remainingMs !== null && remainingMs < 0;

    let amountDue = session.payedAmount;
    if (isHourly && session.prices && !session.leaveTime) {
      const elapsed = this.billableHours(
        new Date(session.registredTime),
        new Date(now),
      );
      amountDue = Math.max(
        session.payedAmount || 0,
        elapsed * session.prices.price,
      );
    }

    return {
      ...session,
      expectedLeaveTime,
      remainingMs,
      overtime,
      amountDue,
    };
  }

  async enrichSessionWithSeat(
    session: Parameters<MobileService['enrichSession']>[0] & {
      memberID?: string | null;
      priceId?: string;
    },
  ) {
    const base = this.enrichSession(session);
    if (!base) return null;
    const seat = await this.resolveSeatForMember(session?.memberID);
    const sub = session?.memberID
      ? await this.getActiveSubscription(session.memberID)
      : null;
    const kind =
      sub?.price && session.priceId === sub.priceId
        ? this.subscriptionKind(sub.price)
        : sub?.price && session.prices?.category === PriceCategory.ABONNEMENT
        ? this.subscriptionKind(sub.price)
        : null;
    const sessionElapsedMs = Math.max(
      0,
      Date.now() - new Date(session.registredTime).getTime(),
    );
    const hoursQuota = sub?.hoursQuota || sub?.price?.durationHours || 0;
    const hoursUsed = sub?.hoursUsed || 0;

    if (kind === 'HOURS_POOL' && sub && !session.leaveTime) {
      const remainingHours = Math.max(0, hoursQuota - hoursUsed);
      const elapsedHours = sessionElapsedMs / (1000 * 60 * 60);
      const poolRemainingMs = (remainingHours - elapsedHours) * 3600_000;
      return {
        ...base,
        seat,
        remainingMs: poolRemainingMs,
        sessionElapsedMs,
        overtime: poolRemainingMs < 0,
        amountDue: 0,
        coveredBySubscription: true,
        subscriptionKind: kind,
        hoursQuota,
        hoursUsed,
        hoursRemaining: Math.max(0, remainingHours - elapsedHours),
        hoursConsumedThisSession: elapsedHours,
      };
    }
    if (kind) {
      return {
        ...base,
        seat,
        sessionElapsedMs,
        amountDue: 0,
        coveredBySubscription: true,
        subscriptionKind: kind,
        hoursQuota: kind === 'HOURS_POOL' ? hoursQuota : null,
        hoursUsed: kind === 'HOURS_POOL' ? hoursUsed : null,
      };
    }
    return { ...base, seat, sessionElapsedMs };
  }

  async createVisitRequest(dto: CreateVisitRequestDto) {
    const member = await this.prisma.member.findUnique({
      where: { id: dto.memberId },
    });
    if (!member) throw new NotFoundException('Member not found');

    const price = await this.prisma.price.findUnique({
      where: { id: dto.priceId },
    });
    if (!price) throw new NotFoundException('Price not found');

    if (dto.type === VisitRequestType.DAY) {
      const activeSub = await this.getActiveSubscription(dto.memberId);
      const subKind = activeSub?.price
        ? this.subscriptionKind(activeSub.price)
        : null;
      if (subKind === 'HOURS_POOL') {
        throw new BadRequestException(
          'Abonnement heures : pointez (scan) pour entrer. Pas de forfait.',
        );
      }
      const openSession = await this.getOpenSession(dto.memberId);
      if (openSession) {
        throw new ConflictException(
          'You already have an open session today. Check out before starting another.',
        );
      }
    }

    const existing = await this.prisma.visitRequest.findFirst({
      where: {
        memberId: dto.memberId,
        status: VisitRequestStatus.PENDING,
      },
    });
    if (existing) {
      throw new ConflictException(
        'You already have a pending request. Please wait for reception.',
      );
    }

    const request = await this.prisma.visitRequest.create({
      data: {
        memberId: dto.memberId,
        priceId: dto.priceId,
        type: dto.type,
        status: VisitRequestStatus.PENDING,
      },
      include: {
        member: true,
        price: true,
      },
    });

    const payload = {
      id: request.id,
      type: request.type,
      status: request.status,
      priceName: request.price.name,
      priceAmount: request.price.price,
      memberName:
        [request.member.firstName, request.member.lastName]
          .filter(Boolean)
          .join(' ') || 'Visiteur',
      memberPhone: request.member.phone,
      visitorNumber: request.member.visitorNumber,
      memberId: request.memberId,
      priceId: request.priceId,
      createdAt: request.createdAt,
    };

    this.eventsGateway.sendVisitRequest(payload);

    const settings = await this.getSeatSettings();
    if (
      settings.mobileSeatMode === MobileSeatMode.AUTO_ASSIGN &&
      settings.receptionAway
    ) {
      // Unattended reception: auto-confirm + auto seat
      const approved = await this.approveVisitRequest(request.id);
      return {
        ...approved.request,
        autoApproved: true,
        seat: approved.seat,
        mobileSeatMode: settings.mobileSeatMode,
        receptionAway: settings.receptionAway,
      };
    }

    return {
      ...request,
      mobileSeatMode: settings.mobileSeatMode,
      receptionAway: settings.receptionAway,
      autoApproved: false,
    };
  }

  async listVisitRequests(status?: VisitRequestStatus) {
    return this.prisma.visitRequest.findMany({
      where: status ? { status } : undefined,
      include: { member: true, price: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getVisitRequest(id: string) {
    const request = await this.prisma.visitRequest.findUnique({
      where: { id },
      include: { member: true, price: true },
    });
    if (!request) throw new NotFoundException('Visit request not found');
    return request;
  }

  async approveVisitRequest(id: string, seatLabel?: string) {
    const request = await this.getVisitRequest(id);
    if (request.status !== VisitRequestStatus.PENDING) {
      throw new ConflictException('Request already resolved');
    }

    const settings = await this.getSeatSettings();
    let assignedLabel = seatLabel?.trim() || null;
    const requestKind = this.subscriptionKind(request.price);
    const hoursSub =
      request.type === VisitRequestType.SUBSCRIPTION &&
      requestKind === 'HOURS_POOL';
    const wantsDedicatedSeat =
      request.type === VisitRequestType.SUBSCRIPTION &&
      (!!(request.price as { reserveSeat?: boolean }).reserveSeat ||
        this.isPeriodKind(requestKind));
    const skipSeat =
      (hoursSub && !wantsDedicatedSeat) || this.isOpenSpaceDay(request.price);

    if (wantsDedicatedSeat) {
      if (!assignedLabel) {
        throw new BadRequestException(
          'Sélectionnez la place réservée pour cet abonnement',
        );
      }
    } else if (skipSeat) {
      assignedLabel = null;
    } else if (settings.mobileSeatMode === MobileSeatMode.ADMIN_ASSIGN) {
      if (!assignedLabel) {
        throw new BadRequestException(
          'Sélectionnez une place sur le plan avant de confirmer',
        );
      }
    } else if (settings.mobileSeatMode === MobileSeatMode.AUTO_ASSIGN) {
      if (!assignedLabel) {
        assignedLabel = await this.pickFreeSeatLabel(true);
      }
      if (!assignedLabel) {
        throw new BadRequestException('Aucune place libre disponible');
      }
    } else {
      assignedLabel = assignedLabel || null;
    }

    let result: unknown;
    if (request.type === VisitRequestType.DAY) {
      result = await this.startDaySession({
        memberId: request.memberId,
        priceId: request.priceId,
      });
    } else {
      result = await this.startSubscription({
        memberId: request.memberId,
        priceId: request.priceId,
        isPayed: true,
        reservedSeatLabel: wantsDedicatedSeat
          ? assignedLabel || undefined
          : undefined,
      });
    }

    if (assignedLabel && !this.isOpenSpaceDay(request.price)) {
      const activeSub = await this.getActiveSubscription(request.memberId);
      const memberKind = activeSub?.price
        ? this.subscriptionKind(activeSub.price)
        : requestKind;
      if (
        request.type === VisitRequestType.DAY &&
        this.isPeriodKind(memberKind)
      ) {
        // Keep dedicated desk; do not reassign for extra forfait.
      } else {
        await this.bookSeatForMember(request.memberId, assignedLabel, {
          permanent: wantsDedicatedSeat,
        });
      }
    }

    const updated = await this.prisma.visitRequest.update({
      where: { id },
      data: { status: VisitRequestStatus.APPROVED },
      include: { member: true, price: true },
    });

    const seat = assignedLabel
      ? await this.resolveSeatForMember(updated.memberId)
      : null;

    this.eventsGateway.sendVisitRequestResolved({
      id: updated.id,
      status: updated.status,
      type: updated.type,
      memberId: updated.memberId,
      seat,
      mobileSeatMode: settings.mobileSeatMode,
    });
    this.eventsGateway.sendTableUpdates({
      type: 'visit_approved',
      memberId: updated.memberId,
      requestId: updated.id,
      seatLabel: assignedLabel,
    });

    return {
      request: updated,
      result,
      seat,
      mobileSeatMode: settings.mobileSeatMode,
    };
  }

  async rejectVisitRequest(id: string) {
    const request = await this.getVisitRequest(id);
    if (request.status !== VisitRequestStatus.PENDING) {
      throw new ConflictException('Request already resolved');
    }

    const updated = await this.prisma.visitRequest.update({
      where: { id },
      data: { status: VisitRequestStatus.REJECTED },
      include: { member: true, price: true },
    });

    this.eventsGateway.sendVisitRequestResolved({
      id: updated.id,
      status: updated.status,
      type: updated.type,
      memberId: updated.memberId,
    });

    return updated;
  }

  /** Visitor cancels their own pending request to pick another pack. */
  async cancelVisitRequest(id: string, memberId: string) {
    const request = await this.getVisitRequest(id);
    if (request.memberId !== memberId) {
      throw new ConflictException('Not your visit request');
    }
    if (request.status !== VisitRequestStatus.PENDING) {
      throw new ConflictException('Request already resolved');
    }

    const updated = await this.prisma.visitRequest.update({
      where: { id },
      data: { status: VisitRequestStatus.REJECTED },
      include: { member: true, price: true },
    });

    this.eventsGateway.sendVisitRequestResolved({
      id: updated.id,
      status: 'CANCELLED',
      type: updated.type,
      memberId: updated.memberId,
    });
    this.eventsGateway.sendTableUpdates({
      type: 'visit_cancelled',
      memberId: updated.memberId,
      requestId: updated.id,
    });

    return updated;
  }

  async getVisitHistory(memberId: string) {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
    });
    if (!member) throw new NotFoundException('Member not found');

    const journals = await this.prisma.journal.findMany({
      where: { memberID: memberId },
      include: { prices: true },
      orderBy: { registredTime: 'desc' },
      take: 100,
    });

    const now = new Date();
    return journals.map((j) => {
      const end = j.leaveTime || now;
      const start = new Date(j.registredTime);
      const durationMs = Math.max(0, end.getTime() - start.getTime());
      const totalMinutes = Math.floor(durationMs / (1000 * 60));
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const durationLabel =
        hours > 0
          ? `${hours}h${minutes.toString().padStart(2, '0')}m`
          : `${minutes}min`;

      return {
        id: j.id,
        date: j.registredTime,
        registredTime: j.registredTime,
        leaveTime: j.leaveTime,
        durationMs,
        durationLabel,
        payedAmount: j.payedAmount,
        isPayed: j.isPayed,
        isOpen: !j.leaveTime,
        priceName: j.prices?.name || null,
      };
    });
  }

  async updateProfile(dto: {
    memberId: string;
    firstName?: string;
    lastName?: string;
    functionality?: string;
    bio?: string;
    avatarUrl?: string;
    skills?: string[];
    services?: string[];
    linkedinUrl?: string;
    openToCollaboration?: boolean;
    showInDirectory?: boolean;
  }) {
    const member = await this.prisma.member.findUnique({
      where: { id: dto.memberId },
    });
    if (!member) throw new NotFoundException('Member not found');
    const cleanTags = (arr?: string[]) =>
      arr
        ?.map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 12);
    const data: {
      firstName?: string;
      lastName?: string;
      functionality?: string;
      bio?: string;
      avatarUrl?: string;
      skills?: string[];
      services?: string[];
      linkedinUrl?: string | null;
      openToCollaboration?: boolean;
      showInDirectory?: boolean;
    } = {
      firstName: dto.firstName !== undefined ? dto.firstName.trim() : undefined,
      lastName: dto.lastName !== undefined ? dto.lastName.trim() : undefined,
      functionality:
        dto.functionality !== undefined ? dto.functionality.trim() : undefined,
      bio: dto.bio !== undefined ? dto.bio.trim() : undefined,
      skills: dto.skills !== undefined ? cleanTags(dto.skills) : undefined,
      services:
        dto.services !== undefined ? cleanTags(dto.services) : undefined,
      linkedinUrl:
        dto.linkedinUrl !== undefined
          ? dto.linkedinUrl.trim() || null
          : undefined,
      openToCollaboration: dto.openToCollaboration,
      showInDirectory: dto.showInDirectory,
    };
    try {
      const updated = await this.prisma.member.update({
        where: { id: dto.memberId },
        data: { ...data, avatarUrl: dto.avatarUrl },
      });
      return this.sanitizeMember(updated as any);
    } catch {
      const updated = await this.prisma.member.update({
        where: { id: dto.memberId },
        data,
      });
      return this.sanitizeMember({
        ...(updated as any),
        avatarUrl: dto.avatarUrl || null,
      });
    }
  }

  async listCommunity(excludeMemberId?: string) {
    const members = await this.prisma.member.findMany({
      where: {
        deletedAt: null,
        showInDirectory: true,
        ...(excludeMemberId ? { id: { not: excludeMemberId } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 80,
    });
    return members.map((m) => this.sanitizeMember(m as any));
  }

  async listProducts() {
    const products = await this.prisma.product.findMany({
      orderBy: { name: 'asc' },
    });
    return products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      sellingPrice: p.sellingPrice,
      stock: p.stock,
      img: p.img,
    }));
  }

  async createOrder(dto: {
    memberId: string;
    productId: string;
    quantity?: number;
  }) {
    const qty = Math.max(1, Math.floor(Number(dto.quantity) || 1));
    const [member, product] = await Promise.all([
      this.prisma.member.findUnique({ where: { id: dto.memberId } }),
      this.prisma.product.findUnique({ where: { id: dto.productId } }),
    ]);
    if (!member) throw new NotFoundException('Member not found');
    if (!product) throw new NotFoundException('Produit introuvable');
    if (product.stock < qty) {
      throw new BadRequestException('Stock insuffisant');
    }
    const open = await this.getOpenSession(dto.memberId);
    const [order] = await this.prisma.$transaction([
      this.prisma.dailyProduct.create({
        data: {
          productId: product.id,
          quantite: qty,
          date: new Date(),
          externalRef: dto.memberId,
          memberId: dto.memberId,
          journalId: open?.id || null,
          status: ProductOrderStatus.PENDING,
          isPayed: false,
        },
        include: { product: true },
      }),
      this.prisma.product.update({
        where: { id: product.id },
        data: { stock: { decrement: qty } },
      }),
    ]);
    const mapped = this.mapOrder(order);
    const seat = await this.resolveSeatForMember(dto.memberId);
    const session = await this.getOpenSession(dto.memberId);
    this.eventsGateway.sendProductOrder({
      type: 'product_order',
      ...mapped,
      memberId: dto.memberId,
      memberName: member.firstName || 'Visiteur',
      visitorNumber: member.visitorNumber,
      phone: member.phone,
      avatarUrl: member.avatarUrl,
      productId: product.id,
      quantity: qty,
      label: product.name,
      orderId: order.id,
      status: order.status,
      seat,
      forfaitName: session?.prices?.name || null,
    });
    this.eventsGateway.sendTableUpdates({
      type: 'product_order',
      memberId: dto.memberId,
      productId: product.id,
      quantity: qty,
      label: product.name,
      orderId: order.id,
    });
    return mapped;
  }

  async listOrders(memberId: string) {
    const rows = await this.prisma.dailyProduct.findMany({
      where: {
        OR: [{ memberId }, { externalRef: memberId }],
        status: { not: ProductOrderStatus.CANCELLED },
      },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
    return rows.map((r) => this.mapOrder(r));
  }

  async updateOrder(id: string, memberId: string, quantity: number) {
    const qty = Math.max(1, Math.floor(Number(quantity) || 1));
    const order = await this.prisma.dailyProduct.findUnique({
      where: { id },
      include: { product: true },
    });
    if (!order) throw new NotFoundException('Commande introuvable');
    if (order.memberId !== memberId && order.externalRef !== memberId) {
      throw new ConflictException('Cette commande ne vous appartient pas');
    }
    if (order.status !== ProductOrderStatus.PENDING) {
      throw new BadRequestException(
        'Commande déjà confirmée — modification impossible',
      );
    }
    const diff = qty - order.quantite;
    if (diff > 0 && (order.product?.stock || 0) < diff) {
      throw new BadRequestException('Stock insuffisant');
    }
    const [updated] = await this.prisma.$transaction([
      this.prisma.dailyProduct.update({
        where: { id },
        data: { quantite: qty },
        include: { product: true },
      }),
      this.prisma.product.update({
        where: { id: order.productId },
        data: { stock: { decrement: diff } },
      }),
    ]);
    this.eventsGateway.sendProductOrder({
      type: 'product_order_updated',
      orderId: id,
      memberId,
      quantity: qty,
    });
    return this.mapOrder(updated);
  }

  async cancelOrder(id: string, memberId: string) {
    const order = await this.prisma.dailyProduct.findUnique({
      where: { id },
    });
    if (!order) throw new NotFoundException('Commande introuvable');
    if (order.memberId !== memberId && order.externalRef !== memberId) {
      throw new ConflictException('Cette commande ne vous appartient pas');
    }
    if (order.status !== ProductOrderStatus.PENDING) {
      throw new BadRequestException(
        'Commande déjà confirmée — suppression impossible',
      );
    }
    const [updated] = await this.prisma.$transaction([
      this.prisma.dailyProduct.update({
        where: { id },
        data: { status: ProductOrderStatus.CANCELLED },
        include: { product: true },
      }),
      this.prisma.product.update({
        where: { id: order.productId },
        data: { stock: { increment: order.quantite } },
      }),
    ]);
    this.eventsGateway.sendProductOrder({
      type: 'product_order_cancelled',
      orderId: id,
      memberId,
    });
    return this.mapOrder(updated);
  }

  async confirmOrder(id: string) {
    const order = await this.prisma.dailyProduct.findUnique({
      where: { id },
      include: { product: true, member: true },
    });
    if (!order) throw new NotFoundException('Commande introuvable');
    if (order.status === ProductOrderStatus.CANCELLED) {
      throw new BadRequestException('Commande annulée');
    }
    const updated = await this.prisma.dailyProduct.update({
      where: { id },
      data: { status: ProductOrderStatus.CONFIRMED },
      include: { product: true, member: true },
    });
    this.eventsGateway.sendProductOrder({
      type: 'product_order_confirmed',
      orderId: id,
      memberId: updated.memberId,
      status: updated.status,
    });
    this.eventsGateway.sendTableUpdates({
      type: 'product_order_confirmed',
      orderId: id,
      memberId: updated.memberId,
    });
    return this.mapOrder(updated);
  }

  async setOrderPaid(id: string, isPayed: boolean) {
    const order = await this.prisma.dailyProduct.findUnique({
      where: { id },
      include: { product: true },
    });
    if (!order) throw new NotFoundException('Commande introuvable');
    const updated = await this.prisma.dailyProduct.update({
      where: { id },
      data: { isPayed },
      include: { product: true },
    });
    this.eventsGateway.sendTableUpdates({
      type: 'product_order_paid',
      orderId: id,
      isPayed,
    });
    return this.mapOrder(updated);
  }

  async payMemberDayOrders(memberId: string, isPayed: boolean) {
    const now = new Date();
    await this.prisma.dailyProduct.updateMany({
      where: {
        OR: [{ memberId }, { externalRef: memberId }],
        date: { gte: startOfDay(now), lt: endOfDay(now) },
        status: { not: ProductOrderStatus.CANCELLED },
      },
      data: { isPayed },
    });
    this.eventsGateway.sendTableUpdates({
      type: 'product_orders_paid',
      memberId,
      isPayed,
    });
    return this.listTodayOrders(memberId);
  }

  async listPendingOrders() {
    const rows = await this.prisma.dailyProduct.findMany({
      where: { status: ProductOrderStatus.PENDING },
      include: { product: true, member: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const memberIds = [
      ...new Set(
        rows
          .map((r) => r.memberId || r.externalRef)
          .filter((id): id is string => !!id),
      ),
    ];
    const bookings = memberIds.length
      ? await this.prisma.seatBooking.findMany({
          where: {
            memberId: { in: memberIds },
            isBooked: true,
            eventKey: 'collabora-hub',
          },
        })
      : [];
    const sessions = memberIds.length
      ? await this.prisma.journal.findMany({
          where: {
            memberID: { in: memberIds },
            leaveTime: null,
            registredTime: {
              gte: startOfDay(new Date()),
              lt: endOfDay(new Date()),
            },
          },
          include: { prices: true },
        })
      : [];
    const bookingByMember = new Map<string, string>();
    for (const b of bookings) {
      if (b.memberId) bookingByMember.set(b.memberId, b.seatId);
    }
    const sessionByMember = new Map<string, (typeof sessions)[number]>();
    for (const s of sessions) {
      if (s.memberID) sessionByMember.set(s.memberID, s);
    }
    const seats = await this.prisma.seat.findMany({
      where: { isActive: true },
      include: { table: true, space: true },
    });
    const seatByLabel = new Map(seats.map((s) => [s.label, s]));

    return rows.map((r) => {
      const memberId = r.memberId || r.externalRef;
      const label = memberId ? bookingByMember.get(memberId) : null;
      const seatRow = label ? seatByLabel.get(label) : null;
      const session = memberId ? sessionByMember.get(memberId) : null;
      return {
        ...this.mapOrder(r),
        memberId,
        memberName:
          [r.member?.firstName, r.member?.lastName].filter(Boolean).join(' ') ||
          r.member?.firstName ||
          'Visiteur',
        visitorNumber: r.member?.visitorNumber || null,
        phone: r.member?.phone || null,
        avatarUrl: r.member?.avatarUrl || null,
        seat: seatRow
          ? {
              seatLabel: seatRow.label,
              tableName: seatRow.table?.name || null,
              spaceName: seatRow.space?.name || null,
              isOverflow: seatRow.isOverflow,
            }
          : label
          ? {
              seatLabel: label,
              tableName: null,
              spaceName: null,
              isOverflow: false,
            }
          : null,
        forfaitName: session?.prices?.name || null,
      };
    });
  }

  async listTodayOrders(memberId: string) {
    const now = new Date();
    const rows = await this.prisma.dailyProduct.findMany({
      where: {
        OR: [{ memberId }, { externalRef: memberId }],
        date: { gte: startOfDay(now), lt: endOfDay(now) },
        status: { not: ProductOrderStatus.CANCELLED },
      },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.mapOrder(r));
  }

  async visitorDay(memberId: string) {
    await this.releaseStaleBookings();
    const [seat, subscription, orders, session] = await Promise.all([
      this.resolveSeatForMember(memberId),
      this.getActiveSubscription(memberId),
      this.listTodayOrders(memberId),
      this.getOpenSession(memberId),
    ]);
    const productsTotal = orders.reduce((a, o) => a + o.amount, 0);
    const productsUnpaid = orders
      .filter((o) => !o.isPayed)
      .reduce((a, o) => a + o.amount, 0);
    const packAmount = session?.payedAmount || 0;
    const kind = subscription?.price
      ? this.subscriptionKind(subscription.price)
      : null;
    const daysRemaining = subscription?.leaveDate
      ? Math.max(
          0,
          Math.ceil(
            (new Date(subscription.leaveDate).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : null;
    return {
      seat,
      subscription: subscription
        ? {
            ...subscription,
            kind,
            daysRemaining,
            hoursRemaining:
              kind === 'HOURS_POOL'
                ? Math.max(
                    0,
                    (subscription.hoursQuota ||
                      subscription.price.durationHours ||
                      0) - (subscription.hoursUsed || 0),
                  )
                : null,
          }
        : null,
      session,
      orders,
      totals: {
        pack: packAmount,
        products: productsTotal,
        productsUnpaid,
        grand: packAmount + productsTotal,
      },
    };
  }

  async listInbox(memberId: string) {
    try {
      const messages = await this.prisma.communityMessage.findMany({
        where: {
          OR: [{ fromMemberId: memberId }, { toMemberId: memberId }],
        },
        include: {
          fromMember: true,
          toMember: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 120,
      });
      const byPeer = new Map<
        string,
        {
          peer: ReturnType<MobileService['sanitizeMember']>;
          lastMessage: string;
          lastAt: Date;
          unreadHint: boolean;
        }
      >();
      for (const msg of messages) {
        const peerId =
          msg.fromMemberId === memberId ? msg.toMemberId : msg.fromMemberId;
        if (byPeer.has(peerId)) continue;
        const peer =
          msg.fromMemberId === memberId ? msg.toMember : msg.fromMember;
        byPeer.set(peerId, {
          peer: this.sanitizeMember(peer as any),
          lastMessage: msg.text,
          lastAt: msg.createdAt,
          unreadHint: msg.toMemberId === memberId,
        });
      }
      return [...byPeer.values()];
    } catch {
      return [];
    }
  }

  async sendMessage(dto: {
    fromMemberId: string;
    toMemberId: string;
    text: string;
  }) {
    const text = (dto.text || '').trim();
    if (!text) throw new BadRequestException('Message vide');
    if (dto.fromMemberId === dto.toMemberId) {
      throw new BadRequestException('Impossible de se messager soi-même');
    }
    const [from, to] = await Promise.all([
      this.prisma.member.findUnique({ where: { id: dto.fromMemberId } }),
      this.prisma.member.findUnique({ where: { id: dto.toMemberId } }),
    ]);
    if (!from || !to) throw new NotFoundException('Membre introuvable');
    const created = await this.prisma.communityMessage.create({
      data: {
        fromMemberId: dto.fromMemberId,
        toMemberId: dto.toMemberId,
        text,
      },
    });
    this.eventsGateway.sendTableUpdates({
      type: 'community_message',
      fromMemberId: dto.fromMemberId,
      toMemberId: dto.toMemberId,
    });
    return created;
  }

  async thread(memberId: string, peerId: string) {
    try {
      return await this.prisma.communityMessage.findMany({
        where: {
          OR: [
            { fromMemberId: memberId, toMemberId: peerId },
            { fromMemberId: peerId, toMemberId: memberId },
          ],
        },
        orderBy: { createdAt: 'asc' },
        take: 80,
      });
    } catch {
      return [];
    }
  }

  async sendStaffMessage(dto: {
    memberId: string;
    text: string;
    fromUserId?: string;
  }) {
    const text = (dto.text || '').trim();
    if (!text) throw new BadRequestException('Message vide');
    const member = await this.prisma.member.findUnique({
      where: { id: dto.memberId },
    });
    if (!member) throw new NotFoundException('Membre introuvable');
    const created = await this.prisma.staffMessage.create({
      data: {
        toMemberId: dto.memberId,
        fromUserId: dto.fromUserId || null,
        text,
      },
    });
    const payload = {
      id: created.id,
      memberId: dto.memberId,
      text: created.text,
      createdAt: created.createdAt,
      from: 'Accueil',
    };
    this.eventsGateway.sendStaffMessage(payload);
    this.eventsGateway.sendTableUpdates({
      type: 'staff_message',
      memberId: dto.memberId,
      messageId: created.id,
    });
    return created;
  }

  async listStaffMessages(memberId: string, unreadOnly = false) {
    return this.prisma.staffMessage.findMany({
      where: {
        toMemberId: memberId,
        ...(unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
  }

  async markStaffMessageRead(id: string) {
    const msg = await this.prisma.staffMessage.findUnique({ where: { id } });
    if (!msg) throw new NotFoundException('Message introuvable');
    if (msg.readAt) return msg;
    return this.prisma.staffMessage.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }
}
