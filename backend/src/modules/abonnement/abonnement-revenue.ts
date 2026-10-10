import { Prisma } from '@prisma/client';

/** Paid abonnements whose money was collected in [start, end] (falls back to start date for legacy rows). */
export function abonnementPaidInRange(
  start: Date,
  end: Date,
): Prisma.AbonnementWhereInput {
  return {
    isPayed: true,
    OR: [
      { paidAt: { gte: start, lte: end } },
      { paidAt: null, registredDate: { gte: start, lte: end } },
    ],
  };
}

export function abonnementRevenueDate(a: {
  paidAt?: Date | null;
  registredDate: Date;
}): Date {
  return a.paidAt ?? a.registredDate;
}
