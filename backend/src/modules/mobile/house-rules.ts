import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'database/prisma.service';

export type HouseRuleKind = 'NO' | 'DO';
export type HouseRulesFrequency = 'ONCE' | 'DAILY' | 'ALWAYS';

export type HouseRule = {
  id: string;
  icon: string;
  text: string;
  kind: HouseRuleKind;
  active: boolean;
};

export type HouseRulesSettings = {
  facilityId: string;
  rules: HouseRule[];
  version: number;
  onOpen: boolean;
  beforeForfait: boolean;
  frequency: HouseRulesFrequency;
};

/** Used until the admin saves their own list. */
export const DEFAULT_HOUSE_RULES: HouseRule[] = [
  { id: 'outside-drinks', icon: '🥤', text: "Boissons de l'extérieur", kind: 'NO', active: true },
  { id: 'noise', icon: '🔊', text: 'Bruit', kind: 'NO', active: true },
  { id: 'calls', icon: '📞', text: 'Appels en open space', kind: 'NO', active: true },
  { id: 'headphones', icon: '🎧', text: 'Casque pour le son', kind: 'DO', active: true },
  { id: 'clean', icon: '🧹', text: 'Place propre', kind: 'DO', active: true },
  { id: 'checkout', icon: '👋', text: 'Terminer en partant', kind: 'DO', active: true },
];

const FREQUENCIES: HouseRulesFrequency[] = ['ONCE', 'DAILY', 'ALWAYS'];

function parseRules(raw: Prisma.JsonValue | null): HouseRule[] {
  if (!Array.isArray(raw)) return DEFAULT_HOUSE_RULES;
  return raw
    .filter((r): r is Prisma.JsonObject => !!r && typeof r === 'object' && !Array.isArray(r))
    .map((r, i) => ({
      id: String(r.id ?? `r${i}`),
      icon: String(r.icon ?? '📌'),
      text: String(r.text ?? ''),
      kind: r.kind === 'NO' ? 'NO' : 'DO',
      active: r.active !== false,
    }));
}

type FacilityRulesRow = {
  id: string;
  houseRules: Prisma.JsonValue | null;
  houseRulesVersion: number;
  houseRulesOnOpen: boolean;
  houseRulesBeforeForfait: boolean;
  houseRulesFrequency: string;
};

const RULES_SELECT = {
  id: true,
  houseRules: true,
  houseRulesVersion: true,
  houseRulesOnOpen: true,
  houseRulesBeforeForfait: true,
  houseRulesFrequency: true,
} as const;

function toSettings(f: FacilityRulesRow): HouseRulesSettings {
  return {
    facilityId: f.id,
    rules: parseRules(f.houseRules),
    version: f.houseRulesVersion,
    onOpen: f.houseRulesOnOpen,
    beforeForfait: f.houseRulesBeforeForfait,
    frequency: (FREQUENCIES as string[]).includes(f.houseRulesFrequency)
      ? (f.houseRulesFrequency as HouseRulesFrequency)
      : 'ONCE',
  };
}

async function memberFacility(prisma: PrismaService, organizationId: string) {
  return prisma.facility.findFirst({
    where: { organizationId },
    orderBy: { createdAt: 'asc' },
    select: RULES_SELECT,
  });
}

/** Visitor side: active rules + when to show them + what this member already accepted. */
export async function houseRulesForMember(prisma: PrismaService, memberId: string) {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { organizationId: true, rulesAcceptedAt: true, rulesAcceptedVersion: true },
  });
  if (!member) throw new NotFoundException('Membre introuvable');
  const f = await memberFacility(prisma, member.organizationId);
  if (!f) {
    return {
      rules: [] as HouseRule[],
      version: 1,
      onOpen: false,
      beforeForfait: false,
      frequency: 'ONCE' as HouseRulesFrequency,
      acceptedAt: null,
      acceptedVersion: null,
    };
  }
  const s = toSettings(f);
  return {
    rules: s.rules.filter((r) => r.active && r.text.trim()),
    version: s.version,
    onOpen: s.onOpen,
    beforeForfait: s.beforeForfait,
    frequency: s.frequency,
    acceptedAt: member.rulesAcceptedAt,
    acceptedVersion: member.rulesAcceptedVersion,
  };
}

export async function acceptHouseRules(
  prisma: PrismaService,
  memberId: string,
  version: number,
) {
  const v = Math.round(Number(version));
  if (!Number.isFinite(v) || v < 1) throw new BadRequestException('Version invalide');
  const m = await prisma.member.update({
    where: { id: memberId },
    data: { rulesAcceptedAt: new Date(), rulesAcceptedVersion: v },
    select: { rulesAcceptedAt: true, rulesAcceptedVersion: true },
  });
  return { acceptedAt: m.rulesAcceptedAt, acceptedVersion: m.rulesAcceptedVersion };
}

/** Admin side. */
export async function houseRulesSettings(
  prisma: PrismaService,
  facilityId: string,
): Promise<HouseRulesSettings> {
  const f = await prisma.facility.findUniqueOrThrow({
    where: { id: facilityId },
    select: RULES_SELECT,
  });
  return toSettings(f);
}

export async function updateHouseRules(
  prisma: PrismaService,
  facilityId: string,
  body: Partial<Omit<HouseRulesSettings, 'facilityId' | 'version'>>,
): Promise<HouseRulesSettings> {
  const current = await houseRulesSettings(prisma, facilityId);
  const data: Prisma.FacilityUpdateInput = {};
  if (body.rules !== undefined) {
    if (!Array.isArray(body.rules) || body.rules.length > 20) {
      throw new BadRequestException('20 règles maximum');
    }
    const rules: HouseRule[] = body.rules.map((r, i) => {
      const text = String(r?.text ?? '').trim().slice(0, 60);
      if (!text) throw new BadRequestException('Chaque règle a besoin d’un texte');
      return {
        id: String(r?.id || `r${Date.now()}${i}`).slice(0, 40),
        icon: String(r?.icon || '📌').slice(0, 8),
        text,
        kind: r?.kind === 'NO' ? 'NO' : 'DO',
        active: r?.active !== false,
      };
    });
    data.houseRules = rules as unknown as Prisma.InputJsonValue;
    // Visitors only need to read again when what they see changes.
    const seen = (list: HouseRule[]) =>
      JSON.stringify(list.filter((r) => r.active).map((r) => [r.icon, r.text, r.kind]));
    if (seen(rules) !== seen(current.rules)) {
      data.houseRulesVersion = { increment: 1 };
    }
  }
  if (body.onOpen != null) data.houseRulesOnOpen = !!body.onOpen;
  if (body.beforeForfait != null) data.houseRulesBeforeForfait = !!body.beforeForfait;
  if (body.frequency != null) {
    if (!FREQUENCIES.includes(body.frequency)) {
      throw new BadRequestException('Fréquence invalide');
    }
    data.houseRulesFrequency = body.frequency;
  }
  const f = await prisma.facility.update({
    where: { id: facilityId },
    data,
    select: RULES_SELECT,
  });
  return toSettings(f);
}

/** Who read the current rules, latest first (20 per page). */
export async function houseRulesReaders(
  prisma: PrismaService,
  facilityId: string,
  page = 1,
  filter: 'all' | 'read' | 'unread' = 'all',
) {
  const f = await prisma.facility.findUniqueOrThrow({
    where: { id: facilityId },
    select: { organizationId: true, houseRulesVersion: true },
  });
  const PAGE = 20;
  const base: Prisma.MemberWhereInput = {
    deletedAt: null,
    ...(f.organizationId ? { organizationId: f.organizationId } : {}),
  };
  const readWhere = { ...base, rulesAcceptedVersion: f.houseRulesVersion };
  const unreadWhere: Prisma.MemberWhereInput = {
    ...base,
    OR: [
      { rulesAcceptedVersion: null },
      { rulesAcceptedVersion: { not: f.houseRulesVersion } },
    ],
  };
  const where = filter === 'read' ? readWhere : filter === 'unread' ? unreadWhere : base;
  const p = Math.max(1, Math.floor(page) || 1);
  const [total, read, filtered, items] = await Promise.all([
    prisma.member.count({ where: base }),
    prisma.member.count({ where: readWhere }),
    prisma.member.count({ where }),
    prisma.member.findMany({
      where,
      orderBy: [{ rulesAcceptedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      skip: (p - 1) * PAGE,
      take: PAGE,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        rulesAcceptedAt: true,
        rulesAcceptedVersion: true,
      },
    }),
  ]);
  return {
    version: f.houseRulesVersion,
    total,
    read,
    page: p,
    pages: Math.max(1, Math.ceil(filtered / PAGE)),
    items: items.map((m) => ({
      id: m.id,
      name:
        (m.lastName && m.lastName !== m.firstName
          ? `${m.firstName ?? ''} ${m.lastName}`.trim()
          : m.firstName) ||
        m.phone ||
        'Membre',
      phone: m.phone,
      acceptedAt: m.rulesAcceptedAt,
      upToDate: m.rulesAcceptedVersion === f.houseRulesVersion,
    })),
  };
}
