import { parsePhoneNumberFromString } from 'libphonenumber-js';
import type { PrismaService } from 'database/prisma.service';

/** Tunisian number in E.164 (+216…), or null when it is not a valid TN number. */
export function parseTunisiaPhoneOrNull(
  raw: string | null | undefined,
): string | null {
  const input = (raw || '').trim();
  if (!input) return null;
  const parsed =
    parsePhoneNumberFromString(input, 'TN') ||
    parsePhoneNumberFromString(input);
  if (!parsed || parsed.country !== 'TN' || !parsed.isValid()) return null;
  return parsed.number;
}

/** Ways the same number may have been stored (+216…, 216…, 8 digits, 0…). */
export function phoneLookupVariants(phone: string): string[] {
  const digits = phone.replace(/\D/g, '');
  const national = digits.replace(/^216/, '');
  return Array.from(
    new Set(
      [phone, `+${digits}`, digits, national, `0${national}`].filter(Boolean),
    ),
  );
}

export function findMemberByPhone(
  prisma: PrismaService,
  phone: string,
  organizationId: string,
) {
  return prisma.member.findFirst({
    where: { organizationId, phone: { in: phoneLookupVariants(phone) } },
  });
}

export async function nextVisitorNumber(
  prisma: PrismaService,
  organizationId: string,
): Promise<number> {
  const last = await prisma.member.findFirst({
    where: { organizationId, visitorNumber: { not: null } },
    orderBy: { visitorNumber: 'desc' },
    select: { visitorNumber: true },
  });
  return (last?.visitorNumber || 0) + 1;
}
