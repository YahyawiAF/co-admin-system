import { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

/** Abonnement money collected in [start, end] (advances and remainders each on their own day). */
export function abonnementPaymentsInRange(
  start: Date,
  end: Date,
): Prisma.AbonnementPaymentWhereInput {
  return { paidAt: { gte: start, lte: end } };
}

/**
 * Keeps the payment log in step with `payedAmount`: new money is dated `at`,
 * a lowered amount (correction) trims the most recent payments first.
 */
export async function syncAbonnementPayments(
  db: Db,
  abonnementId: string,
  before: number,
  after: number,
  at: Date = new Date(),
) {
  const delta = Math.round(((after || 0) - (before || 0)) * 100) / 100;
  if (delta > 0.009) {
    await db.abonnementPayment.create({
      data: { abonnementId, amount: delta, paidAt: at },
    });
    return;
  }
  if (delta >= -0.009) return;
  let toRemove = -delta;
  const payments = await db.abonnementPayment.findMany({
    where: { abonnementId },
    orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
  });
  for (const p of payments) {
    if (toRemove <= 0.009) break;
    if (p.amount <= toRemove + 0.009) {
      await db.abonnementPayment.delete({ where: { id: p.id } });
      toRemove -= p.amount;
    } else {
      await db.abonnementPayment.update({
        where: { id: p.id },
        data: { amount: Math.round((p.amount - toRemove) * 100) / 100 },
      });
      toRemove = 0;
    }
  }
}
