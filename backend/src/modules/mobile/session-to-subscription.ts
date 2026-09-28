import { endOfDay, startOfDay } from 'date-fns';
import type { Price, PrismaClient } from '@prisma/client';

type Db = Pick<PrismaClient, 'journal'>;

/**
 * Member bought a subscription while a tarif session is running: the open
 * session switches to the subscription (no tarif owed, time counts on the abo).
 * Returns the switched journal id, or null when nothing was open.
 */
export async function switchOpenSessionToSubscription(
  prisma: Db,
  memberId: string,
  price: Pick<Price, 'id' | 'name' | 'price'>,
): Promise<string | null> {
  const now = new Date();
  const open = await prisma.journal.findFirst({
    where: {
      memberID: memberId,
      leaveTime: null,
      isReservation: false,
      registredTime: { gte: startOfDay(now), lt: endOfDay(now) },
    },
    orderBy: { registredTime: 'desc' },
    select: { id: true, priceId: true },
  });
  if (!open || open.priceId === price.id) return null;

  await prisma.journal.update({
    where: { id: open.id },
    data: {
      priceId: price.id,
      pricingMode: 'FIXED',
      payedAmount: 0,
      isPayed: true,
      paidAmount: 0,
      paidAt: null,
      fixedPriceId: null,
      fixedServiceName: null,
      fixedDurationHours: null,
      fixedAmount: null,
      fixedAt: null,
      lastPricingNotice: null,
      priceBeforePromo: null,
      promoDiscount: null,
      promoLabel: null,
      serviceName: price.name,
      listPrice: price.price,
    },
  });
  return open.id;
}
