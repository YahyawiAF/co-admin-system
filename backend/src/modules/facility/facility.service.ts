import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PriceCategory, FixtureKind } from '@prisma/client';
import { startOfDay } from 'date-fns';
import { PrismaService } from 'database/prisma.service';
import { FacilityEntity } from './entities/facility.entitie';
import { UpdateFacilityDto } from './dtos/updateFac.dto';

@Injectable()
export class FacilityService {
  constructor(private readonly prisma: PrismaService) {}

  private toFacilityEntity(facility: any): FacilityEntity {
    return new FacilityEntity({
      ...facility,
      socialNetworks: facility.socialNetworks as Record<string, string>,
      places: facility.places as Record<string, unknown>,
    });
  }

  private facilityScore(facility: {
    places?: unknown;
    nbrPlaces?: number;
    spaces?: unknown[];
    _count?: { spaces?: number };
  }) {
    const places =
      facility.places && typeof facility.places === 'object'
        ? Object.keys(facility.places as object).length
        : 0;
    const spaces =
      facility._count?.spaces ??
      (Array.isArray(facility.spaces) ? facility.spaces.length : 0);
    return places * 100 + spaces * 50 + (facility.nbrPlaces || 0);
  }

  async create(): Promise<FacilityEntity> {
    // Never spawn duplicate empty facilities — reuse the first one
    const existing = await this.prisma.facility.findFirst({
      orderBy: { createdAt: 'asc' },
      include: {
        spaces: {
          include: {
            tables: { include: { seats: true } },
            seats: true,
            walls: true,
          },
        },
      },
    });
    if (existing) return this.toFacilityEntity(existing);

    const exampleData = {
      name: '',
      numtel: '',
      email: '',
      adresse: '',
      logo: '',
      nbrPlaces: 0,
      socialNetworks: { facebook: '', twitter: '' },
      places: {},
    };
    const facility = await this.prisma.facility.create({
      data: {
        ...exampleData,
        socialNetworks: exampleData.socialNetworks,
        places: exampleData.places,
      },
    });
    return this.toFacilityEntity(facility);
  }

  async findAll(): Promise<FacilityEntity[]> {
    let facilities = await this.prisma.facility.findMany({
      include: {
        spaces: {
          orderBy: { sortOrder: 'asc' },
          include: {
            tables: { orderBy: { sortOrder: 'asc' }, include: { seats: true } },
            seats: true,
            walls: true,
          },
        },
      },
    });

    // Remove empty auto-created shells when a real facility exists
    const hasReal = facilities.some((f) => this.facilityScore(f) > 0);
    if (hasReal) {
      const empties = facilities.filter((f) => this.facilityScore(f) === 0);
      for (const empty of empties) {
        try {
          await this.prisma.facility.delete({ where: { id: empty.id } });
        } catch {
          /* ignore if constrained */
        }
      }
      if (empties.length) {
        facilities = await this.prisma.facility.findMany({
          include: {
            spaces: {
              orderBy: { sortOrder: 'asc' },
              include: {
                tables: {
                  orderBy: { sortOrder: 'asc' },
                  include: { seats: true },
                },
                seats: true,
                walls: true,
              },
            },
          },
        });
      }
    }

    return facilities
      .sort((a, b) => this.facilityScore(b) - this.facilityScore(a))
      .map((facility) => this.toFacilityEntity(facility));
  }

  async findOne(id: string): Promise<FacilityEntity> {
    const facility = await this.prisma.facility.findUnique({
      where: { id },
      include: {
        spaces: {
          orderBy: { sortOrder: 'asc' },
          include: {
            tables: { orderBy: { sortOrder: 'asc' }, include: { seats: true } },
            seats: true,
            walls: true,
          },
        },
      },
    });
    if (!facility) {
      throw new NotFoundException(`Facility with ID ${id} not found`);
    }
    return this.toFacilityEntity(facility);
  }

  async update(
    id: string,
    updateFacilityDto: UpdateFacilityDto,
  ): Promise<FacilityEntity> {
    const existingFacility = await this.prisma.facility.findUnique({
      where: { id },
    });
    if (!existingFacility) {
      throw new NotFoundException(`Facility with ID ${id} not found`);
    }

    // If legacy places JSON updated, migrate into Space/Seat when no spaces yet
    if (updateFacilityDto.places !== undefined) {
      const spaceCount = await this.prisma.space.count({
        where: { facilityId: id },
      });
      if (spaceCount === 0) {
        await this.migratePlacesJson(
          id,
          updateFacilityDto.places as Record<string, unknown>,
        );
      }
    }

    const updatedFacility = await this.prisma.facility.update({
      where: { id },
      data: {
        ...updateFacilityDto,
        receptionAwayStartedAt:
          updateFacilityDto.receptionAwayStartedAt === undefined
            ? existingFacility.receptionAwayStartedAt
            : updateFacilityDto.receptionAwayStartedAt
              ? new Date(updateFacilityDto.receptionAwayStartedAt)
              : null,
        socialNetworks:
          updateFacilityDto.socialNetworks !== undefined
            ? updateFacilityDto.socialNetworks
            : existingFacility.socialNetworks,
        places:
          updateFacilityDto.places !== undefined
            ? updateFacilityDto.places
            : existingFacility.places,
      },
      include: {
        spaces: {
          include: {
            tables: { include: { seats: true } },
            seats: true,
          },
        },
      },
    });

    await this.recalcNbrPlaces(id);
    return this.toFacilityEntity(updatedFacility);
  }

  async listAwayArrivals(facilityId: string) {
    const facility = await this.prisma.facility.findUnique({
      where: { id: facilityId },
    });
    if (!facility) {
      throw new NotFoundException(`Facility with ID ${facilityId} not found`);
    }
    const since = facility.receptionAwayStartedAt;
    if (!since) {
      return {
        startedAt: null,
        receptionAway: facility.receptionAway,
        arrivals: [],
      };
    }
    const orgId = facility.organizationId;
    const journals = await this.prisma.journal.findMany({
      where: {
        registredTime: { gte: since },
        ...(orgId ? { members: { organizationId: orgId } } : {}),
      },
      include: {
        members: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            visitorNumber: true,
          },
        },
        prices: { select: { name: true } },
      },
      orderBy: { registredTime: 'asc' },
    });
    const memberIds = journals
      .map((j) => j.memberID)
      .filter((id): id is string => !!id);
    const bookings = memberIds.length
      ? await this.prisma.seatBooking.findMany({
          where: { isBooked: true, memberId: { in: memberIds } },
          include: { space: { select: { name: true } } },
        })
      : [];
    const seatByMember = new Map(
      bookings.map((b) => [
        b.memberId as string,
        {
          seatLabel: b.seatId,
          spaceName: b.space?.name || null,
        },
      ]),
    );
    const seen = new Set<string>();
    const arrivals: Array<{
      memberId: string | null;
      name: string;
      visitorNumber: number | null;
      forfait: string | null;
      seatLabel: string | null;
      spaceName: string | null;
      arrivedAt: string;
      journalId: string | null;
      autoApproved: boolean;
    }> = [];

    for (const j of journals) {
      const key = j.memberID || j.id;
      seen.add(key);
      const seat = j.memberID ? seatByMember.get(j.memberID) : undefined;
      const name = j.members
        ? [j.members.firstName, j.members.lastName].filter(Boolean).join(' ') ||
          'Visiteur'
        : j.guestName || 'Visiteur';
      arrivals.push({
        memberId: j.memberID,
        name,
        visitorNumber: j.members?.visitorNumber ?? null,
        forfait: j.prices?.name || null,
        seatLabel: seat?.seatLabel || null,
        spaceName: seat?.spaceName || null,
        arrivedAt: j.registredTime.toISOString(),
        journalId: j.id,
        autoApproved: true,
      });
    }

    const requests = await this.prisma.visitRequest.findMany({
      where: {
        autoApproved: true,
        createdAt: { gte: since },
        ...(orgId ? { member: { organizationId: orgId } } : {}),
      },
      include: {
        member: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            visitorNumber: true,
          },
        },
        price: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    for (const r of requests) {
      if (r.memberId && seen.has(r.memberId)) continue;
      seen.add(r.memberId);
      const seat = seatByMember.get(r.memberId);
      arrivals.push({
        memberId: r.memberId,
        name:
          [r.member.firstName, r.member.lastName].filter(Boolean).join(' ') ||
          'Visiteur',
        visitorNumber: r.member.visitorNumber ?? null,
        forfait: r.price?.name || null,
        seatLabel: r.seatLabel || seat?.seatLabel || null,
        spaceName: seat?.spaceName || null,
        arrivedAt: r.createdAt.toISOString(),
        journalId: null,
        autoApproved: true,
      });
    }

    arrivals.sort(
      (a, b) => new Date(a.arrivedAt).getTime() - new Date(b.arrivedAt).getTime(),
    );
    return {
      startedAt: since.toISOString(),
      receptionAway: facility.receptionAway,
      arrivals,
    };
  }

  async remove(id: string): Promise<void> {
    const facility = await this.prisma.facility.findUnique({ where: { id } });
    if (!facility) {
      throw new NotFoundException(`Facility with ID ${id} not found`);
    }
    await this.prisma.facility.delete({ where: { id } });
  }

  /** Migrate legacy places JSON { id: { name, seats[] } } into Space/Seat rows. */
  async migratePlacesJson(facilityId: string, places: Record<string, unknown>) {
    for (const [key, raw] of Object.entries(places || {})) {
      if (!raw || typeof raw !== 'object') continue;
      const s = raw as Record<string, unknown>;
      const name = String(s.name || key);
      const seatsArr = Array.isArray(s.seats)
        ? (s.seats as string[])
        : Array.from(
            { length: Number(s.capacity || s.nbr || 0) },
            (_, i) => `${name}-${i + 1}`,
          );
      const space = await this.prisma.space.create({
        data: {
          facilityId,
          name,
          capacityNormal: seatsArr.length,
        },
      });
      for (let i = 0; i < seatsArr.length; i++) {
        await this.prisma.seat.create({
          data: {
            spaceId: space.id,
            label: seatsArr[i],
            offsetX: (i % 4) * 36,
            offsetY: Math.floor(i / 4) * 36,
          },
        });
      }
    }
    await this.syncPlacesJson(facilityId);
  }

  private spaceKey(name: string) {
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-_]/g, '');
  }

  /** Keep legacy Facility.places in sync so deleted spaces are not remigrated. */
  async syncPlacesJson(facilityId: string) {
    const spaces = await this.prisma.space.findMany({
      where: { facilityId },
      include: {
        seats: { where: { isActive: true }, orderBy: { label: 'asc' } },
      },
      orderBy: { sortOrder: 'asc' },
    });
    const places: Record<string, unknown> = {};
    for (const space of spaces) {
      const key = this.spaceKey(space.name) || space.id;
      places[key] = {
        name: space.name,
        seats: space.seats.map((s) => s.label),
        capacity: space.seats.filter((s) => !s.isOverflow).length,
      };
    }
    await this.prisma.facility.update({
      where: { id: facilityId },
      data: { places: places as Prisma.InputJsonValue },
    });
  }

  async listLayout(facilityId?: string) {
    let facility = facilityId
      ? await this.prisma.facility.findUnique({ where: { id: facilityId } })
      : null;

    if (!facility) {
      // Prefer facility with places JSON or existing spaces — not empty shells
      const all = await this.prisma.facility.findMany({
        include: { _count: { select: { spaces: true } } },
        orderBy: { createdAt: 'asc' },
      });
      facility =
        all.sort((a, b) => {
          const placesA =
            a.places && typeof a.places === 'object'
              ? Object.keys(a.places as object).length
              : 0;
          const placesB =
            b.places && typeof b.places === 'object'
              ? Object.keys(b.places as object).length
              : 0;
          return (
            placesB +
            b._count.spaces * 10 +
            b.nbrPlaces -
            (placesA + a._count.spaces * 10 + a.nbrPlaces)
          );
        })[0] || null;
    }

    if (!facility) return { facility: null, spaces: [] };

    // Legacy places → Space migration is one-shot only via migratePlacesJson
    // (called from facility update). Do NOT remigrate on layout load —
    // that resurrected deleted spaces from stale Facility.places JSON.

    const spaces = await this.prisma.space.findMany({
      where: { facilityId: facility.id },
      orderBy: { sortOrder: 'asc' },
      include: {
        tables: {
          orderBy: { sortOrder: 'asc' },
          include: {
            seats: { where: { isActive: true }, orderBy: { label: 'asc' } },
          },
        },
        seats: { where: { isActive: true }, orderBy: { label: 'asc' } },
        walls: { orderBy: { createdAt: 'asc' } },
        fixtures: { orderBy: { createdAt: 'asc' } },
      },
    });

    // Keep legacy places aligned with live spaces (best-effort)
    try {
      await this.syncPlacesJson(facility.id);
      const refreshed = await this.prisma.facility.findUnique({
        where: { id: facility.id },
      });
      if (refreshed) facility = refreshed;
    } catch {
      /* ignore heal errors */
    }

    return { facility, spaces };
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

  async createSpace(data: {
    facilityId: string;
    name: string;
    floorPlanUrl?: string;
    capacityNormal?: number;
    category?: PriceCategory;
  }) {
    const space = await this.prisma.space.create({
      data: {
        facilityId: data.facilityId,
        name: data.name,
        floorPlanUrl: data.floorPlanUrl,
        capacityNormal: data.capacityNormal ?? 0,
        category: data.category || this.inferSpaceCategory(data.name),
      },
      include: { tables: true, seats: true },
    });
    await this.syncPlacesJson(data.facilityId);
    await this.recalcNbrPlaces(data.facilityId);
    return space;
  }

  async updateSpace(
    id: string,
    data: Partial<{
      name: string;
      floorPlanUrl: string | null;
      sortOrder: number;
      capacityNormal: number;
      category: PriceCategory;
      wifiSsid: string | null;
      wifiPassword: string | null;
      openForReservation: boolean;
    }>,
  ) {
    const space = await this.prisma.space.update({
      where: { id },
      data,
      include: {
        tables: { include: { seats: true } },
        seats: true,
      },
    });
    await this.syncPlacesJson(space.facilityId);
    await this.recalcNbrPlaces(space.facilityId);
    return space;
  }

  async deleteSpace(id: string) {
    const space = await this.prisma.space.findUnique({ where: { id } });
    if (!space) throw new NotFoundException('Space not found');

    // Explicit cascade cleanup (tables/seats/walls) then space
    await this.prisma.$transaction([
      this.prisma.seat.deleteMany({ where: { spaceId: id } }),
      this.prisma.table.deleteMany({ where: { spaceId: id } }),
      this.prisma.spaceWall.deleteMany({ where: { spaceId: id } }),
      this.prisma.space.delete({ where: { id } }),
    ]);

    await this.syncPlacesJson(space.facilityId);
    await this.recalcNbrPlaces(space.facilityId);
    return { ok: true };
  }

  async createTable(data: {
    spaceId: string;
    name: string;
    imageUrl?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    seatCount?: number;
    overflowCount?: number;
  }) {
    const table = await this.prisma.table.create({
      data: {
        spaceId: data.spaceId,
        name: data.name,
        imageUrl: data.imageUrl,
        x: data.x ?? 40,
        y: data.y ?? 40,
        width: data.width ?? 120,
        height: data.height ?? 80,
      },
    });
    const normal = data.seatCount ?? 4;
    const overflow = data.overflowCount ?? 0;
    const seats = [];
    for (let i = 0; i < normal; i++) {
      seats.push(
        await this.prisma.seat.create({
          data: {
            spaceId: data.spaceId,
            tableId: table.id,
            label: `${data.name}-${i + 1}`,
            offsetX: 10 + (i % 4) * 28,
            offsetY: -18,
            isOverflow: false,
          },
        }),
      );
    }
    for (let i = 0; i < overflow; i++) {
      seats.push(
        await this.prisma.seat.create({
          data: {
            spaceId: data.spaceId,
            tableId: table.id,
            label: `${data.name}-X${i + 1}`,
            offsetX: 10 + (i % 4) * 28,
            offsetY: data.height ?? 80 + 8,
            isOverflow: true,
          },
        }),
      );
    }
    const space = await this.prisma.space.findUnique({
      where: { id: data.spaceId },
    });
    if (space) await this.recalcNbrPlaces(space.facilityId);
    return { ...table, seats };
  }

  async updateTable(
    id: string,
    data: Partial<{
      name: string;
      imageUrl: string | null;
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
      sortOrder: number;
    }>,
  ) {
    return this.prisma.table.update({
      where: { id },
      data,
      include: { seats: true },
    });
  }

  async deleteTable(id: string) {
    const table = await this.prisma.table.findUnique({ where: { id } });
    if (!table) throw new NotFoundException('Table not found');
    await this.prisma.$transaction([
      this.prisma.seat.deleteMany({ where: { tableId: id } }),
      this.prisma.table.delete({ where: { id } }),
    ]);
    const space = await this.prisma.space.findUnique({
      where: { id: table.spaceId },
    });
    if (space) {
      await this.syncPlacesJson(space.facilityId);
      await this.recalcNbrPlaces(space.facilityId);
    }
    return { ok: true };
  }

  async createSeat(data: {
    spaceId: string;
    tableId?: string;
    label: string;
    offsetX?: number;
    offsetY?: number;
    isOverflow?: boolean;
  }) {
    const seat = await this.prisma.seat.create({
      data: {
        spaceId: data.spaceId,
        tableId: data.tableId,
        label: data.label,
        offsetX: data.offsetX ?? 0,
        offsetY: data.offsetY ?? 0,
        isOverflow: data.isOverflow ?? false,
      },
    });
    const space = await this.prisma.space.findUnique({
      where: { id: data.spaceId },
    });
    if (space) await this.recalcNbrPlaces(space.facilityId);
    return seat;
  }

  async updateSeat(
    id: string,
    data: Partial<{
      label: string;
      offsetX: number;
      offsetY: number;
      isOverflow: boolean;
      isActive: boolean;
      tableId: string | null;
    }>,
  ) {
    return this.prisma.seat.update({ where: { id }, data });
  }

  async deleteSeat(id: string) {
    const seat = await this.prisma.seat.findUnique({ where: { id } });
    if (!seat) throw new NotFoundException('Seat not found');
    await this.prisma.seat.delete({ where: { id } });
    const space = await this.prisma.space.findUnique({
      where: { id: seat.spaceId },
    });
    if (space) await this.recalcNbrPlaces(space.facilityId);
    return { ok: true };
  }

  async createWall(data: {
    spaceId: string;
    label?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotation?: number;
  }) {
    return this.prisma.spaceWall.create({
      data: {
        spaceId: data.spaceId,
        label: data.label,
        x: data.x ?? 80,
        y: data.y ?? 80,
        width: data.width ?? 160,
        height: data.height ?? 12,
        rotation: data.rotation ?? 0,
      },
    });
  }

  async updateWall(
    id: string,
    data: Partial<{
      label: string | null;
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
    }>,
  ) {
    return this.prisma.spaceWall.update({ where: { id }, data });
  }

  async deleteWall(id: string) {
    await this.prisma.spaceWall.delete({ where: { id } });
    return { ok: true };
  }

  async createFixture(data: {
    spaceId: string;
    kind: FixtureKind;
    label?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotation?: number;
  }) {
    const defaults = fixtureDefaults(data.kind);
    return this.prisma.spaceFixture.create({
      data: {
        spaceId: data.spaceId,
        kind: data.kind,
        label: data.label,
        x: data.x ?? 80,
        y: data.y ?? 80,
        width: data.width ?? defaults.width,
        height: data.height ?? defaults.height,
        rotation: data.rotation ?? 0,
      },
    });
  }

  async updateFixture(
    id: string,
    data: Partial<{
      kind: FixtureKind;
      label: string | null;
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
    }>,
  ) {
    return this.prisma.spaceFixture.update({ where: { id }, data });
  }

  async deleteFixture(id: string) {
    await this.prisma.spaceFixture.delete({ where: { id } });
    return { ok: true };
  }

  async occupancy() {
    await this.prisma.seatBooking.deleteMany({
      where: {
        eventKey: 'collabora-hub',
        isPermanent: false,
        bookedAt: { lt: startOfDay(new Date()) },
      },
    });
    const seats = await this.prisma.seat.findMany({
      where: { isActive: true },
    });
    const bookings = await this.prisma.seatBooking.findMany({
      where: { isBooked: true, eventKey: 'collabora-hub' },
    });
    const booked = new Set(
      bookings.map((b) => `${b.spaceId}:${b.seatId}`),
    );
    const normal = seats.filter((s) => !s.isOverflow);
    const overflow = seats.filter((s) => s.isOverflow);
    const occupied = (s: (typeof seats)[number]) =>
      booked.has(`${s.spaceId}:${s.label}`);
    return {
      normalCapacity: normal.length,
      normalOccupied: normal.filter(occupied).length,
      overflowCapacity: overflow.length,
      overflowOccupied: overflow.filter(occupied).length,
      isFull: normal.length > 0 && normal.every(occupied),
    };
  }

  private async recalcNbrPlaces(facilityId: string) {
    const normal = await this.prisma.seat.count({
      where: {
        isActive: true,
        isOverflow: false,
        space: { facilityId },
      },
    });
    await this.prisma.facility.update({
      where: { id: facilityId },
      data: { nbrPlaces: normal },
    });
    await this.prisma.space.updateMany({
      where: { facilityId },
      data: {},
    });
    const spaces = await this.prisma.space.findMany({
      where: { facilityId },
      include: {
        seats: { where: { isActive: true, isOverflow: false } },
      },
    });
    for (const sp of spaces) {
      await this.prisma.space.update({
        where: { id: sp.id },
        data: { capacityNormal: sp.seats.length },
      });
    }
  }
}

function fixtureDefaults(kind: FixtureKind): { width: number; height: number } {
  switch (kind) {
    case FixtureKind.TV:
      return { width: 56, height: 28 };
    case FixtureKind.DOOR:
      return { width: 40, height: 12 };
    case FixtureKind.KITCHEN:
      return { width: 64, height: 40 };
    case FixtureKind.TEXT:
      return { width: 120, height: 40 };
    case FixtureKind.ARROW:
      return { width: 48, height: 24 };
    case FixtureKind.STAIRS:
      return { width: 48, height: 48 };
    default:
      return { width: 44, height: 44 };
  }
}
