import { Injectable } from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class OpsEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: {
    type: string;
    memberId?: string | null;
    seatId?: string | null;
    journalId?: string | null;
    amount?: number | null;
    meta?: Prisma.InputJsonValue;
    occurredAt?: Date;
  }) {
    return this.prisma.opsEvent.create({
      data: {
        type: input.type,
        memberId: input.memberId ?? undefined,
        seatId: input.seatId ?? undefined,
        journalId: input.journalId ?? undefined,
        amount: input.amount ?? undefined,
        meta: input.meta ?? undefined,
        occurredAt: input.occurredAt ?? new Date(),
      },
    });
  }

  async list(params: { from?: string; to?: string; type?: string }) {
    const where: Prisma.OpsEventWhereInput = {};
    if (params.type) where.type = params.type;
    if (params.from || params.to) {
      where.occurredAt = {};
      if (params.from) where.occurredAt.gte = new Date(params.from);
      if (params.to) where.occurredAt.lte = new Date(params.to);
    }
    return this.prisma.opsEvent.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      take: 500,
    });
  }
}
