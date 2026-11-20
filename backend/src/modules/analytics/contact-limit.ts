/**
 * One rule for every message sent to a client (Relances, campaigns, Finance › Clients):
 * « Ne pas contacter » blocks everything but a word at the desk, and at most one
 * message every `messageGapDays` days.
 */
import { differenceInCalendarDays, startOfDay, subDays } from 'date-fns';
import type { PrismaService } from 'database/prisma.service';
import { clientRules } from './client-segments';

/** Channels that send the client a message (counted by the limit). */
export const MESSAGE_CHANNELS = ['WHATSAPP', 'PUSH', 'INSTAGRAM'];

export async function facilityClientRules(prisma: PrismaService, facilityId?: string | null) {
  const f = facilityId
    ? await prisma.facility.findUnique({ where: { id: facilityId }, select: { clientRules: true } })
    : await prisma.facility.findFirst({ orderBy: { createdAt: 'asc' }, select: { clientRules: true } });
  return clientRules(f?.clientRules);
}

/** Why this client can't get a message on this channel now, or null. */
export async function contactBlock(
  prisma: PrismaService,
  memberId: string,
  channel: string,
  opts: { gapDays: number; reason?: string },
): Promise<string | null> {
  if (channel === 'SKIP' || channel === 'PERSON') return null;
  const member = await prisma.member.findUnique({ where: { id: memberId }, select: { doNotContact: true } });
  if (member?.doNotContact) return 'Ce client a « Ne pas contacter ».';
  // A call-back the client asked for is not a new message
  if (!MESSAGE_CHANNELS.includes(channel) || opts.reason === 'FOLLOW_UP') return null;
  const today = startOfDay(new Date());
  const last = await prisma.memberOutreach.findFirst({
    where: {
      memberId,
      channel: { in: MESSAGE_CHANNELS },
      createdAt: { gte: subDays(today, opts.gapDays - 1) },
    },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (!last) return null;
  const days = differenceInCalendarDays(today, last.createdAt);
  const when = days === 0 ? "aujourd'hui" : days === 1 ? 'hier' : `il y a ${days} jours`;
  const next = opts.gapDays - days;
  return `Déjà contacté ${when}. Limite : 1 message tous les ${opts.gapDays} jours (encore ${next} jour${next > 1 ? 's' : ''}).`;
}
