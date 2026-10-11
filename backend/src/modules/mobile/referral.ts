import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PointEvent } from '@prisma/client';
import { randomInt } from 'crypto';
import { PrismaService } from 'database/prisma.service';
import { creditPoints } from './points-ledger';

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
/** A friend can only be attached to a sponsor shortly after joining. */
const CLAIM_WINDOW_DAYS = 30;

function codePrefix(firstName: string | null) {
  const letters = (firstName || '')
    .normalize('NFD')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase()
    .slice(0, 4);
  return letters || 'AMI';
}

function randomSuffix(len = 4) {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return out;
}

async function facilityReferralPoints(prisma: PrismaService, organizationId: string) {
  const facility = await prisma.facility.findFirst({
    where: { organizationId },
    orderBy: { createdAt: 'asc' },
    select: { referralPoints: true },
  });
  return Math.max(0, facility?.referralPoints ?? 300);
}

export async function ensureReferralCode(prisma: PrismaService, memberId: string) {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { id: true, firstName: true, referralCode: true },
  });
  if (!member) throw new NotFoundException('Membre introuvable');
  if (member.referralCode) return member.referralCode;

  const prefix = codePrefix(member.firstName);
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = `${prefix}${randomSuffix(attempt < 3 ? 4 : 6)}`;
    const taken = await prisma.member.findUnique({
      where: { referralCode: code },
      select: { id: true },
    });
    if (taken) continue;
    const updated = await prisma.member.updateMany({
      where: { id: memberId, referralCode: null },
      data: { referralCode: code },
    });
    if (updated.count) return code;
    const fresh = await prisma.member.findUnique({
      where: { id: memberId },
      select: { referralCode: true },
    });
    if (fresh?.referralCode) return fresh.referralCode;
  }
  throw new BadRequestException('Impossible de générer un code, réessayez');
}

export async function referralSummary(prisma: PrismaService, memberId: string) {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { id: true, organizationId: true, referredById: true },
  });
  if (!member) throw new NotFoundException('Membre introuvable');
  const code = await ensureReferralCode(prisma, memberId);
  const [invited, rewarded, pointsEach] = await Promise.all([
    prisma.member.count({ where: { referredById: memberId } }),
    prisma.member.count({
      where: { referredById: memberId, referralRewardedAt: { not: null } },
    }),
    facilityReferralPoints(prisma, member.organizationId),
  ]);
  return {
    code,
    invited,
    rewarded,
    pointsEach,
    referred: !!member.referredById,
  };
}

/** Attach a new member to the sponsor who owns `code`. */
export async function claimReferral(
  prisma: PrismaService,
  memberId: string,
  rawCode: string,
) {
  const code = (rawCode || '').trim().toUpperCase();
  if (!code) throw new BadRequestException('Code manquant');
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      organizationId: true,
      referredById: true,
      referralCode: true,
      createdAt: true,
    },
  });
  if (!member) throw new NotFoundException('Membre introuvable');
  if (member.referredById) return { ok: true, already: true };

  const sponsor = await prisma.member.findUnique({
    where: { referralCode: code },
    select: { id: true, organizationId: true, firstName: true },
  });
  if (!sponsor || sponsor.organizationId !== member.organizationId) {
    throw new BadRequestException('Code de parrainage inconnu');
  }
  if (sponsor.id === member.id) {
    throw new BadRequestException('Vous ne pouvez pas vous parrainer vous-même');
  }
  const ageDays = (Date.now() - member.createdAt.getTime()) / 86_400_000;
  if (ageDays > CLAIM_WINDOW_DAYS) {
    throw new BadRequestException('Le parrainage est réservé aux nouveaux clients');
  }
  const paidVisits = await prisma.journal.count({
    where: { memberID: member.id, isPayed: true, isReservation: false },
  });
  if (paidVisits > 0) {
    throw new BadRequestException('Le parrainage est réservé aux nouveaux clients');
  }

  await prisma.member.updateMany({
    where: { id: member.id, referredById: null },
    data: { referredById: sponsor.id },
  });
  return { ok: true, already: false, sponsorFirstName: sponsor.firstName };
}

/**
 * First paid visit of a referred member → both sides get the facility's
 * referral points. Runs once (guarded by referralRewardedAt).
 */
export async function maybeAwardReferral(prisma: PrismaService, memberId: string) {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      organizationId: true,
      referredById: true,
      referralRewardedAt: true,
    },
  });
  if (!member?.referredById || member.referralRewardedAt) return null;
  const points = await facilityReferralPoints(prisma, member.organizationId);
  if (points <= 0) return null;

  const locked = await prisma.member.updateMany({
    where: { id: member.id, referralRewardedAt: null },
    data: { referralRewardedAt: new Date() },
  });
  if (!locked.count) return null;

  const sponsorId = member.referredById;
  const sponsorExists = await prisma.member.findUnique({
    where: { id: sponsorId },
    select: { id: true },
  });
  await creditPoints(prisma, {
    memberId: member.id,
    amount: points,
    event: PointEvent.REFERRAL,
    refId: `referral-friend:${member.id}`,
  });
  if (sponsorExists) {
    await creditPoints(prisma, {
      memberId: sponsorId,
      amount: points,
      event: PointEvent.REFERRAL,
      refId: `referral:${member.id}`,
    });
  }
  return { memberId: member.id, sponsorId, points };
}
