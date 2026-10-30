import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MemberProfileType, PriceCategory, PromoValueKind } from '@prisma/client';
import { PrismaService } from 'database/prisma.service';
import { localDayKey } from '../../../common/parse-local-day';
import { PromotionService } from '../promotion/promotion.service';
import { appPromoUsage, GLOBAL_APP_PROMO_KEY } from './app-install-promo-usage';

export const HEARD_FROM = ['INSTAGRAM', 'FRIEND', 'SCHOOL', 'WALK_BY', 'OTHER'] as const;
const PROFILE_TYPES = Object.values(MemberProfileType) as string[];

const CATEGORY_LABEL: Record<string, string> = {
  JOURNEE: 'forfaits / journée',
  OPEN_SPACE: 'open space',
  SALLE: 'salles',
  ABONNEMENT: 'abonnements',
};

type DiscountFields = {
  discountForfait: number | null;
  discountOpenSpace: number | null;
  discountSalle: number | null;
  discountAbonnement: number | null;
};

/** % per category, grouped by value: [{ value: 20, where: 'open space et abonnements' }] */
function discountGroups(d: DiscountFields | null | undefined) {
  if (!d) return [];
  const byValue = new Map<number, string[]>();
  const pairs: [number | null, string][] = [
    [d.discountForfait, CATEGORY_LABEL.JOURNEE],
    [d.discountOpenSpace, CATEGORY_LABEL.OPEN_SPACE],
    [d.discountSalle, CATEGORY_LABEL.SALLE],
    [d.discountAbonnement, CATEGORY_LABEL.ABONNEMENT],
  ];
  for (const [v, label] of pairs) {
    if (v && v > 0) byValue.set(v, [...(byValue.get(v) ?? []), label]);
  }
  return [...byValue.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([value, labels]) => ({
      value,
      where:
        labels.length > 1
          ? `${labels.slice(0, -1).join(', ')} et ${labels[labels.length - 1]}`
          : labels[0],
    }));
}

function valueLabel(kind: PromoValueKind | null | undefined, value: number) {
  const v = String(value).replace('.', ',');
  return kind === PromoValueKind.PERCENT ? `−${v} %` : `−${v} DT`;
}

export type MemberOffer = {
  id: string;
  kind: 'PERSONAL' | 'GROUP' | 'APP' | 'PROMO';
  label: string;
  title: string;
  detail: string;
  /** Promotions only: schedule fields so the app can say when */
  daysOfWeek?: number[];
  fromHour?: number | null;
  toHour?: number | null;
  endsAt?: Date | null;
  /** Welcome offer: only on the first visit day */
  firstVisitOnly?: boolean;
  status: 'ACTIVE' | 'LIVE' | 'LATER' | 'TO_USE' | 'NEEDS_APP' | 'USED';
  style: 'VIOLET' | 'GOLD' | 'GREEN';
};

/**
 * First-visit questions (profile, then source at the 2nd visit) and the member's
 * offers for the app (« Mes offres »).
 */
@Injectable()
export class MemberOnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly promotions: PromotionService,
  ) {}

  private async member(memberId: string) {
    const m = await this.prisma.member.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        organizationId: true,
        profileType: true,
        heardFrom: true,
        heardFromAskedAt: true,
        pwaInstalledAt: true,
        appInstallPromoClaimedAt: true,
        appInstallPromosUsed: true,
        discountForfait: true,
        discountOpenSpace: true,
        discountSalle: true,
        discountAbonnement: true,
        group: {
          select: {
            name: true,
            discountForfait: true,
            discountOpenSpace: true,
            discountSalle: true,
            discountAbonnement: true,
          },
        },
      },
    });
    if (!m) throw new NotFoundException('Membre introuvable');
    return m;
  }

  /** What to ask after check-in: profile when missing, source from the 2nd visit day (once). */
  async status(memberId: string, now = new Date()) {
    const m = await this.member(memberId);
    const visits = await this.prisma.journal.findMany({
      where: { memberID: memberId, isReservation: false, registredTime: { lte: now } },
      select: { registredTime: true },
    });
    const days = new Set(visits.map((v) => localDayKey(v.registredTime)));
    const today = localDayKey(now);
    const firstVisit = days.size === 0 || (days.size === 1 && days.has(today));
    return {
      firstVisit,
      visitDays: days.size,
      hasApp: !!m.pwaInstalledAt,
      askProfile: !m.profileType,
      askSource: !m.heardFrom && !m.heardFromAskedAt && days.size >= 2,
      profileType: m.profileType,
    };
  }

  async save(body: {
    memberId?: string;
    profileType?: string | null;
    heardFrom?: string | null;
    skipSource?: boolean;
  }) {
    if (!body.memberId) throw new BadRequestException('memberId requis');
    const now = new Date();
    const data: {
      profileType?: MemberProfileType;
      profileTypeAt?: Date;
      heardFrom?: string;
      heardFromAskedAt?: Date;
    } = {};
    if (body.profileType) {
      if (!PROFILE_TYPES.includes(body.profileType)) throw new BadRequestException('Profil invalide');
      data.profileType = body.profileType as MemberProfileType;
      data.profileTypeAt = now;
    }
    if (body.heardFrom) {
      if (!HEARD_FROM.includes(body.heardFrom as (typeof HEARD_FROM)[number])) {
        throw new BadRequestException('Réponse invalide');
      }
      data.heardFrom = body.heardFrom;
      data.heardFromAskedAt = now;
    } else if (body.skipSource) {
      data.heardFromAskedAt = now;
    }
    if (!Object.keys(data).length) return this.status(body.memberId, now);
    await this.prisma.member.update({ where: { id: body.memberId }, data });
    return this.status(body.memberId, now);
  }

  /** Everything the member can get: personal %, group %, app gift, promotions. */
  async offers(orgSlug: string, memberId: string): Promise<MemberOffer[]> {
    const m = await this.member(memberId);
    const out: MemberOffer[] = [];

    for (const g of discountGroups(m)) {
      out.push({
        id: `personal-${g.value}`,
        kind: 'PERSONAL',
        label: `−${g.value} %`,
        title: 'Ta remise perso',
        detail: `Sur ${g.where} · toujours`,
        status: 'ACTIVE',
        style: 'VIOLET',
      });
    }
    if (m.group) {
      for (const g of discountGroups(m.group)) {
        out.push({
          id: `group-${g.value}`,
          kind: 'GROUP',
          label: `−${g.value} %`,
          title: `Groupe ${m.group.name}`,
          detail: `Sur ${g.where} · toujours`,
          status: 'ACTIVE',
          style: 'VIOLET',
        });
      }
    }

    const facility = await this.prisma.facility.findFirst({
      where: { organizationId: m.organizationId },
      orderBy: { createdAt: 'asc' },
      select: {
        appInstallGlobalPromoActive: true,
        appInstallGlobalPromoKind: true,
        appInstallGlobalPromoValue: true,
        appInstallGlobalPromoScopes: true,
        appInstallPromos: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, valueKind: true, value: true, price: { select: { name: true } } },
        },
      },
    });
    const usage = appPromoUsage(m);
    const appStatus = (key: string): MemberOffer['status'] =>
      usage.isUsed(key) ? 'USED' : m.pwaInstalledAt ? 'TO_USE' : 'NEEDS_APP';
    if (
      facility?.appInstallGlobalPromoActive &&
      facility.appInstallGlobalPromoValue &&
      facility.appInstallGlobalPromoValue > 0
    ) {
      const scopes = facility.appInstallGlobalPromoScopes as PriceCategory[];
      out.push({
        id: 'app-global',
        kind: 'APP',
        label: valueLabel(facility.appInstallGlobalPromoKind, facility.appInstallGlobalPromoValue),
        title: 'Cadeau app',
        detail: `1 fois · ${scopes.length ? `sur ${scopes.map((s) => CATEGORY_LABEL[s] ?? s).join(', ')}` : 'sur ton prochain pack'}`,
        status: appStatus(GLOBAL_APP_PROMO_KEY),
        style: 'GREEN',
      });
    }
    for (const p of facility?.appInstallPromos ?? []) {
      out.push({
        id: `app-${p.id}`,
        kind: 'APP',
        label: valueLabel(p.valueKind, p.value),
        title: 'Cadeau app',
        detail: `1 fois · ${p.price.name}`,
        status: appStatus(p.id),
        style: 'GREEN',
      });
    }

    const promos = await this.promotions.offersForMember(orgSlug, memberId);
    for (const p of promos) {
      out.push({
        id: p.id,
        kind: 'PROMO',
        label: p.label,
        title: p.title,
        detail: p.itemName ? p.itemName : p.description || '',
        daysOfWeek: p.daysOfWeek,
        fromHour: p.fromHour,
        toHour: p.toHour,
        endsAt: p.endsAt,
        firstVisitOnly: p.audience === 'FIRST_VISIT',
        status: p.usedUp ? 'USED' : p.needsApp ? 'NEEDS_APP' : p.liveNow ? 'LIVE' : 'LATER',
        style: p.style === 'GREEN' ? 'GREEN' : p.style === 'VIOLET' ? 'VIOLET' : 'GOLD',
      });
    }

    const rank: Record<MemberOffer['status'], number> = {
      LIVE: 0,
      TO_USE: 1,
      ACTIVE: 2,
      NEEDS_APP: 3,
      LATER: 4,
      USED: 5,
    };
    return out.sort((a, b) => rank[a.status] - rank[b.status]);
  }
}
