import { Injectable, NotFoundException } from '@nestjs/common';
import { BillingUnit, PriceCategory, PriceType, Prisma } from '@prisma/client';
import { PriceEntity } from './entities/price.entity';
import { PrismaService } from 'database/prisma.service';
import { CreatePriceDto } from './dtos/create-price.dto';
import { UpdatePriceDto } from './dtos/update-price.dto';
import { defaultOccupy } from '../mobile/space-occupy';

const COLLABORA_HUB_TARIFS: Array<{
  name: string;
  price: number;
  type: PriceType;
  category: PriceCategory;
  billingUnit: BillingUnit;
  durationHours?: number;
  periodDays?: number;
  timePeriod: { start: string; end: string };
}> = [
  {
    name: '2h',
    price: 2.8,
    type: PriceType.journal,
    category: PriceCategory.JOURNEE,
    billingUnit: BillingUnit.PACK,
    durationHours: 2,
    timePeriod: { start: '00:00', end: '02:00' },
  },
  {
    name: '4h',
    price: 4.5,
    type: PriceType.journal,
    category: PriceCategory.JOURNEE,
    billingUnit: BillingUnit.PACK,
    durationHours: 4,
    timePeriod: { start: '00:00', end: '04:00' },
  },
  {
    name: 'Demi-journée (6h)',
    price: 6,
    type: PriceType.journal,
    category: PriceCategory.JOURNEE,
    billingUnit: BillingUnit.PACK,
    durationHours: 6,
    timePeriod: { start: '00:00', end: '06:00' },
  },
  {
    name: 'Journée (12h)',
    price: 9,
    type: PriceType.journal,
    category: PriceCategory.JOURNEE,
    billingUnit: BillingUnit.PACK,
    durationHours: 12,
    timePeriod: { start: '00:00', end: '12:00' },
  },
  {
    name: 'Abonnement semaine (demi-journée)',
    price: 35,
    type: PriceType.abonnement,
    category: PriceCategory.ABONNEMENT,
    billingUnit: BillingUnit.PERIOD,
    durationHours: 6,
    periodDays: 7,
    timePeriod: { start: '00:00', end: '06:00' },
  },
  {
    name: 'Abonnement semaine (journée)',
    price: 45,
    type: PriceType.abonnement,
    category: PriceCategory.ABONNEMENT,
    billingUnit: BillingUnit.PERIOD,
    durationHours: 12,
    periodDays: 7,
    timePeriod: { start: '00:00', end: '12:00' },
  },
  {
    name: 'Abonnement 2 semaines (demi-journée)',
    price: 65,
    type: PriceType.abonnement,
    category: PriceCategory.ABONNEMENT,
    billingUnit: BillingUnit.PERIOD,
    durationHours: 6,
    periodDays: 14,
    timePeriod: { start: '00:00', end: '06:00' },
  },
  {
    name: 'Abonnement 2 semaines (journée)',
    price: 80,
    type: PriceType.abonnement,
    category: PriceCategory.ABONNEMENT,
    billingUnit: BillingUnit.PERIOD,
    durationHours: 12,
    periodDays: 14,
    timePeriod: { start: '00:00', end: '12:00' },
  },
  {
    name: 'Abonnement 1 mois (demi-journée)',
    price: 120,
    type: PriceType.abonnement,
    category: PriceCategory.ABONNEMENT,
    billingUnit: BillingUnit.PERIOD,
    durationHours: 6,
    periodDays: 30,
    timePeriod: { start: '00:00', end: '06:00' },
  },
  {
    name: 'Abonnement 1 mois (journée)',
    price: 150,
    type: PriceType.abonnement,
    category: PriceCategory.ABONNEMENT,
    billingUnit: BillingUnit.PERIOD,
    durationHours: 12,
    periodDays: 30,
    timePeriod: { start: '00:00', end: '12:00' },
  },
  {
    name: 'Abonnement heures (1 mois, 40h)',
    price: 90,
    type: PriceType.abonnement,
    category: PriceCategory.ABONNEMENT,
    billingUnit: BillingUnit.HOURLY,
    durationHours: 40,
    periodDays: 30,
    timePeriod: { start: '00:00', end: '40:00' },
  },
  {
    name: "Bureau à l'heure",
    price: 2,
    type: PriceType.journal,
    category: PriceCategory.JOURNEE,
    billingUnit: BillingUnit.HOURLY,
    timePeriod: { start: '00:00', end: '01:00' },
  },
  {
    name: 'Salle de réunion',
    price: 10,
    type: PriceType.journal,
    category: PriceCategory.SALLE,
    billingUnit: BillingUnit.HOURLY,
    timePeriod: { start: '00:00', end: '01:00' },
  },
  {
    name: 'Salle journée',
    price: 50,
    type: PriceType.journal,
    category: PriceCategory.SALLE,
    billingUnit: BillingUnit.PACK,
    durationHours: 12,
    timePeriod: { start: '00:00', end: '12:00' },
  },
  {
    name: 'Open space',
    price: 25,
    type: PriceType.journal,
    category: PriceCategory.OPEN_SPACE,
    billingUnit: BillingUnit.HOURLY,
    timePeriod: { start: '00:00', end: '01:00' },
  },
  {
    name: 'Open space journée',
    price: 140,
    type: PriceType.journal,
    category: PriceCategory.OPEN_SPACE,
    billingUnit: BillingUnit.PACK,
    durationHours: 12,
    timePeriod: { start: '00:00', end: '12:00' },
  },
];

@Injectable()
export class PriceService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly priceInclude = {
    space: { select: { id: true, name: true } },
    offerSpaces: { include: { space: { select: { id: true, name: true } } } },
  } as const;

  private toEntity(price: {
    id: string;
    name: string;
    price: number;
    timePeriod: Prisma.JsonValue;
    type: PriceType;
    category: PriceCategory | null;
    durationHours: number | null;
    billingUnit: BillingUnit | null;
    periodDays: number | null;
    spaceId?: string | null;
    occupySeat?: boolean;
    occupyWhole?: boolean;
    reserveSeat?: boolean;
    reserveSeatFromHour?: number | null;
    reserveSeatToHour?: number | null;
    isActive?: boolean;
    createdAt: Date;
    updatedAt: Date;
    space?: { id: string; name: string } | null;
    offerSpaces?: {
      spaceId: string;
      space: { id: string; name: string };
    }[];
  }): PriceEntity {
    const offerNames = (price.offerSpaces || []).map((o) => o.space.name);
    const offerIds = (price.offerSpaces || []).map((o) => o.spaceId);
    const spaceIds = offerIds.length
      ? offerIds
      : price.spaceId
        ? [price.spaceId]
        : [];
    const spaceNames = offerNames.length
      ? offerNames
      : price.space?.name
        ? [price.space.name]
        : [];
    return new PriceEntity({
      ...price,
      spaceId: spaceIds[0] ?? price.spaceId ?? null,
      spaceName: spaceNames[0] ?? price.space?.name ?? null,
      spaceIds,
      spaceNames,
      occupySeat: price.occupySeat !== false,
      occupyWhole: !!price.occupyWhole,
      reserveSeat: !!price.reserveSeat,
      reserveSeatFromHour: price.reserveSeatFromHour ?? null,
      reserveSeatToHour: price.reserveSeatToHour ?? null,
      isActive: price.isActive !== false,
      timePeriod: price.timePeriod as { start: string; end: string },
    });
  }

  private normalizeSpaceIds(dto: {
    spaceId?: string | null;
    spaceIds?: string[];
  }) {
    const raw = [
      ...(dto.spaceIds || []),
      ...(dto.spaceId ? [dto.spaceId] : []),
    ];
    return [...new Set(raw.map((id) => id.trim()).filter(Boolean))];
  }

  private occupyFromDto(
    category: PriceCategory | null | undefined,
    occupySeat?: boolean,
    occupyWhole?: boolean,
  ) {
    const fallback = defaultOccupy(category);
    const seat = occupySeat ?? fallback.occupySeat;
    const whole = occupyWhole ?? fallback.occupyWhole;
    if (!seat && !whole) return fallback;
    return { occupySeat: seat, occupyWhole: whole };
  }

  private async syncOfferSpaces(priceId: string, spaceIds: string[]) {
    await this.prisma.priceSpace.deleteMany({ where: { priceId } });
    if (!spaceIds.length) return;
    await this.prisma.priceSpace.createMany({
      data: spaceIds.map((spaceId) => ({ priceId, spaceId })),
    });
  }

  async create(createPriceDto: CreatePriceDto): Promise<PriceEntity> {
    const {
      name,
      price,
      timePeriod,
      type,
      category,
      durationHours,
      billingUnit,
      periodDays,
      spaceId,
      spaceIds,
      occupySeat,
      occupyWhole,
      reserveSeat,
      reserveSeatFromHour,
      reserveSeatToHour,
      isActive,
    } = createPriceDto;

    if (!name || price === undefined || !timePeriod || !type) {
      throw new Error('Missing required fields');
    }
    if (!timePeriod.start || !timePeriod.end) {
      throw new Error('Time period must have start and end times');
    }

    const linked = this.normalizeSpaceIds({ spaceId, spaceIds });
    const occupy = this.occupyFromDto(category, occupySeat, occupyWhole);

    const priceEntity = await this.prisma.price.create({
      data: {
        name,
        price,
        timePeriod: { start: timePeriod.start, end: timePeriod.end },
        type,
        category,
        durationHours,
        billingUnit,
        periodDays,
        isActive: isActive !== false,
        occupySeat: occupy.occupySeat,
        occupyWhole: occupy.occupyWhole,
        reserveSeat: !!reserveSeat,
        reserveSeatFromHour:
          reserveSeat && reserveSeatFromHour != null
            ? Number(reserveSeatFromHour)
            : null,
        reserveSeatToHour:
          reserveSeat && reserveSeatToHour != null
            ? Number(reserveSeatToHour)
            : null,
        ...(linked[0] ? { space: { connect: { id: linked[0] } } } : {}),
        ...((createPriceDto as { organizationId?: string }).organizationId
          ? {
              organization: {
                connect: {
                  id: (createPriceDto as { organizationId?: string })
                    .organizationId!,
                },
              },
            }
          : {}),
      },
      include: this.priceInclude,
    });

    await this.syncOfferSpaces(priceEntity.id, linked);
    const withOffers = await this.prisma.price.findUnique({
      where: { id: priceEntity.id },
      include: this.priceInclude,
    });
    return this.toEntity(withOffers || priceEntity);
  }

  async findAll(
    organizationId?: string,
    opts?: { activeOnly?: boolean },
  ): Promise<PriceEntity[]> {
    const prices = await this.prisma.price.findMany({
      where: {
        ...(organizationId
          ? {
              OR: [
                { organizationId },
                { organizationId: null },
              ],
            }
          : {}),
        ...(opts?.activeOnly ? { isActive: true } : {}),
      },
      orderBy: [{ category: 'asc' }, { price: 'asc' }],
      include: this.priceInclude,
    });
    return prices.map((p) => this.toEntity(p));
  }

  async findOne(id: string): Promise<PriceEntity> {
    const price = await this.prisma.price.findUnique({
      where: { id },
      include: this.priceInclude,
    });
    if (!price) {
      throw new NotFoundException(`Price with ID ${id} not found`);
    }
    return this.toEntity(price);
  }

  async update(
    id: string,
    updatePriceDto: UpdatePriceDto,
  ): Promise<PriceEntity> {
    const existingPrice = await this.prisma.price.findUnique({
      where: { id },
    });
    if (!existingPrice) {
      throw new NotFoundException(`Price with ID ${id} not found`);
    }

    const { spaceId, spaceIds, timePeriod, occupySeat, occupyWhole, ...rest } =
      updatePriceDto;
    const updateData: Prisma.PriceUpdateInput = {
      ...rest,
      ...(timePeriod && {
        timePeriod: {
          start: timePeriod.start,
          end: timePeriod.end,
        },
      }),
    };
    const linked =
      spaceIds !== undefined || spaceId !== undefined
        ? this.normalizeSpaceIds({ spaceId, spaceIds })
        : null;
    if (linked) {
      updateData.space = linked[0]
        ? { connect: { id: linked[0] } }
        : { disconnect: true };
    }
    if (occupySeat !== undefined || occupyWhole !== undefined) {
      const occupy = this.occupyFromDto(
        updatePriceDto.category ?? existingPrice.category,
        occupySeat ?? existingPrice.occupySeat,
        occupyWhole ?? existingPrice.occupyWhole,
      );
      updateData.occupySeat = occupy.occupySeat;
      updateData.occupyWhole = occupy.occupyWhole;
    }

    const updatedPrice = await this.prisma.price.update({
      where: { id },
      data: updateData,
      include: this.priceInclude,
    });
    if (linked) await this.syncOfferSpaces(id, linked);
    const withOffers = await this.prisma.price.findUnique({
      where: { id },
      include: this.priceInclude,
    });

    return this.toEntity(withOffers || updatedPrice);
  }

  async remove(id: string): Promise<void> {
    const price = await this.prisma.price.findUnique({ where: { id } });
    if (!price) {
      throw new NotFoundException(`Price with ID ${id} not found`);
    }
    await this.prisma.price.delete({ where: { id } });
  }

  /** Seed Collabora Hub catalog; skip names that already exist. */
  async seedCollaboraHub(): Promise<{
    created: number;
    skipped: number;
    prices: PriceEntity[];
  }> {
    let created = 0;
    let skipped = 0;

    for (const tarif of COLLABORA_HUB_TARIFS) {
      const existing = await this.prisma.price.findFirst({
        where: { name: tarif.name },
      });
      if (existing) {
        skipped += 1;
        continue;
      }
      await this.prisma.price.create({ data: tarif });
      created += 1;
    }

    const prices = await this.findAll();
    return { created, skipped, prices };
  }
}
