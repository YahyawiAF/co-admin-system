import { PointEntryStatus, PointEvent, ProductOrderStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from 'database/prisma.service';
import { creditPoints, earnPoints } from './points-ledger';
import { dtToPoints, pointsToDt } from './points';

/**
 * Earn when visit has leaveTime + isPayed.
 * Cash portion = payedAmount − any REDEEM_VISIT DT (no earn on points payment).
 * Idempotent per journal via refId.
 * Credits only if PWA installed; otherwise PENDING until install.
 */
export async function maybeAwardVisitPaidPoints(
  prisma: PrismaService,
  journalId: string,
) {
  const journal = await prisma.journal.findUnique({
    where: { id: journalId },
    select: {
      id: true,
      memberID: true,
      isPayed: true,
      leaveTime: true,
      isReservation: true,
      isAnonymous: true,
      payedAmount: true,
    },
  });
  if (
    !journal?.memberID ||
    !journal.isPayed ||
    !journal.leaveTime ||
    journal.isReservation ||
    journal.isAnonymous
  ) {
    return null;
  }

  const redeem = await prisma.memberPointEntry.findFirst({
    where: {
      memberId: journal.memberID,
      event: PointEvent.REDEEM_VISIT,
      refId: journal.id,
      status: PointEntryStatus.CREDITED,
      amount: { lt: 0 },
    },
  });
  const redeemedDt = redeem ? pointsToDt(Math.abs(redeem.amount)) : 0;
  const earnable = Math.max(0, Number(journal.payedAmount || 0) - redeemedDt);
  const amount = dtToPoints(earnable);
  if (amount <= 0) return null;

  const result = await earnPoints(prisma, {
    memberId: journal.memberID,
    amount,
    event: PointEvent.VISIT_PAID,
    refId: journal.id,
  });
  if (!result || result.amount <= 0) return null;
  return {
    memberId: journal.memberID,
    amount: result.amount,
    pending: result.pending,
  };
}

/**
 * When admin unmarks visit unpaid — remove VISIT_PAID credit/pending for that journal
 * so a later re-pay can award again. Clamps at 0 balance.
 */
export async function maybeRevokeVisitPaidPoints(
  prisma: PrismaService,
  journalId: string,
) {
  const journal = await prisma.journal.findUnique({
    where: { id: journalId },
    select: { id: true, memberID: true },
  });
  if (!journal?.memberID) return null;

  const credit = await prisma.memberPointEntry.findFirst({
    where: {
      memberId: journal.memberID,
      event: PointEvent.VISIT_PAID,
      refId: journal.id,
      status: {
        in: [PointEntryStatus.CREDITED, PointEntryStatus.PENDING],
      },
      amount: { gt: 0 },
    },
  });
  if (!credit) return null;

  if (credit.status === PointEntryStatus.PENDING) {
    await prisma.memberPointEntry.update({
      where: { id: credit.id },
      data: { status: PointEntryStatus.EXPIRED },
    });
    return { memberId: journal.memberID, amount: 0, points: undefined };
  }

  const member = await prisma.member.findUnique({
    where: { id: journal.memberID },
    select: { points: true },
  });
  if (!member) return null;

  const revoke = Math.min(member.points, credit.amount);
  const now = new Date();
  const [, , updated] = await prisma.$transaction([
    prisma.memberPointEntry.update({
      where: { id: credit.id },
      data: { status: PointEntryStatus.EXPIRED },
    }),
    prisma.memberPointEntry.create({
      data: {
        id: randomUUID(),
        memberId: journal.memberID,
        amount: -revoke,
        event: PointEvent.VISIT_PAID,
        status: PointEntryStatus.CREDITED,
        refId: `revoke:${journal.id}`,
        creditedAt: now,
      },
    }),
    prisma.member.update({
      where: { id: journal.memberID },
      data: { points: { decrement: revoke } },
      select: { points: true },
    }),
  ]);

  return {
    memberId: journal.memberID,
    amount: -revoke,
    points: updated.points,
  };
}

/** Earn once when admin marks café/order paid (PENDING until PWA if not installed). */
export async function maybeAwardProductPaidPoints(
  prisma: PrismaService,
  orderId: string,
) {
  const order = await prisma.dailyProduct.findUnique({
    where: { id: orderId },
    include: { product: { select: { sellingPrice: true } } },
  });
  if (!order?.isPayed) return null;
  const memberId = order.memberId || order.externalRef;
  if (!memberId) return null;
  if (order.status === ProductOrderStatus.CANCELLED) return null;

  const orderAmount =
    (order.product?.sellingPrice || 0) * (order.quantite || 0);
  const amount = dtToPoints(orderAmount);
  if (amount <= 0) return null;

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { id: true },
  });
  if (!member) return null;

  const result = await earnPoints(prisma, {
    memberId,
    amount,
    event: PointEvent.PRODUCT_PAID,
    refId: order.id,
  });
  if (!result || result.amount <= 0) return null;
  return { memberId, amount: result.amount, pending: result.pending };
}

/** Revoke PRODUCT_PAID when admin unmarks order unpaid. */
export async function maybeRevokeProductPaidPoints(
  prisma: PrismaService,
  orderId: string,
) {
  const order = await prisma.dailyProduct.findUnique({
    where: { id: orderId },
    select: { id: true, memberId: true, externalRef: true },
  });
  const memberId = order?.memberId || order?.externalRef;
  if (!order || !memberId) return null;

  const credit = await prisma.memberPointEntry.findFirst({
    where: {
      memberId,
      event: PointEvent.PRODUCT_PAID,
      refId: order.id,
      status: {
        in: [PointEntryStatus.CREDITED, PointEntryStatus.PENDING],
      },
      amount: { gt: 0 },
    },
  });
  if (!credit) return null;

  if (credit.status === PointEntryStatus.PENDING) {
    await prisma.memberPointEntry.update({
      where: { id: credit.id },
      data: { status: PointEntryStatus.EXPIRED },
    });
    return { memberId, amount: 0, points: undefined };
  }

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { points: true },
  });
  if (!member) return null;

  const revoke = Math.min(member.points, credit.amount);
  const now = new Date();
  const [, , updated] = await prisma.$transaction([
    prisma.memberPointEntry.update({
      where: { id: credit.id },
      data: { status: PointEntryStatus.EXPIRED },
    }),
    prisma.memberPointEntry.create({
      data: {
        id: randomUUID(),
        memberId,
        amount: -revoke,
        event: PointEvent.PRODUCT_PAID,
        status: PointEntryStatus.CREDITED,
        refId: `revoke:${order.id}`,
        creditedAt: now,
      },
    }),
    prisma.member.update({
      where: { id: memberId },
      data: { points: { decrement: revoke } },
      select: { points: true },
    }),
  ]);

  return { memberId, amount: -revoke, points: updated.points };
}
