import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PointEntryStatus, PointEvent } from '@prisma/client';
import { randomUUID } from 'crypto';
import { addDays } from 'date-fns';
import { PrismaService } from 'database/prisma.service';
import { PENDING_POINTS_TTL_DAYS, pointsToDt } from './points';

export type CreditPointsInput = {
  memberId: string;
  amount: number;
  event: PointEvent;
  refId?: string | null;
};

export type DebitPointsInput = {
  memberId: string;
  amount: number;
  event: PointEvent;
  refId?: string | null;
};

/** Credit points (idempotent when refId set). Always increments balance. */
export async function creditPoints(
  prisma: PrismaService,
  input: CreditPointsInput,
): Promise<{ amount: number; points: number; pending?: boolean } | null> {
  const amount = Math.floor(input.amount);
  if (amount <= 0) return null;

  const member = await prisma.member.findUnique({
    where: { id: input.memberId },
    select: { id: true, points: true },
  });
  if (!member) throw new NotFoundException('Membre introuvable');

  if (input.refId) {
    const already = await prisma.memberPointEntry.findFirst({
      where: {
        memberId: input.memberId,
        event: input.event,
        refId: input.refId,
        status: {
          in: [PointEntryStatus.CREDITED, PointEntryStatus.PENDING],
        },
      },
    });
    if (already) {
      return {
        amount: 0,
        points: member.points,
        pending: already.status === PointEntryStatus.PENDING,
      };
    }
  }

  const now = new Date();
  const [, updated] = await prisma.$transaction([
    prisma.memberPointEntry.create({
      data: {
        id: randomUUID(),
        memberId: input.memberId,
        amount,
        event: input.event,
        status: PointEntryStatus.CREDITED,
        refId: input.refId || null,
        creditedAt: now,
      },
    }),
    prisma.member.update({
      where: { id: input.memberId },
      data: { points: { increment: amount } },
      select: { points: true },
    }),
  ]);

  return { amount, points: updated.points, pending: false };
}

/**
 * Earn points only when the member has installed the PWA.
 * Otherwise store PENDING (no balance bump) until they open the installed app.
 */
export async function earnPoints(
  prisma: PrismaService,
  input: CreditPointsInput,
): Promise<{ amount: number; points: number; pending: boolean } | null> {
  const amount = Math.floor(input.amount);
  if (amount <= 0) return null;

  const member = await prisma.member.findUnique({
    where: { id: input.memberId },
    select: { id: true, points: true, pwaInstalledAt: true },
  });
  if (!member) throw new NotFoundException('Membre introuvable');

  if (input.refId) {
    const already = await prisma.memberPointEntry.findFirst({
      where: {
        memberId: input.memberId,
        event: input.event,
        refId: input.refId,
        status: {
          in: [PointEntryStatus.CREDITED, PointEntryStatus.PENDING],
        },
      },
    });
    if (already) {
      return {
        amount: 0,
        points: member.points,
        pending: already.status === PointEntryStatus.PENDING,
      };
    }
  }

  if (member.pwaInstalledAt) {
    const credited = await creditPoints(prisma, input);
    if (!credited) return null;
    return { ...credited, pending: false };
  }

  const now = new Date();
  const expiresAt = addDays(now, PENDING_POINTS_TTL_DAYS);
  await prisma.memberPointEntry.create({
    data: {
      id: randomUUID(),
      memberId: input.memberId,
      amount,
      event: input.event,
      status: PointEntryStatus.PENDING,
      refId: input.refId || null,
      expiresAt,
    },
  });

  return { amount, points: member.points, pending: true };
}

/** Debit points (stores negative ledger amount). */
export async function debitPoints(
  prisma: PrismaService,
  input: DebitPointsInput,
): Promise<{ amount: number; points: number; dtValue: number }> {
  const amount = Math.floor(input.amount);
  if (amount <= 0) {
    throw new BadRequestException('Nombre de points invalide');
  }

  const member = await prisma.member.findUnique({
    where: { id: input.memberId },
    select: { id: true, points: true },
  });
  if (!member) throw new NotFoundException('Membre introuvable');
  if (member.points < amount) {
    throw new BadRequestException(
      `Solde insuffisant (${member.points} pts, besoin de ${amount})`,
    );
  }

  if (input.refId) {
    const already = await prisma.memberPointEntry.findFirst({
      where: {
        memberId: input.memberId,
        event: input.event,
        refId: input.refId,
        status: PointEntryStatus.CREDITED,
        amount: { lt: 0 },
      },
    });
    if (already) {
      throw new BadRequestException('Points déjà utilisés pour cette opération');
    }
  }

  const now = new Date();
  const [, updated] = await prisma.$transaction([
    prisma.memberPointEntry.create({
      data: {
        id: randomUUID(),
        memberId: input.memberId,
        amount: -amount,
        event: input.event,
        status: PointEntryStatus.CREDITED,
        refId: input.refId || null,
        creditedAt: now,
      },
    }),
    prisma.member.update({
      where: { id: input.memberId },
      data: { points: { decrement: amount } },
      select: { points: true },
    }),
  ]);

  return {
    amount,
    points: updated.points,
    dtValue: pointsToDt(amount),
  };
}
