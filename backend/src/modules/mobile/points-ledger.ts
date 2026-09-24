import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PointEntryStatus, PointEvent } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from 'database/prisma.service';
import { pointsToDt } from './points';

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

/** Credit points (idempotent when refId set). */
export async function creditPoints(
  prisma: PrismaService,
  input: CreditPointsInput,
): Promise<{ amount: number; points: number } | null> {
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
        status: PointEntryStatus.CREDITED,
      },
    });
    if (already) {
      return { amount: 0, points: member.points };
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

  return { amount, points: updated.points };
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
