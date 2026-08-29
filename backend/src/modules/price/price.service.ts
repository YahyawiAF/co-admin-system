import { Injectable, NotFoundException } from '@nestjs/common';
import { BillingUnit, PriceCategory, PriceType, Prisma } from '@prisma/client';
import { PriceEntity } from './entities/price.entity';
import { PrismaService } from 'database/prisma.service';
import { CreatePriceDto } from './dtos/create-price.dto';
import { UpdatePriceDto } from './dtos/update-price.dto';

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
    reserveSeat?: boolean;
    reserveSeatFromHour?: number | null;
    reserveSeatToHour?: number | null;
    isActive?: boolean;
    createdAt: Date;
    updatedAt: Date;
    space?: { id: string; name: string } | null;
  }): PriceEntity {
    return new PriceEntity({
      ...price,
      spaceId: price.spaceId ?? null,
      spaceName: price.space?.name ?? null,
      reserveSeat: !!price.reserveSeat,
      reserveSeatFromHour: price.reserveSeatFromHour ?? null,
      reserveSeatToHour: price.reserveSeatToHour ?? null,
      isActive: price.isActive !== false,
      timePeriod: price.timePeriod as { start: string; end: string },
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
        reserveSeat: !!reserveSeat,
        reserveSeatFromHour:
          reserveSeat && reserveSeatFromHour != null
            ? Number(reserveSeatFromHour)
            : null,
        reserveSeatToHour:
          reserveSeat && reserveSeatToHour != null
            ? Number(reserveSeatToHour)
            : null,
        ...(spaceId ? { space: { connect: { id: spaceId } } } : {}),
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
      include: { space: { select: { id: true, name: true } } },
    });

    return this.toEntity(priceEntity);
  }

  async findAll(
    organizationId?: string,
    opts?: { activeOnly?: boolean },
  ): Promise<PriceEntity[]> {
    const prices = await this.prisma.price.findMany({
      where: {
        ...(organizationId ? { organizationId } : {}),
        ...(opts?.activeOnly ? { isActive: true } : {}),
      },
      orderBy: [{ category: 'asc' }, { price: 'asc' }],
      include: { space: { select: { id: true, name: true } } },
    });
    return prices.map((p) => this.toEntity(p));
  }

  async findOne(id: string): Promise<PriceEntity> {
    const price = await this.prisma.price.findUnique({
      where: { id },
      include: { space: { select: { id: true, name: true } } },
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

    const { spaceId, timePeriod, ...rest } = updatePriceDto;
    const updateData: Prisma.PriceUpdateInput = {
      ...rest,
      ...(timePeriod && {
        timePeriod: {
          start: timePeriod.start,
          end: timePeriod.end,
        },
      }),
    };
    if (spaceId) {
      updateData.space = { connect: { id: spaceId } };
    } else if (spaceId === '' || spaceId === null) {
      updateData.space = { disconnect: true };
    }

    const updatedPrice = await this.prisma.price.update({
      where: { id },
      data: updateData,
      include: { space: { select: { id: true, name: true } } },
    });

    return this.toEntity(updatedPrice);
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
