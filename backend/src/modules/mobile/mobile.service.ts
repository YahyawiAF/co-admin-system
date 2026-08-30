import { randomUUID, createHash, randomBytes } from 'crypto';
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
  BookingRequestKind,
} from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventsGateway } from '../webSocket/events.gateway';
import { PushService } from '../push/push.service';

export const roundsOfHashing = 10;

@Injectable()
export class MobileService {
  private readonly sessionEndWarned = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly eventsGateway: EventsGateway,
    private readonly pushService: PushService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async sweepExpiredSubscriptionSeats() {
    await this.releaseStaleBookings();
  }

  /** Push + vibrate even if the PWA is closed — ~5 min before session end. */
  @Cron(CronExpression.EVERY_MINUTE)
  async notifySessionsEndingSoon() {
    const now = new Date();
    const sessions = await this.prisma.journal.findMany({
      where: {
        leaveTime: null,
        memberID: { not: null },
        registredTime: { gte: startOfDay(now), lt: endOfDay(now) },
      },
      include: {
        prices: true,
        members: { select: { id: true, organizationId: true } },
      },
    });
    for (const session of sessions) {
      const memberId = session.memberID;
      if (!memberId || this.sessionEndWarned.has(session.id)) continue;
      const enriched = await this.enrichSessionWithSeat(session as any);
      const remaining = enriched?.remainingMs;
      if (remaining == null || remaining <= 0 || remaining > 5 * 60_000) {
        continue;
      }
      this.sessionEndWarned.add(session.id);
      const org = session.members?.organizationId
        ? await this.prisma.organization.findUnique({
            where: { id: session.members.organizationId },
            select: { slug: true },
          })
        : null;
      await this.pushService.sendToMember(memberId, {
        title: 'Fin de session bientôt',
        body: 'Il vous reste moins de 5 minutes. Pensez à finaliser.',
        tag: `session-end-${session.id}`,
        url: org?.slug ? `/m/${org.slug}` : '/m',
        vibrate: [200, 80, 200, 80, 400],
        requireInteraction: true,
      });
    }
    if (this.sessionEndWarned.size > 400) {
      this.sessionEndWarned.clear();
    }
  }

  private isPeriodKind(kind: 'HOURS_POOL' | 'SEMI_DAY' | 'FULL_DAY' | null) {
    return kind === 'SEMI_DAY' || kind === 'FULL_DAY';
  }

  private periodDailyQuotaHours(price: {
    durationHours?: number | null;
  }, kind: 'SEMI_DAY' | 'FULL_DAY') {
    if (price.durationHours && price.durationHours > 0) {
      return price.durationHours;
    }
    return kind === 'SEMI_DAY' ? 6 : 12;
  }

  /** Hours already consumed today from subscription sessions (open + closed). */
  private async dailySubscriptionUsedHours(
    memberId: string,
    priceId: string,
    now = new Date(),
  ) {
    const rows = await this.prisma.journal.findMany({
      where: {
        memberID: memberId,
        priceId,
        registredTime: {
          gte: startOfDay(now),
          lt: endOfDay(now),
        },
      },
      select: { registredTime: true, leaveTime: true },
    });
    let hours = 0;
    for (const row of rows) {
      const end = row.leaveTime ? new Date(row.leaveTime).getTime() : now.getTime();
      const start = new Date(row.registredTime).getTime();
      hours += Math.max(0, (end - start) / 3600_000);
    }
    return hours;
  }

  private priceHasSeatPrivilege(price: {
    reserveSeat?: boolean | null;
  } | null | undefined) {
    return !!price?.reserveSeat;
  }

  /** Dedicated desk held now (all day or within hour window). */
  private seatPrivilegeActiveNow(
    price: {
      reserveSeat?: boolean | null;
      reserveSeatFromHour?: number | null;
      reserveSeatToHour?: number | null;
    } | null | undefined,
    now = new Date(),
  ) {
    if (!this.priceHasSeatPrivilege(price)) return false;
    const from = price?.reserveSeatFromHour;
    const to = price?.reserveSeatToHour;
    if (from == null || to == null) return true;
    const h = now.getHours() + now.getMinutes() / 60;
    if (from === to) return true;
    if (from < to) return h >= from && h < to;
    // overnight window e.g. 22 → 6
    return h >= from || h < to;
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
        !!sub.reservedSeatLabel &&
        this.seatPrivilegeActiveNow(sub.price as any);
      if (!keepDedicated) {
        await this.prisma.seatBooking.delete({ where: { id: booking.id } });
        continue;
      }
      if (
        sub.reservedSeatLabel &&
        (sub.reservedSeatLabel !== booking.seatId ||
          (sub.reservedSeatSpaceId &&
            sub.reservedSeatSpaceId !== booking.spaceId))
      ) {
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

  private seatBookKey(spaceId: string, label: string) {
    return `${spaceId}:${label}`;
  }

  private async resolveSeatRow(seatLabel: string, spaceId?: string) {
    const seats = await this.prisma.seat.findMany({
      where: {
        label: seatLabel,
        isActive: true,
        ...(spaceId ? { spaceId } : {}),
      },
      include: { table: true, space: true },
      orderBy: { createdAt: 'asc' },
    });
    return seats[0] || null;
  }

  private async seatOccupants(labels: string[], spaceId?: string) {
    if (!labels.length) return [];
    const taken = await this.prisma.seatBooking.findMany({
      where: {
        eventKey: 'collabora-hub',
        isBooked: true,
        seatId: { in: labels },
        ...(spaceId ? { spaceId } : {}),
      },
      include: { member: true },
    });
    if (!taken.length) return [];
    const seats = await this.prisma.seat.findMany({
      where: {
        isActive: true,
        OR: taken.map((t) => ({ label: t.seatId, spaceId: t.spaceId })),
      },
      include: { space: true },
    });
    const spaceByKey = new Map(
      seats.map((s) => [
        this.seatBookKey(s.spaceId, s.label),
        s.space?.name || null,
      ]),
    );
    return taken.map((t) => ({
      memberId: t.memberId,
      name: t.member
        ? [t.member.firstName, t.member.lastName].filter(Boolean).join(' ') ||
          t.member.phone ||
          'Visiteur'
        : 'Visiteur',
      seatLabel: t.seatId,
      spaceName: spaceByKey.get(this.seatBookKey(t.spaceId, t.seatId)) || null,
    }));
  }

  private async throwOccupied(
    message: string,
    labels: string[],
    spaceId?: string,
  ): Promise<never> {
    const occupants = await this.seatOccupants(labels, spaceId);
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
      canCancel:
        r.status === ProductOrderStatus.PENDING ||
        r.status === ProductOrderStatus.CONFIRMED,
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

  private async findMemberByPhone(phone: string, organizationId: string) {
    const variants = this.phoneLookupVariants(phone);
    return this.prisma.member.findFirst({
      where: {
        organizationId,
        phone: { in: variants },
      },
    });
  }

  private phonesEqual(stored: string | null | undefined, submitted: string) {
    if (!stored) return false;
    const a = new Set(this.phoneLookupVariants(stored));
    return this.phoneLookupVariants(submitted).some((v) => a.has(v));
  }

  /** Visible in admin members + community + staff conversations. */
  private async activateMemberPresence(member: {
    id: string;
    organizationId: string;
    isActive: boolean;
    visitorNumber: number | null;
    showInDirectory: boolean | null;
    plan: Subscription | null;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    avatarUrl?: string | null;
  }) {
    const updates: {
      isActive?: boolean;
      visitorNumber?: number;
      showInDirectory?: boolean;
      plan?: Subscription;
    } = {};
    if (!member.isActive) updates.isActive = true;
    if (member.visitorNumber == null) {
      updates.visitorNumber = await this.nextVisitorNumber(
        member.organizationId,
      );
    }
    if (!member.showInDirectory) updates.showInDirectory = true;
    if (!member.plan) updates.plan = Subscription.Journal;
    const updated =
      Object.keys(updates).length > 0
        ? await this.prisma.member.update({
            where: { id: member.id },
            data: updates,
          })
        : member;
    await this.ensureStaffWelcome(updated);
    return updated;
  }

  private async ensureStaffWelcome(member: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    visitorNumber?: number | null;
    avatarUrl?: string | null;
  }) {
    const existing = await this.prisma.staffMessage.findFirst({
      where: { toMemberId: member.id },
      select: { id: true },
    });
    if (existing) return;
    const created = await this.prisma.staffMessage.create({
      data: {
        toMemberId: member.id,
        direction: 'TO_STAFF',
        text: 'Nouveau visiteur connecté depuis mobile.',
      },
    });
    const memberName =
      [member.firstName, member.lastName].filter(Boolean).join(' ') ||
      member.firstName ||
      'Visiteur';
    this.eventsGateway.sendStaffMessage({
      id: created.id,
      memberId: member.id,
      toMemberId: member.id,
      text: created.text,
      createdAt: created.createdAt,
      direction: 'TO_STAFF',
      from: member.firstName || 'Visiteur',
      memberName,
      visitorNumber: member.visitorNumber,
      phone: member.phone,
      avatarUrl: member.avatarUrl,
    });
    this.eventsGateway.sendTableUpdates({
      type: 'staff_message',
      memberId: member.id,
      messageId: created.id,
      direction: 'TO_STAFF',
    });
  }

  async resolveOrganizationBySlug(orgSlug?: string) {
    if (!orgSlug) {
      throw new BadRequestException('Organisation (orgSlug) requise');
    }
    const org = await this.prisma.organization.findUnique({
      where: { slug: orgSlug },
      include: {
        facilities: { orderBy: { createdAt: 'asc' }, take: 1 },
      },
    });
    if (!org) throw new NotFoundException('Organisation introuvable');
    if (!org.isActive) {
      throw new BadRequestException('Cette organisation est désactivée');
    }
    return org;
  }

  async resolveFacilityBySlug(orgSlug?: string) {
    if (orgSlug) {
      const org = await this.resolveOrganizationBySlug(orgSlug);
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

  private async nextVisitorNumber(organizationId: string): Promise<number> {
    const last = await this.prisma.member.findFirst({
      where: { organizationId, visitorNumber: { not: null } },
      orderBy: { visitorNumber: 'desc' },
      select: { visitorNumber: true },
    });
    return (last?.visitorNumber || 0) + 1;
  }

  private async ensureVisitorIdentity(
    member: {
      id: string;
      organizationId: string;
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
      updates.visitorNumber = await this.nextVisitorNumber(
        member.organizationId,
      );
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
    const org = await this.resolveOrganizationBySlug(
      (dto as { orgSlug?: string }).orgSlug,
    );
    const phone = this.normalizePhone(dto.phone);
    if (!phone) {
      throw new BadRequestException('Phone number is required');
    }
    if (dto.requirePassword && !dto.password) {
      throw new BadRequestException(
        'Password is required for subscription signup',
      );
    }

    const existing = await this.findMemberByPhone(phone, org.id);
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

    const visitorNumber = await this.nextVisitorNumber(org.id);
    const firstName = dto.requirePassword
      ? dto.firstName || null
      : dto.firstName || this.todayVisitLabel();

    const member = await this.prisma.member.create({
      data: {
        organizationId: org.id,
        phone,
        passwordHash,
        firstName,
        visitorNumber,
        credits: 0,
        isActive: true,
        openToCollaboration: true,
        showInDirectory: true,
        plan: dto.requirePassword
          ? Subscription.Membership
          : Subscription.Journal,
      },
    });

    const accessToken = await this.signMemberToken(member.id, member.phone);
    return { member: this.sanitizeMember(member), accessToken };
  }

  async quickRegister(dto: QuickRegisterDto) {
    const org = await this.resolveOrganizationBySlug(dto.orgSlug);
    await this.resolveFacilityBySlug(dto.orgSlug);
    const firstName = (dto.firstName || '').trim();
    const lastName = (dto.lastName || '').trim();
    if (!firstName || !lastName) {
      throw new BadRequestException('Nom et prénom obligatoires');
    }
    const phone = this.parseTunisiaPhone(dto.phone);
    let member = await this.findMemberByPhone(phone, org.id);
    if (member) {
      member = await this.prisma.member.update({
        where: { id: member.id },
        data: {
          firstName,
          lastName,
          phone,
          visitorNumber:
            member.visitorNumber == null
              ? await this.nextVisitorNumber(org.id)
              : undefined,
          isActive: true,
        },
      });
    } else {
      member = await this.prisma.member.create({
        data: {
          organizationId: org.id,
          phone,
          firstName,
          lastName,
          visitorNumber: await this.nextVisitorNumber(org.id),
          credits: 0,
          isActive: true,
          plan: Subscription.Journal,
          openToCollaboration: true,
          showInDirectory: true,
        },
      });
    }
    member = (await this.activateMemberPresence(member)) as typeof member;
    const accessToken = await this.signMemberToken(member.id, member.phone);
    return { member: this.sanitizeMember(member as any), accessToken };
  }

  async login(dto: MobileLoginDto) {
    const orgSlug = (dto as { orgSlug?: string }).orgSlug;
    const org = await this.resolveOrganizationBySlug(orgSlug);
    const phone = this.normalizePhone(dto.phone);
    const member = await this.findMemberByPhone(dto.phone, org.id);
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
    const present = await this.activateMemberPresence(ensured || member);
    const accessToken = await this.signMemberToken(
      present.id,
      present.phone,
    );
    return {
      member: this.sanitizeMember(present as any),
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
    pinHash?: string | null;
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
      hasPin: !!member.pinHash,
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

  private hashToken(raw: string) {
    return createHash('sha256').update(raw).digest('hex');
  }

  private makeShortCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  async setPin(dto: { memberId: string; pin: string }) {
    const pin = (dto.pin || '').trim();
    if (!/^\d{4}$/.test(pin)) {
      throw new BadRequestException('Le code PIN doit contenir 4 chiffres');
    }
    const member = await this.prisma.member.findUnique({
      where: { id: dto.memberId },
    });
    if (!member) throw new NotFoundException('Membre introuvable');
    const pinHash = await bcrypt.hash(pin, roundsOfHashing);
    const updated = await this.prisma.member.update({
      where: { id: member.id },
      data: { pinHash },
    });
    const accessToken = await this.signMemberToken(updated.id, updated.phone);
    return { member: this.sanitizeMember(updated as any), accessToken };
  }

  async loginWithPin(dto: { phone: string; pin: string; orgSlug?: string }) {
    const pin = (dto.pin || '').trim();
    if (!/^\d{4}$/.test(pin)) {
      throw new BadRequestException('Le code PIN doit contenir 4 chiffres');
    }
    const org = await this.resolveOrganizationBySlug(dto.orgSlug);
    const phone = this.parseTunisiaPhone(dto.phone);
    const member = await this.findMemberByPhone(phone, org.id);
    if (!member) throw new NotFoundException('Numéro inconnu');
    if (!member.pinHash) {
      throw new BadRequestException(
        'Aucun code PIN défini — utilisez un lien de récupération à l’accueil',
      );
    }
    const ok = await bcrypt.compare(pin, member.pinHash);
    if (!ok) throw new UnauthorizedException('PIN incorrect');
    const activated = await this.activateMemberPresence(member);
    const accessToken = await this.signMemberToken(
      activated.id,
      activated.phone,
    );
    return { member: this.sanitizeMember(activated as any), accessToken };
  }

  async createLoginToken(memberId: string, opts?: { hours?: number }) {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
    });
    if (!member) throw new NotFoundException('Membre introuvable');
    const rawToken = randomBytes(32).toString('hex');
    const shortCode = this.makeShortCode();
    const hours = opts?.hours ?? 48;
    const expiresAt = addHours(new Date(), hours);
    await this.prisma.memberLoginToken.create({
      data: {
        memberId,
        tokenHash: this.hashToken(rawToken),
        shortCode,
        expiresAt,
      },
    });
    return {
      token: rawToken,
      shortCode,
      expiresAt,
      member: this.sanitizeMember(member as any),
    };
  }

  async consumeLoginToken(dto: {
    token?: string;
    shortCode?: string;
    phone?: string;
    orgSlug?: string;
  }) {
    const now = new Date();
    let row:
      | {
          id: string;
          memberId: string;
          expiresAt: Date;
          usedAt: Date | null;
          member: any;
        }
      | null = null;

    if (dto.token) {
      if (!dto.phone) {
        throw new BadRequestException('Confirmez votre numéro de téléphone');
      }
      row = await this.prisma.memberLoginToken.findUnique({
        where: { tokenHash: this.hashToken(dto.token.trim()) },
        include: { member: true },
      });
      if (dto.orgSlug && row?.member) {
        const org = await this.resolveOrganizationBySlug(dto.orgSlug);
        if (row.member.organizationId !== org.id) {
          throw new UnauthorizedException('Lien invalide pour cette organisation');
        }
      }
      if (row?.member) {
        const phone = this.parseTunisiaPhone(dto.phone);
        if (!this.phonesEqual(row.member.phone, phone)) {
          throw new UnauthorizedException(
            'Ce numéro ne correspond pas à ce profil',
          );
        }
      }
    } else if (dto.shortCode) {
      const code = dto.shortCode.trim();
      if (!/^\d{6}$/.test(code)) {
        throw new BadRequestException('Code à 6 chiffres invalide');
      }
      if (!dto.phone) {
        throw new BadRequestException('Téléphone requis avec le code');
      }
      const org = await this.resolveOrganizationBySlug(dto.orgSlug);
      const phone = this.parseTunisiaPhone(dto.phone);
      const member = await this.findMemberByPhone(phone, org.id);
      if (!member) throw new NotFoundException('Numéro inconnu');
      row = await this.prisma.memberLoginToken.findFirst({
        where: {
          memberId: member.id,
          shortCode: code,
          usedAt: null,
          expiresAt: { gt: now },
        },
        include: { member: true },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      throw new BadRequestException('Token ou code requis');
    }

    if (!row) throw new UnauthorizedException('Lien ou code invalide');
    if (row.usedAt) throw new BadRequestException('Lien déjà utilisé');
    if (row.expiresAt.getTime() < now.getTime()) {
      throw new BadRequestException('Lien expiré');
    }
    await this.prisma.memberLoginToken.update({
      where: { id: row.id },
      data: { usedAt: now },
    });
    const activated = await this.activateMemberPresence(row.member);
    const accessToken = await this.signMemberToken(
      activated.id,
      activated.phone,
    );
    return {
      member: this.sanitizeMember(activated as any),
      accessToken,
      needsPin: false,
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
        this.prisma.member.findUnique({
          where: { id: memberId },
          include: { organization: { select: { slug: true } } },
        }),
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

    let dailyCreditHours: number | null = null;
    let dailyCreditUsedHours: number | null = null;
    let dailyCreditRemainingHours: number | null = null;
    let canChooseForfait = false;
    if (kind === 'HOURS_POOL') {
      canChooseForfait = false;
    } else if (this.isPeriodKind(kind) && subscription?.price) {
      dailyCreditHours = this.periodDailyQuotaHours(
        subscription.price,
        kind as 'SEMI_DAY' | 'FULL_DAY',
      );
      dailyCreditUsedHours = await this.dailySubscriptionUsedHours(
        memberId,
        subscription.priceId,
      );
      dailyCreditRemainingHours = Math.max(
        0,
        dailyCreditHours - dailyCreditUsedHours,
      );
      // Forfait only after today's subscription credit is exhausted
      canChooseForfait = !session && dailyCreditRemainingHours <= 0.01;
    } else {
      canChooseForfait = true;
    }

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
            hasSeatPrivilege: this.priceHasSeatPrivilege(
              subscription.price as any,
            ),
            seatPrivilegeActiveNow: this.seatPrivilegeActiveNow(
              subscription.price as any,
            ),
            dailyCreditHours,
            dailyCreditUsedHours,
            dailyCreditRemainingHours,
          }
        : null,
      hasActiveSubscription: !!subscription,
      canChooseForfait,
      mustScanToEnter:
        kind === 'HOURS_POOL' ||
        (this.isPeriodKind(kind) && (dailyCreditRemainingHours ?? 0) > 0.01),
      dailyCreditRemainingHours,
      pendingRequest,
      hasOpenSession: !!session,
      seat,
      seatSettings: await this.getSeatSettings(member?.organization?.slug),
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
  async pickFreeSeat(
    allowOverflow = true,
  ): Promise<{ label: string; spaceId: string } | null> {
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
      select: { seatId: true, spaceId: true },
    });
    const booked = new Set(
      bookings.map((b) => this.seatBookKey(b.spaceId, b.seatId)),
    );
    const isFree = (s: (typeof seats)[number]) =>
      !booked.has(this.seatBookKey(s.spaceId, s.label));
    const normal = seats.find((s) => !s.isOverflow && isFree(s));
    if (normal) return { label: normal.label, spaceId: normal.spaceId };
    if (!allowOverflow) return null;
    const overflow = seats.find((s) => s.isOverflow && isFree(s));
    return overflow
      ? { label: overflow.label, spaceId: overflow.spaceId }
      : null;
  }

  async pickFreeSeatLabel(allowOverflow = true): Promise<string | null> {
    const seat = await this.pickFreeSeat(allowOverflow);
    return seat?.label || null;
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
                fixtures: true,
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

  async claimSeat(
    memberId: string,
    seatLabel: string,
    spaceId?: string,
    orgSlug?: string,
  ) {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      include: { organization: { select: { slug: true } } },
    });
    if (!member) throw new NotFoundException('Member not found');
    const settings = await this.getSeatSettings(
      orgSlug || member.organization?.slug,
    );
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
    const existing = await this.resolveSeatForMember(memberId);
    if (existing) {
      throw new ConflictException('Une place est déjà assignée');
    }
    await this.bookSeatForMember(memberId, seatLabel.trim(), { spaceId });
    const seat = await this.resolveSeatForMember(memberId);
    this.eventsGateway.sendTableUpdates({
      type: 'seat_claimed',
      memberId,
      seatLabel: seatLabel.trim(),
      spaceId,
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
    if (this.isPeriodKind(subKind) && activeSub?.price) {
      const quota = this.periodDailyQuotaHours(
        activeSub.price,
        subKind as 'SEMI_DAY' | 'FULL_DAY',
      );
      const used = await this.dailySubscriptionUsedHours(
        dto.memberId,
        activeSub.priceId,
      );
      if (used < quota - 0.01) {
        throw new BadRequestException(
          `Crédit abonnement du jour restant (${Math.max(0, quota - used).toFixed(1)} h). Pointez votre présence avant d’acheter un forfait.`,
        );
      }
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

  async resumeByPhone(phoneRaw: string, orgSlug?: string) {
    const phone = this.normalizePhone(phoneRaw || '');
    if (!phone) throw new BadRequestException('Phone is required');
    let organizationId: string | undefined;
    if (orgSlug) {
      const org = await this.resolveOrganizationBySlug(orgSlug);
      organizationId = org.id;
    } else {
      const org = await this.prisma.organization.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      organizationId = org?.id;
    }
    if (!organizationId) throw new NotFoundException('Organisation introuvable');
    const member = await this.findMemberByPhone(phone, organizationId);
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
      const keepDedicated =
        isSubscriptionVisit &&
        this.seatPrivilegeActiveNow(activeSub?.price as any) &&
        !!activeSub?.reservedSeatLabel;
      if (this.isPeriodKind(kind) || kind === 'HOURS_POOL') {
        await this.prisma.seatBooking.deleteMany({
          where: {
            memberId: journal.memberID,
            isBooked: true,
            ...(keepDedicated ? { isPermanent: false } : {}),
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
    const leaveDate = addDays(now, periodDays - 1);

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
        reservedSeatSpaceId: dto.reservedSeatSpaceId || null,
      },
      include: { price: true, members: true },
    });

    await this.prisma.member.update({
      where: { id: dto.memberId },
      data: { plan: Subscription.Membership },
    });

    if (price.reserveSeat && dto.reservedSeatLabel) {
      await this.bookSeatForMember(dto.memberId, dto.reservedSeatLabel.trim(), {
        permanent: true,
        spaceId: dto.reservedSeatSpaceId,
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
      const facility = await this.prisma.facility.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { organizationId: true },
      });
      const organizationId = facility?.organizationId;
      if (!organizationId) {
        throw new BadRequestException('Aucune organisation configurée');
      }
      const phone = this.normalizePhone(dto.phone);
      let member = await this.findMemberByPhone(phone, organizationId);
      if (!member) {
        const visitorNumber = await this.nextVisitorNumber(organizationId);
        member = await this.prisma.member.create({
          data: {
            organizationId,
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
            spaceId: dto.spaceId,
          });
        } else {
          await this.bookAnonymousSeat(seat, dto.spaceId);
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
      where: {
        label: booking.seatId,
        spaceId: booking.spaceId,
        isActive: true,
      },
      include: {
        table: true,
        space: true,
      },
    });
    if (!seat) {
      const space = booking.spaceId
        ? await this.prisma.space.findUnique({ where: { id: booking.spaceId } })
        : null;
      return {
        seatLabel: booking.seatId,
        tableName: null as string | null,
        spaceName: space?.name || null,
        spaceId: booking.spaceId,
        isOverflow: false,
        wifiSsid: space?.wifiSsid || null,
        wifiPassword: space?.wifiPassword || null,
      };
    }
    return {
      seatLabel: seat.label,
      tableName: seat.table?.name || null,
      spaceName: seat.space?.name || null,
      spaceId: seat.spaceId,
      isOverflow: seat.isOverflow,
      wifiSsid: seat.space?.wifiSsid || null,
      wifiPassword: seat.space?.wifiPassword || null,
    };
  }

  async bookSeatForMember(
    memberId: string,
    seatLabel: string,
    opts?: { permanent?: boolean; keepExisting?: boolean; spaceId?: string },
  ) {
    const seat = await this.resolveSeatRow(seatLabel, opts?.spaceId);
    if (!seat) throw new NotFoundException('Place introuvable');
    const spaceId = seat.spaceId;
    const permanent = !!opts?.permanent;
    const existing = await this.prisma.seatBooking.findUnique({
      where: {
        eventKey_spaceId_seatId: {
          eventKey: 'collabora-hub',
          spaceId,
          seatId: seatLabel,
        },
      },
    });
    if (
      existing?.isBooked &&
      existing.memberId &&
      existing.memberId !== memberId
    ) {
      await this.throwOccupied('Cette place est déjà prise', [seatLabel], spaceId);
    }
    if (!opts?.keepExisting) {
      await this.prisma.seatBooking.deleteMany({
        where: {
          memberId,
          isBooked: true,
          eventKey: 'collabora-hub',
          ...(permanent ? {} : { isPermanent: false }),
          NOT: { spaceId, seatId: seatLabel },
        },
      });
    }
    return this.prisma.seatBooking.upsert({
      where: {
        eventKey_spaceId_seatId: {
          eventKey: 'collabora-hub',
          spaceId,
          seatId: seatLabel,
        },
      },
      create: {
        eventKey: 'collabora-hub',
        seatId: seatLabel,
        spaceId,
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

  async bookAnonymousSeat(seatLabel: string, spaceId?: string) {
    const seat = await this.resolveSeatRow(seatLabel, spaceId);
    if (!seat) throw new NotFoundException('Place introuvable');
    const existing = await this.prisma.seatBooking.findFirst({
      where: {
        eventKey: 'collabora-hub',
        seatId: seatLabel,
        spaceId: seat.spaceId,
        isBooked: true,
      },
    });
    if (existing) {
      await this.throwOccupied(
        'Cette place est déjà prise',
        [seatLabel],
        seat.spaceId,
      );
    }
    return this.prisma.seatBooking.create({
      data: {
        eventKey: 'collabora-hub',
        seatId: seatLabel,
        spaceId: seat.spaceId,
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
          spaceId: opts?.spaceId,
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
      if (!seats.length) {
        throw new BadRequestException(`Aucune place sur ${table.name}`);
      }
      await this.bookSeatRows(memberId, seats, table.name);
      return { booked: seats.length, label: table.name };
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

    const seats = target.flatMap((s) =>
      s.seats.filter((seat) => !seat.isOverflow),
    );
    if (!seats.length) {
      throw new BadRequestException(`Aucune place à réserver (${label})`);
    }
    await this.bookSeatRows(memberId, seats, label);
    return { booked: seats.length, label };
  }

  async moveSeat(dto: MoveSeatDto) {
    const toLabel = dto.toSeatLabel.trim();
    if (!toLabel) throw new BadRequestException('Place cible requise');
    if (!dto.memberId && !dto.fromSeatLabel) {
      throw new BadRequestException('memberId ou fromSeatLabel requis');
    }

    const destSeat = await this.resolveSeatRow(toLabel, dto.toSpaceId);
    if (!destSeat) throw new NotFoundException('Place cible introuvable');

    const dest = await this.prisma.seatBooking.findFirst({
      where: {
        eventKey: 'collabora-hub',
        seatId: toLabel,
        spaceId: destSeat.spaceId,
        isBooked: true,
      },
    });
    if (dest) {
      await this.throwOccupied(
        'La place cible est déjà prise',
        [toLabel],
        destSeat.spaceId,
      );
    }

    let booking = dto.fromSeatLabel
      ? await this.prisma.seatBooking.findFirst({
          where: {
            eventKey: 'collabora-hub',
            seatId: dto.fromSeatLabel.trim(),
            isBooked: true,
            ...(dto.fromSpaceId ? { spaceId: dto.fromSpaceId } : {}),
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
      data: {
        seatId: toLabel,
        spaceId: destSeat.spaceId,
        bookedAt: new Date(),
      },
    });
    this.eventsGateway.sendTableUpdates({
      type: 'seat_moved',
      memberId: booking.memberId,
      fromSeatLabel: booking.seatId,
      toSeatLabel: toLabel,
      fromSpaceId: booking.spaceId,
      toSpaceId: destSeat.spaceId,
    });
    return updated;
  }

  private async bookSeatRows(
    memberId: string,
    seats: { label: string; spaceId: string }[],
    label: string,
  ) {
    const taken = await this.prisma.seatBooking.findMany({
      where: {
        eventKey: 'collabora-hub',
        isBooked: true,
        NOT: { memberId },
        OR: seats.map((s) => ({ spaceId: s.spaceId, seatId: s.label })),
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
      data: seats.map((s) => ({
        eventKey: 'collabora-hub',
        seatId: s.label,
        spaceId: s.spaceId,
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
    let remainingCredit: number | null = null;
    if (this.isPeriodKind(kind)) {
      const quota = this.periodDailyQuotaHours(
        sub.price,
        kind as 'SEMI_DAY' | 'FULL_DAY',
      );
      const used = await this.dailySubscriptionUsedHours(memberId, sub.priceId);
      remainingCredit = Math.max(0, quota - used);
      if (remainingCredit <= 0.01) {
        throw new BadRequestException(
          'Crédit abonnement du jour épuisé. Vous pouvez prendre un forfait.',
        );
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
      kind === 'SEMI_DAY' || kind === 'FULL_DAY'
        ? remainingCredit
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
      this.seatPrivilegeActiveNow(sub.price as any)
    ) {
      await this.bookSeatForMember(memberId, sub.reservedSeatLabel, {
        permanent: true,
        spaceId: sub.reservedSeatSpaceId || undefined,
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
      include: { organization: { select: { slug: true } } },
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
      if (this.isPeriodKind(subKind) && activeSub?.price) {
        const quota = this.periodDailyQuotaHours(
          activeSub.price,
          subKind as 'SEMI_DAY' | 'FULL_DAY',
        );
        const used = await this.dailySubscriptionUsedHours(
          dto.memberId,
          activeSub.priceId,
        );
        if (used < quota - 0.01) {
          throw new BadRequestException(
            `Crédit abonnement du jour restant (${Math.max(0, quota - used).toFixed(1)} h). Pointez votre présence avant d’acheter un forfait.`,
          );
        }
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

    const settings = await this.getSeatSettings(member.organization?.slug);
    if (settings.receptionAway) {
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
      include: {
        member: { include: { organization: { select: { slug: true } } } },
        price: true,
      },
    });
    if (!request) throw new NotFoundException('Visit request not found');
    return request;
  }

  async approveVisitRequest(id: string, seatLabel?: string, spaceId?: string) {
    const request = await this.getVisitRequest(id);
    if (request.status !== VisitRequestStatus.PENDING) {
      throw new ConflictException('Request already resolved');
    }

    const settings = await this.getSeatSettings(
      request.member.organization?.slug,
    );
    let assignedLabel = seatLabel?.trim() || null;
    let assignedSpaceId = spaceId || undefined;
    const requestKind = this.subscriptionKind(request.price);
    const hoursSub =
      request.type === VisitRequestType.SUBSCRIPTION &&
      requestKind === 'HOURS_POOL';
    const wantsDedicatedSeat =
      request.type === VisitRequestType.SUBSCRIPTION &&
      !!(request.price as { reserveSeat?: boolean }).reserveSeat;
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
      assignedSpaceId = undefined;
    } else if (
      settings.mobileSeatMode === MobileSeatMode.VISITOR_CHOOSE &&
      !assignedLabel
    ) {
      assignedLabel = null;
      assignedSpaceId = undefined;
    } else if (
      settings.mobileSeatMode === MobileSeatMode.AUTO_ASSIGN ||
      settings.receptionAway
    ) {
      if (!assignedLabel) {
        const free = await this.pickFreeSeat(true);
        assignedLabel = free?.label || null;
        assignedSpaceId = free?.spaceId;
      }
      if (!assignedLabel) {
        throw new BadRequestException('Aucune place libre disponible');
      }
    } else if (settings.mobileSeatMode === MobileSeatMode.ADMIN_ASSIGN) {
      if (!assignedLabel) {
        throw new BadRequestException(
          'Sélectionnez une place sur le plan avant de confirmer',
        );
      }
    } else {
      assignedLabel = assignedLabel || null;
    }

    if (assignedLabel && !assignedSpaceId) {
      assignedSpaceId =
        (await this.resolveSeatRow(assignedLabel))?.spaceId || undefined;
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
        reservedSeatSpaceId: wantsDedicatedSeat
          ? assignedSpaceId
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
          spaceId: assignedSpaceId,
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
    void this.pushService.sendToMember(updated.memberId, {
      title: 'Demande confirmée',
      body: 'Votre demande a été acceptée par l’accueil.',
      tag: `visit-ok-${updated.id}`,
      url: '/m',
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
    void this.pushService.sendToMember(updated.memberId, {
      title: 'Demande refusée',
      body: 'Votre demande a été refusée par l’accueil.',
      tag: `visit-no-${updated.id}`,
      url: '/m',
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
    let organizationId: string | undefined;
    if (excludeMemberId) {
      const self = await this.prisma.member.findUnique({
        where: { id: excludeMemberId },
        select: { organizationId: true },
      });
      organizationId = self?.organizationId;
    }
    const members = await this.prisma.member.findMany({
      where: {
        deletedAt: null,
        showInDirectory: true,
        ...(organizationId ? { organizationId } : {}),
        ...(excludeMemberId ? { id: { not: excludeMemberId } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const now = new Date();
    const present = await this.prisma.journal.findMany({
      where: {
        leaveTime: null,
        memberID: { in: members.map((m) => m.id) },
        registredTime: { gte: startOfDay(now), lt: endOfDay(now) },
      },
      select: { memberID: true },
    });
    const presentIds = new Set(
      present.map((j) => j.memberID).filter(Boolean) as string[],
    );
    return members.map((m) => ({
      ...this.sanitizeMember(m as any),
      isPresent: presentIds.has(m.id),
    }));
  }

  async listProducts(orgSlug?: string) {
    let organizationId: string | undefined;
    if (orgSlug) {
      const org = await this.resolveOrganizationBySlug(orgSlug);
      organizationId = org.id;
    }
    const products = await this.prisma.product.findMany({
      where: organizationId ? { organizationId } : undefined,
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
    this.eventsGateway.sendProductUpdated({
      type: 'product_updated',
      productId: product.id,
      name: product.name,
      stock: product.stock - qty,
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

  async cancelOrder(
    id: string,
    memberId: string,
    opts?: { byAdmin?: boolean },
  ) {
    const order = await this.prisma.dailyProduct.findUnique({
      where: { id },
      include: { product: true },
    });
    if (!order) throw new NotFoundException('Commande introuvable');
    if (
      !opts?.byAdmin &&
      order.memberId !== memberId &&
      order.externalRef !== memberId
    ) {
      throw new ConflictException('Cette commande ne vous appartient pas');
    }
    if (order.status === ProductOrderStatus.CANCELLED) {
      throw new BadRequestException('Commande déjà annulée');
    }
    const targetMemberId =
      order.memberId || order.externalRef || memberId || null;
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
    const productName = updated.product?.name || order.product?.name || 'Commande';
    this.eventsGateway.sendProductOrder({
      type: 'product_order_cancelled',
      orderId: id,
      memberId: targetMemberId,
      status: ProductOrderStatus.CANCELLED,
      productName,
      quantity: order.quantite,
      byAdmin: !!opts?.byAdmin,
    });
    this.eventsGateway.sendTableUpdates({
      type: 'product_order_cancelled',
      orderId: id,
      memberId: targetMemberId,
    });
    const product = await this.prisma.product.findUnique({
      where: { id: order.productId },
    });
    if (product) {
      this.eventsGateway.sendProductUpdated({
        type: 'product_updated',
        productId: product.id,
        name: product.name,
        stock: product.stock,
      });
    }
    if (targetMemberId && opts?.byAdmin) {
      void this.pushService.sendToMember(targetMemberId, {
        title: 'Commande refusée',
        body: `${productName} a été refusée / annulée par l’accueil.`,
        tag: `order-cancel-${id}`,
        url: '/m',
      });
    }
    return this.mapOrder(updated);
  }

  async rejectOrderAdmin(id: string) {
    const order = await this.prisma.dailyProduct.findUnique({
      where: { id },
    });
    if (!order) throw new NotFoundException('Commande introuvable');
    return this.cancelOrder(id, order.memberId || order.externalRef || '', {
      byAdmin: true,
    });
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
    const memberId = updated.memberId || updated.externalRef;
    const productName = updated.product?.name || 'Commande';
    this.eventsGateway.sendProductOrder({
      type: 'product_order_confirmed',
      orderId: id,
      memberId,
      status: updated.status,
      productName,
      quantity: updated.quantite,
      ready: true,
    });
    this.eventsGateway.sendTableUpdates({
      type: 'product_order_confirmed',
      orderId: id,
      memberId,
    });
    if (memberId) {
      void this.pushService.sendToMember(memberId, {
        title: 'Commande prête ☕',
        body: `${productName} est prêt·e — venez récupérer à l’accueil.`,
        tag: `order-ready-${id}`,
        url: '/m',
      });
    }
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

  async listAdminOrders(date?: string) {
    const day = date ? new Date(date) : new Date();
    if (Number.isNaN(day.getTime())) {
      throw new BadRequestException('Date invalide');
    }
    const rows = await this.prisma.dailyProduct.findMany({
      where: {
        date: { gte: startOfDay(day), lt: endOfDay(day) },
        status: { not: ProductOrderStatus.CANCELLED },
      },
      include: { product: true, member: true },
      orderBy: [{ isPayed: 'asc' }, { createdAt: 'desc' }],
      take: 300,
    });
    return rows.map((r) => ({
      ...this.mapOrder(r),
      memberId: r.memberId || r.externalRef,
      memberName:
        [r.member?.firstName, r.member?.lastName].filter(Boolean).join(' ') ||
        r.member?.firstName ||
        'Visiteur',
      visitorNumber: r.member?.visitorNumber || null,
      phone: r.member?.phone || null,
      avatarUrl: r.member?.avatarUrl || null,
    }));
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
    this.eventsGateway.sendCommunityMessage({
      type: 'community_message',
      id: created.id,
      fromMemberId: dto.fromMemberId,
      toMemberId: dto.toMemberId,
      text,
      fromName: from.firstName || 'Membre',
      createdAt: created.createdAt,
    });
    this.eventsGateway.sendTableUpdates({
      type: 'community_message',
      fromMemberId: dto.fromMemberId,
      toMemberId: dto.toMemberId,
    });
    void this.pushService.sendToMember(dto.toMemberId, {
      title: `Message de ${from.firstName || 'la communauté'}`,
      body: text.slice(0, 120),
      tag: `msg-${created.id}`,
      url: '/m',
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
        direction: 'TO_MEMBER',
        text,
      },
    });
    const payload = {
      id: created.id,
      memberId: dto.memberId,
      toMemberId: dto.memberId,
      text: created.text,
      createdAt: created.createdAt,
      direction: 'TO_MEMBER' as const,
      from: 'Accueil',
    };
    this.eventsGateway.sendStaffMessage(payload);
    this.eventsGateway.sendTableUpdates({
      type: 'staff_message',
      memberId: dto.memberId,
      messageId: created.id,
      direction: 'TO_MEMBER',
    });
    void this.pushService.sendToMember(dto.memberId, {
      title: 'Message de l’accueil',
      body: created.text.slice(0, 120),
      tag: `staff-${created.id}`,
      url: '/m',
    });
    return created;
  }

  async sendVisitorToStaff(dto: { memberId: string; text: string }) {
    const text = (dto.text || '').trim();
    if (!text) throw new BadRequestException('Message vide');
    const member = await this.prisma.member.findUnique({
      where: { id: dto.memberId },
    });
    if (!member) throw new NotFoundException('Membre introuvable');
    const created = await this.prisma.staffMessage.create({
      data: {
        toMemberId: dto.memberId,
        direction: 'TO_STAFF',
        text,
      },
    });
    const payload = {
      id: created.id,
      memberId: dto.memberId,
      toMemberId: dto.memberId,
      text: created.text,
      createdAt: created.createdAt,
      direction: 'TO_STAFF' as const,
      from: member.firstName || 'Visiteur',
      memberName:
        [member.firstName, member.lastName].filter(Boolean).join(' ') ||
        member.firstName ||
        'Visiteur',
      visitorNumber: member.visitorNumber,
      phone: member.phone,
      avatarUrl: member.avatarUrl,
    };
    this.eventsGateway.sendStaffMessage(payload);
    this.eventsGateway.sendTableUpdates({
      type: 'staff_message',
      memberId: dto.memberId,
      messageId: created.id,
      direction: 'TO_STAFF',
    });
    return created;
  }

  async listStaffMessages(memberId: string, unreadOnly = false) {
    return this.prisma.staffMessage.findMany({
      where: {
        toMemberId: memberId,
        ...(unreadOnly
          ? { readAt: null, direction: 'TO_MEMBER' }
          : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  }

  async listStaffInbox() {
    const rows = await this.prisma.staffMessage.findMany({
      include: {
        toMember: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            visitorNumber: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const seen = new Set<string>();
    const inbox: Array<{
      id: string;
      memberId: string;
      text: string;
      createdAt: Date;
      direction: string;
      unread: boolean;
      memberName: string;
      visitorNumber: number | null;
      phone: string | null;
      avatarUrl: string | null;
    }> = [];
    for (const m of rows) {
      if (seen.has(m.toMemberId)) continue;
      seen.add(m.toMemberId);
      inbox.push({
        id: m.id,
        memberId: m.toMemberId,
        text: m.text,
        createdAt: m.createdAt,
        direction: m.direction,
        unread: m.direction === 'TO_STAFF' && !m.readAt,
        memberName:
          [m.toMember.firstName, m.toMember.lastName]
            .filter(Boolean)
            .join(' ') ||
          m.toMember.firstName ||
          'Visiteur',
        visitorNumber: m.toMember.visitorNumber,
        phone: m.toMember.phone,
        avatarUrl: m.toMember.avatarUrl,
      });
      if (inbox.length >= 40) break;
    }
    return inbox;
  }

  async markStaffThreadRead(memberId: string, as: 'member' | 'staff') {
    if (as === 'member') {
      await this.prisma.staffMessage.updateMany({
        where: {
          toMemberId: memberId,
          direction: 'TO_MEMBER',
          readAt: null,
        },
        data: { readAt: new Date() },
      });
    } else {
      await this.prisma.staffMessage.updateMany({
        where: {
          toMemberId: memberId,
          direction: 'TO_STAFF',
          readAt: null,
        },
        data: { readAt: new Date() },
      });
    }
    return { ok: true };
  }

  getVapidPublicKey() {
    return { publicKey: this.pushService.getPublicKey() };
  }

  async savePushSubscription(dto: {
    memberId: string;
    endpoint: string;
    keys: { p256dh: string; auth: string };
    userAgent?: string;
  }) {
    if (!dto.memberId || !dto.endpoint || !dto.keys?.p256dh || !dto.keys?.auth) {
      throw new BadRequestException('Abonnement push invalide');
    }
    const member = await this.prisma.member.findUnique({
      where: { id: dto.memberId },
    });
    if (!member) throw new NotFoundException('Membre introuvable');
    await this.pushService.saveSubscription({
      memberId: dto.memberId,
      endpoint: dto.endpoint,
      p256dh: dto.keys.p256dh,
      auth: dto.keys.auth,
      userAgent: dto.userAgent,
    });
    return { ok: true };
  }

  async removePushSubscription(dto: { memberId?: string; endpoint: string }) {
    if (!dto.endpoint) throw new BadRequestException('Endpoint manquant');
    await this.pushService.removeSubscription(dto.endpoint, dto.memberId);
    return { ok: true };
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

  async lookupPhone(dto: { phone: string; orgSlug?: string }) {
    const org = await this.resolveOrganizationBySlug(dto.orgSlug);
    const phone = this.parseTunisiaPhone(dto.phone);
    const member = await this.findMemberByPhone(phone, org.id);
    if (!member) return { exists: false, hasPin: false };
    return {
      exists: true,
      hasPin: !!member.pinHash,
      firstName: member.firstName || null,
    };
  }

  private serializeBooking(row: {
    id: string;
    memberId: string;
    kind: BookingRequestKind;
    spaceId: string | null;
    spaceName: string | null;
    seatLabel: string | null;
    seatSpaceId: string | null;
    date: Date;
    startAt: Date;
    endAt: Date;
    note: string | null;
    status: VisitRequestStatus;
    journalId: string | null;
    createdAt: Date;
    member?: {
      firstName: string | null;
      lastName: string | null;
      phone: string | null;
      visitorNumber: number | null;
      avatarUrl: string | null;
    } | null;
  }) {
    const memberName = row.member
      ? [row.member.firstName, row.member.lastName].filter(Boolean).join(' ') ||
        row.member.firstName ||
        'Visiteur'
      : 'Visiteur';
    return {
      id: row.id,
      memberId: row.memberId,
      kind: row.kind,
      spaceId: row.spaceId,
      spaceName: row.spaceName,
      seatLabel: row.seatLabel,
      seatSpaceId: row.seatSpaceId,
      date: row.date,
      startAt: row.startAt,
      endAt: row.endAt,
      note: row.note,
      status: row.status,
      journalId: row.journalId,
      createdAt: row.createdAt,
      memberName,
      visitorNumber: row.member?.visitorNumber ?? null,
      phone: row.member?.phone ?? null,
      avatarUrl: row.member?.avatarUrl ?? null,
    };
  }

  async createBookingRequest(dto: {
    memberId: string;
    kind: 'ROOM' | 'SEAT';
    spaceId?: string;
    seatLabel?: string;
    seatSpaceId?: string;
    date: string;
    startTime: string;
    endTime: string;
    note?: string;
  }) {
    const member = await this.prisma.member.findUnique({
      where: { id: dto.memberId },
    });
    if (!member) throw new NotFoundException('Membre introuvable');
    const kind =
      dto.kind === 'SEAT' ? BookingRequestKind.SEAT : BookingRequestKind.ROOM;
    if (kind === BookingRequestKind.ROOM && !dto.spaceId) {
      throw new BadRequestException('Choisissez une salle');
    }
    if (kind === BookingRequestKind.SEAT && !dto.seatLabel) {
      throw new BadRequestException('Choisissez une place');
    }
    const day = startOfDay(new Date(`${dto.date}T12:00:00`));
    const startAt = new Date(`${dto.date}T${dto.startTime}:00`);
    const endAt = new Date(`${dto.date}T${dto.endTime}:00`);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      throw new BadRequestException('Horaires invalides');
    }
    if (endAt.getTime() <= startAt.getTime()) {
      throw new BadRequestException('L’heure de fin doit être après le début');
    }
    const pending = await this.prisma.bookingRequest.findFirst({
      where: { memberId: dto.memberId, status: VisitRequestStatus.PENDING },
    });
    if (pending) {
      throw new ConflictException('Vous avez déjà une réservation en attente');
    }
    let spaceName: string | null = null;
    if (dto.spaceId) {
      const space = await this.prisma.space.findUnique({
        where: { id: dto.spaceId },
      });
      if (!space) throw new NotFoundException('Espace introuvable');
      spaceName = space.name;
    }
    const created = await this.prisma.bookingRequest.create({
      data: {
        memberId: dto.memberId,
        kind,
        spaceId: dto.spaceId || null,
        spaceName,
        seatLabel: dto.seatLabel?.trim() || null,
        seatSpaceId: dto.seatSpaceId || dto.spaceId || null,
        date: day,
        startAt,
        endAt,
        note: (dto.note || '').trim() || null,
      },
      include: { member: true },
    });
    const payload = this.serializeBooking(created);
    this.eventsGateway.sendBookingRequest(payload);
    return payload;
  }

  async listBookingRequests(status?: VisitRequestStatus) {
    const rows = await this.prisma.bookingRequest.findMany({
      where: status ? { status } : undefined,
      include: { member: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((r) => this.serializeBooking(r));
  }

  async listMemberBookingRequests(memberId: string) {
    const rows = await this.prisma.bookingRequest.findMany({
      where: { memberId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return rows.map((r) => this.serializeBooking(r));
  }

  async cancelBookingRequest(id: string, memberId: string) {
    const row = await this.prisma.bookingRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Réservation introuvable');
    if (row.memberId !== memberId) {
      throw new ConflictException('Pas votre réservation');
    }
    if (row.status !== VisitRequestStatus.PENDING) {
      throw new ConflictException('Déjà traitée');
    }
    const updated = await this.prisma.bookingRequest.update({
      where: { id },
      data: { status: VisitRequestStatus.REJECTED },
      include: { member: true },
    });
    this.eventsGateway.sendBookingRequestResolved({
      id: updated.id,
      status: 'CANCELLED',
      memberId: updated.memberId,
    });
    return this.serializeBooking(updated);
  }

  async approveBookingRequest(id: string) {
    const row = await this.prisma.bookingRequest.findUnique({
      where: { id },
      include: { member: true },
    });
    if (!row) throw new NotFoundException('Réservation introuvable');
    if (row.status !== VisitRequestStatus.PENDING) {
      throw new ConflictException('Déjà traitée');
    }
    const price = await this.prisma.price.findFirst({
      where: {
        isActive: true,
        category:
          row.kind === BookingRequestKind.ROOM
            ? PriceCategory.SALLE
            : { in: [PriceCategory.JOURNEE, PriceCategory.OPEN_SPACE] },
      },
      orderBy: { createdAt: 'asc' },
    });
    const journal = price
      ? await this.prisma.journal.create({
          data: {
            memberID: row.memberId,
            priceId: price.id,
            registredTime: row.startAt,
            leaveTime: row.endAt,
            isPayed: false,
            isReservation: true,
            payedAmount: price.price,
          },
        })
      : null;
    const today = startOfDay(new Date());
    if (row.date.getTime() <= today.getTime()) {
      if (row.kind === BookingRequestKind.ROOM && row.spaceId) {
        await this.bookSeatsForMemberByKind(row.memberId, {
          spaceId: row.spaceId,
        });
      } else if (row.seatLabel) {
        await this.bookSeatForMember(row.memberId, row.seatLabel, {
          spaceId: row.seatSpaceId || undefined,
        });
      }
    }
    const updated = await this.prisma.bookingRequest.update({
      where: { id },
      data: {
        status: VisitRequestStatus.APPROVED,
        journalId: journal?.id || null,
      },
      include: { member: true },
    });
    this.eventsGateway.sendBookingRequestResolved({
      id: updated.id,
      status: updated.status,
      memberId: updated.memberId,
    });
    void this.pushService.sendToMember(updated.memberId, {
      title: 'Réservation confirmée',
      body: 'L’accueil a accepté votre réservation.',
      tag: `book-ok-${updated.id}`,
      url: '/m',
    });
    return this.serializeBooking(updated);
  }

  async rejectBookingRequest(id: string) {
    const row = await this.prisma.bookingRequest.findUnique({
      where: { id },
      include: { member: true },
    });
    if (!row) throw new NotFoundException('Réservation introuvable');
    if (row.status !== VisitRequestStatus.PENDING) {
      throw new ConflictException('Déjà traitée');
    }
    const updated = await this.prisma.bookingRequest.update({
      where: { id },
      data: { status: VisitRequestStatus.REJECTED },
      include: { member: true },
    });
    this.eventsGateway.sendBookingRequestResolved({
      id: updated.id,
      status: updated.status,
      memberId: updated.memberId,
    });
    void this.pushService.sendToMember(updated.memberId, {
      title: 'Réservation refusée',
      body: 'L’accueil a refusé votre réservation.',
      tag: `book-no-${updated.id}`,
      url: '/m',
    });
    return this.serializeBooking(updated);
  }
}
