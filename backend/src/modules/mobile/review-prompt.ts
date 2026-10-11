import { NotFoundException } from '@nestjs/common';
import { subDays } from 'date-fns';
import { PrismaService } from 'database/prisma.service';

/** After "Plus tard", the card comes back after this many days. */
const DISMISS_DAYS = 30;

export async function paidVisitCount(prisma: PrismaService, memberId: string) {
  return prisma.journal.count({
    where: { memberID: memberId, isPayed: true, isReservation: false },
  });
}

/** Google review card for regulars: shown once they reach the facility's visit threshold. */
export async function reviewPrompt(prisma: PrismaService, memberId: string) {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      organizationId: true,
      reviewClickedAt: true,
      reviewPromptedAt: true,
    },
  });
  if (!member) throw new NotFoundException('Membre introuvable');
  const none = { show: false as const, url: null, visits: 0 };
  if (member.reviewClickedAt) return none;
  if (member.reviewPromptedAt && member.reviewPromptedAt > subDays(new Date(), DISMISS_DAYS)) {
    return none;
  }
  const facility = await prisma.facility.findFirst({
    where: { organizationId: member.organizationId, googleReviewUrl: { not: null } },
    orderBy: { createdAt: 'asc' },
    select: { googleReviewUrl: true, reviewAfterVisits: true },
  });
  if (!facility?.googleReviewUrl) return none;
  const visits = await paidVisitCount(prisma, memberId);
  if (visits < facility.reviewAfterVisits) return none;
  return { show: true as const, url: facility.googleReviewUrl, visits };
}

export async function markReview(
  prisma: PrismaService,
  memberId: string,
  action: 'click' | 'dismiss',
) {
  await prisma.member.update({
    where: { id: memberId },
    data:
      action === 'click'
        ? { reviewClickedAt: new Date() }
        : { reviewPromptedAt: new Date() },
    select: { id: true },
  });
  return { ok: true };
}
