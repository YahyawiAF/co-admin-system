import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  EventKind,
  EventRegistrationStatus,
  EventStatus,
} from '@prisma/client';
import { PrismaService } from 'database/prisma.service';
import {
  CreateEventDto,
  EventFeedbackDto,
  UpdateEventDto,
} from './dtos/event.dto';

const ACTIVE_REG = [
  EventRegistrationStatus.REGISTERED,
  EventRegistrationStatus.ATTENDED,
] as EventRegistrationStatus[];

@Injectable()
export class SpaceEventsService {
  constructor(private readonly prisma: PrismaService) {}

  private async defaultFacilityId(facilityId?: string) {
    if (facilityId) {
      const fac = await this.prisma.facility.findUnique({
        where: { id: facilityId },
        select: { id: true },
      });
      if (!fac) throw new NotFoundException('Facility not found');
      return fac.id;
    }
    const fac = await this.prisma.facility.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!fac) throw new BadRequestException('Aucune facility configurée');
    return fac.id;
  }

  private async resolveFacilityBySlug(orgSlug?: string) {
    if (!orgSlug) {
      return this.prisma.facility.findFirst({
        orderBy: { createdAt: 'asc' },
      });
    }
    const org = await this.prisma.organization.findUnique({
      where: { slug: orgSlug },
      include: {
        facilities: { orderBy: { createdAt: 'asc' }, take: 1 },
      },
    });
    if (!org) throw new NotFoundException('Organisation introuvable');
    return org.facilities[0] || null;
  }

  private attendanceCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    const buf = randomBytes(6);
    for (let i = 0; i < 6; i++) code += chars[buf[i] % chars.length];
    return code;
  }

  private async uniqueAttendanceCode(): Promise<string> {
    for (let i = 0; i < 12; i++) {
      const code = this.attendanceCode();
      const existing = await this.prisma.eventRegistration.findUnique({
        where: { attendanceCode: code },
        select: { id: true },
      });
      if (!existing) return code;
    }
    return `${this.attendanceCode()}${Date.now().toString(36).slice(-2)}`;
  }

  private activeCount(registrations: { status: EventRegistrationStatus }[]) {
    return registrations.filter((r) => ACTIVE_REG.includes(r.status)).length;
  }

  private toAdminListItem(event: {
    id: string;
    title: string;
    description: string | null;
    kind: EventKind;
    location: string | null;
    startAt: Date;
    endAt: Date;
    capacity: number | null;
    status: EventStatus;
    coverImage: string | null;
    facilityId: string;
    createdAt: Date;
    updatedAt: Date;
    registrations: { status: EventRegistrationStatus }[];
  }) {
    const registered = this.activeCount(event.registrations);
    const attended = event.registrations.filter(
      (r) => r.status === EventRegistrationStatus.ATTENDED,
    ).length;
    return {
      id: event.id,
      facilityId: event.facilityId,
      title: event.title,
      description: event.description,
      kind: event.kind,
      location: event.location,
      startAt: event.startAt,
      endAt: event.endAt,
      capacity: event.capacity,
      status: event.status,
      coverImage: event.coverImage,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      registeredCount: registered,
      attendedCount: attended,
    };
  }

  async adminList() {
    const events = await this.prisma.event.findMany({
      orderBy: { startAt: 'desc' },
      include: { registrations: { select: { status: true } } },
    });
    return events.map((e) => this.toAdminListItem(e));
  }

  async adminGet(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        registrations: {
          include: {
            member: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                avatarUrl: true,
                functionality: true,
                showInDirectory: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!event) throw new NotFoundException('Événement introuvable');
    const ratings = event.registrations
      .map((r) => r.feedbackRating)
      .filter((n): n is number => n != null);
    const avg =
      ratings.length === 0
        ? null
        : Math.round(
            (ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10,
          ) / 10;
    return {
      ...this.toAdminListItem(event),
      feedback: {
        count: ratings.length,
        average: avg,
        comments: event.registrations
          .filter((r) => r.feedbackRating != null)
          .map((r) => ({
            memberId: r.memberId,
            name: [r.member.firstName, r.member.lastName]
              .filter(Boolean)
              .join(' '),
            rating: r.feedbackRating,
            comment: r.feedbackComment,
            at: r.feedbackAt,
          })),
      },
      registrations: event.registrations.map((r) => ({
        id: r.id,
        status: r.status,
        attendanceCode: r.attendanceCode,
        checkedInAt: r.checkedInAt,
        createdAt: r.createdAt,
        feedbackRating: r.feedbackRating,
        feedbackComment: r.feedbackComment,
        member: r.member,
      })),
    };
  }

  async create(dto: CreateEventDto) {
    if (new Date(dto.endAt) <= new Date(dto.startAt)) {
      throw new BadRequestException('La fin doit être après le début');
    }
    const facilityId = await this.defaultFacilityId(dto.facilityId);
    return this.prisma.event.create({
      data: {
        facilityId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        kind: dto.kind || EventKind.OTHER,
        location: dto.location?.trim() || null,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        capacity: dto.capacity ?? null,
        status: dto.status || EventStatus.PUBLISHED,
        coverImage: dto.coverImage || null,
      },
    });
  }

  async update(id: string, dto: UpdateEventDto) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Événement introuvable');
    const startAt = dto.startAt ? new Date(dto.startAt) : event.startAt;
    const endAt = dto.endAt ? new Date(dto.endAt) : event.endAt;
    if (endAt <= startAt) {
      throw new BadRequestException('La fin doit être après le début');
    }
    return this.prisma.event.update({
      where: { id },
      data: {
        title: dto.title !== undefined ? dto.title.trim() : undefined,
        description:
          dto.description !== undefined
            ? dto.description.trim() || null
            : undefined,
        kind: dto.kind,
        location:
          dto.location !== undefined ? dto.location.trim() || null : undefined,
        startAt: dto.startAt ? startAt : undefined,
        endAt: dto.endAt ? endAt : undefined,
        capacity: dto.capacity === undefined ? undefined : dto.capacity,
        status: dto.status,
        coverImage:
          dto.coverImage !== undefined ? dto.coverImage || null : undefined,
      },
    });
  }

  async cancel(id: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Événement introuvable');
    return this.prisma.event.update({
      where: { id },
      data: { status: EventStatus.CANCELLED },
    });
  }

  async markAttendance(eventId: string, code: string) {
    const trimmed = (code || '').trim().toUpperCase();
    if (!trimmed) throw new BadRequestException('Code requis');
    const registration = await this.prisma.eventRegistration.findFirst({
      where: {
        eventId,
        attendanceCode: { equals: trimmed, mode: 'insensitive' },
      },
      include: {
        member: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
      },
    });
    if (!registration) {
      throw new NotFoundException('Code inconnu pour cet événement');
    }
    if (registration.status === EventRegistrationStatus.CANCELLED) {
      throw new BadRequestException('Inscription annulée');
    }
    const updated = await this.prisma.eventRegistration.update({
      where: { id: registration.id },
      data: {
        status: EventRegistrationStatus.ATTENDED,
        checkedInAt: registration.checkedInAt || new Date(),
      },
      include: {
        member: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
      },
    });
    return updated;
  }

  async listPublic(orgSlug?: string, when: 'upcoming' | 'past' = 'upcoming') {
    const facility = await this.resolveFacilityBySlug(orgSlug);
    const now = new Date();
    const events = await this.prisma.event.findMany({
      where: {
        status: EventStatus.PUBLISHED,
        ...(facility ? { facilityId: facility.id } : {}),
        ...(when === 'upcoming'
          ? { endAt: { gte: now } }
          : { endAt: { lt: now } }),
      },
      orderBy: { startAt: when === 'upcoming' ? 'asc' : 'desc' },
      include: { registrations: { select: { status: true } } },
    });
    return events.map((e) => ({
      ...this.toAdminListItem(e),
      spotsLeft:
        e.capacity == null
          ? null
          : Math.max(0, e.capacity - this.activeCount(e.registrations)),
    }));
  }

  async getPublic(id: string, memberId?: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: { registrations: { select: { status: true } } },
    });
    if (!event || event.status === EventStatus.DRAFT) {
      throw new NotFoundException('Événement introuvable');
    }
    let mine = null as null | {
      status: EventRegistrationStatus;
      attendanceCode: string;
      checkedInAt: Date | null;
      feedbackRating: number | null;
      feedbackComment: string | null;
    };
    if (memberId) {
      const reg = await this.prisma.eventRegistration.findUnique({
        where: { eventId_memberId: { eventId: id, memberId } },
      });
      if (reg) {
        mine = {
          status: reg.status,
          attendanceCode: reg.attendanceCode,
          checkedInAt: reg.checkedInAt,
          feedbackRating: reg.feedbackRating,
          feedbackComment: reg.feedbackComment,
        };
      }
    }
    return {
      ...this.toAdminListItem(event),
      spotsLeft:
        event.capacity == null
          ? null
          : Math.max(0, event.capacity - this.activeCount(event.registrations)),
      registration: mine,
    };
  }

  async register(eventId: string, memberId: string) {
    const [event, member] = await Promise.all([
      this.prisma.event.findUnique({
        where: { id: eventId },
        include: { registrations: { select: { status: true } } },
      }),
      this.prisma.member.findUnique({ where: { id: memberId } }),
    ]);
    if (!event || event.status !== EventStatus.PUBLISHED) {
      throw new NotFoundException('Événement introuvable');
    }
    if (!member) throw new NotFoundException('Membre introuvable');
    if (event.endAt < new Date()) {
      throw new BadRequestException('Événement terminé');
    }
    const existing = await this.prisma.eventRegistration.findUnique({
      where: { eventId_memberId: { eventId, memberId } },
    });
    if (existing && existing.status !== EventRegistrationStatus.CANCELLED) {
      return existing;
    }
    const taken = this.activeCount(event.registrations);
    if (
      event.capacity != null &&
      taken >= event.capacity &&
      !(existing && existing.status === EventRegistrationStatus.CANCELLED)
    ) {
      throw new ConflictException('Plus de places disponibles');
    }
    if (existing) {
      return this.prisma.eventRegistration.update({
        where: { id: existing.id },
        data: {
          status: EventRegistrationStatus.REGISTERED,
          attendanceCode:
            existing.attendanceCode || (await this.uniqueAttendanceCode()),
        },
      });
    }
    return this.prisma.eventRegistration.create({
      data: {
        eventId,
        memberId,
        attendanceCode: await this.uniqueAttendanceCode(),
        status: EventRegistrationStatus.REGISTERED,
      },
    });
  }

  async unregister(eventId: string, memberId: string) {
    const existing = await this.prisma.eventRegistration.findUnique({
      where: { eventId_memberId: { eventId, memberId } },
    });
    if (!existing) throw new NotFoundException('Inscription introuvable');
    if (existing.status === EventRegistrationStatus.ATTENDED) {
      throw new BadRequestException('Présence déjà enregistrée');
    }
    return this.prisma.eventRegistration.update({
      where: { id: existing.id },
      data: { status: EventRegistrationStatus.CANCELLED },
    });
  }

  async attendees(eventId: string, memberId?: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event || event.status === EventStatus.DRAFT) {
      throw new NotFoundException('Événement introuvable');
    }
    const registrations = await this.prisma.eventRegistration.findMany({
      where: { eventId, status: { in: ACTIVE_REG } },
      include: { member: true },
      orderBy: { createdAt: 'asc' },
    });
    const visible = registrations.filter(
      (r) => r.member.showInDirectory || r.memberId === memberId,
    );
    const hiddenCount =
      registrations.length -
      visible.filter((r) => r.member.showInDirectory).length;
    return {
      total: registrations.length,
      hiddenCount: Math.max(0, hiddenCount),
      attendees: visible
        .filter((r) => r.member.showInDirectory)
        .map((r) => ({
          id: r.member.id,
          firstName: r.member.firstName,
          lastName: r.member.lastName,
          functionality: r.member.functionality,
          skills: r.member.skills,
          services: r.member.services,
          linkedinUrl: r.member.linkedinUrl,
          openToCollaboration: r.member.openToCollaboration,
          avatarUrl: r.member.avatarUrl,
          bio: r.member.bio,
          showInDirectory: true,
        })),
    };
  }

  async feedback(eventId: string, dto: EventFeedbackDto) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) throw new NotFoundException('Événement introuvable');
    if (event.endAt > new Date()) {
      throw new BadRequestException('L’événement n’est pas encore terminé');
    }
    const reg = await this.prisma.eventRegistration.findUnique({
      where: { eventId_memberId: { eventId, memberId: dto.memberId } },
    });
    if (!reg) throw new NotFoundException('Inscription introuvable');
    if (reg.status !== EventRegistrationStatus.ATTENDED) {
      throw new BadRequestException(
        'Seuls les participants présents peuvent noter',
      );
    }
    if (reg.feedbackAt) {
      throw new BadRequestException('Avis déjà envoyé');
    }
    return this.prisma.eventRegistration.update({
      where: { id: reg.id },
      data: {
        feedbackRating: dto.rating,
        feedbackComment: dto.comment?.trim() || null,
        feedbackAt: new Date(),
      },
    });
  }
}
