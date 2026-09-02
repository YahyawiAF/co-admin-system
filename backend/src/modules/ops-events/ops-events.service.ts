import { Injectable } from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';
import { Prisma } from '@prisma/client';
import { addDays, startOfDay } from 'date-fns';

export type SeatStayDto = {
  seatId: string;
  spaceId: string | null;
  spaceName: string | null;
  memberId: string | null;
  memberName: string;
  journalId: string | null;
  from: string;
  to: string | null;
};

export type LastSeatDto = {
  seatId: string;
  spaceId: string | null;
  spaceName: string | null;
};

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

  /** Today's seat stays + last seat used per journal/member (for journal + occupancy). */
  async seatHistory(date?: string) {
    const day = startOfDay(
      date ? new Date(`${date}T12:00:00`) : new Date(),
    );
    const next = addDays(day, 1);
    const events = await this.prisma.opsEvent.findMany({
      where: {
        type: { in: ['seat.assigned', 'seat.moved', 'seat.released'] },
        occurredAt: { gte: day, lt: next },
      },
      orderBy: { occurredAt: 'asc' },
    });
    const memberIds = [
      ...new Set(events.map((e) => e.memberId).filter(Boolean) as string[]),
    ];
    const members = memberIds.length
      ? await this.prisma.member.findMany({
          where: { id: { in: memberIds } },
          select: {
            id: true,
            firstName: true,
            visitorNumber: true,
          },
        })
      : [];
    const nameById = new Map(
      members.map((m) => [
        m.id,
        m.visitorNumber
          ? `${m.firstName || 'Visiteur'} #${m.visitorNumber}`
          : m.firstName || 'Visiteur',
      ]),
    );

    type Open = {
      seatId: string;
      spaceId: string | null;
      spaceName: string | null;
      memberId: string | null;
      journalId: string | null;
      from: Date;
    };
    const openByMember = new Map<string, Open>();
    const stays: SeatStayDto[] = [];

    const metaOf = (raw: Prisma.JsonValue | null) =>
      (raw && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {}) as {
        spaceId?: string;
        spaceName?: string | null;
        fromSeat?: string;
        fromSpaceId?: string;
        toSeat?: string;
      };

    const closeStay = (
      memberKey: string,
      seatId: string | undefined,
      at: Date,
    ) => {
      const open = openByMember.get(memberKey);
      if (!open) return;
      if (seatId && open.seatId !== seatId) return;
      stays.push({
        seatId: open.seatId,
        spaceId: open.spaceId,
        spaceName: open.spaceName,
        memberId: open.memberId,
        memberName: open.memberId
          ? nameById.get(open.memberId) || 'Visiteur'
          : 'Visiteur',
        journalId: open.journalId,
        from: open.from.toISOString(),
        to: at.toISOString(),
      });
      openByMember.delete(memberKey);
    };

    const startStay = (open: Open) => {
      const key = open.memberId || `anon:${open.seatId}`;
      const prev = openByMember.get(key);
      if (prev) {
        stays.push({
          seatId: prev.seatId,
          spaceId: prev.spaceId,
          spaceName: prev.spaceName,
          memberId: prev.memberId,
          memberName: prev.memberId
            ? nameById.get(prev.memberId) || 'Visiteur'
            : 'Visiteur',
          journalId: prev.journalId,
          from: prev.from.toISOString(),
          to: open.from.toISOString(),
        });
      }
      openByMember.set(key, open);
    };

    for (const ev of events) {
      const meta = metaOf(ev.meta);
      const memberKey = ev.memberId || `anon:${ev.seatId}`;
      if (ev.type === 'seat.assigned' && ev.seatId) {
        startStay({
          seatId: ev.seatId,
          spaceId: meta.spaceId || null,
          spaceName: meta.spaceName || null,
          memberId: ev.memberId,
          journalId: ev.journalId,
          from: ev.occurredAt,
        });
      } else if (ev.type === 'seat.moved' && ev.seatId) {
        closeStay(memberKey, meta.fromSeat, ev.occurredAt);
        startStay({
          seatId: ev.seatId,
          spaceId: meta.spaceId || null,
          spaceName: meta.spaceName || null,
          memberId: ev.memberId,
          journalId: ev.journalId,
          from: ev.occurredAt,
        });
      } else if (ev.type === 'seat.released' && ev.seatId) {
        closeStay(memberKey, ev.seatId, ev.occurredAt);
      }
    }

    for (const open of openByMember.values()) {
      stays.push({
        seatId: open.seatId,
        spaceId: open.spaceId,
        spaceName: open.spaceName,
        memberId: open.memberId,
        memberName: open.memberId
          ? nameById.get(open.memberId) || 'Visiteur'
          : 'Visiteur',
        journalId: open.journalId,
        from: open.from.toISOString(),
        to: null,
      });
    }

    const lastByJournalId: Record<string, LastSeatDto> = {};
    const lastByMemberId: Record<string, LastSeatDto> = {};
    for (const ev of [...events].reverse()) {
      const meta = metaOf(ev.meta);
      const payload: LastSeatDto = {
        seatId: ev.seatId || '',
        spaceId: meta.spaceId || null,
        spaceName: meta.spaceName || null,
      };
      if (!payload.seatId) continue;
      if (ev.journalId && !lastByJournalId[ev.journalId]) {
        lastByJournalId[ev.journalId] = payload;
      }
      if (ev.memberId && !lastByMemberId[ev.memberId]) {
        lastByMemberId[ev.memberId] = payload;
      }
    }

    return { lastByJournalId, lastByMemberId, stays };
  }
}
