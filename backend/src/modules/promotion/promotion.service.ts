import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PriceCategory, Prisma, PromoValueKind, PromotionVoucherStatus } from '@prisma/client';
import { PrismaService } from 'database/prisma.service';
import { round1 } from '../analytics/traffic';
import { priceCategoriesFor } from '../mobile/space-occupy';

export const PROMOTION_TARGETS = ['PRODUCT', 'PRICE', 'BUNDLE', 'OTHER'] as const;
const PRICE_CATEGORIES = Object.values(PriceCategory) as string[];
export const PROMOTION_AUDIENCES = ['ALL', 'IN_SESSION'] as const;
export const PROMOTION_STYLES = ['GOLD', 'VIOLET', 'GREEN'] as const;

type PromotionBody = {
  title?: string;
  description?: string | null;
  target?: string;
  productId?: string | null;
  priceId?: string | null;
  priceCategory?: string | null;
  valueKind?: string;
  value?: number;
  startsAt?: string;
  endsAt?: string | null;
  daysOfWeek?: number[];
  fromHour?: number | null;
  toHour?: number | null;
  audience?: string;
  maxUsesPerMember?: number | null;
  maxUses?: number | null;
  style?: string;
  isActive?: boolean;
};

type PromotionRow = Prisma.PromotionGetPayload<{
  include: {
    product: { select: { id: true; name: true; sellingPrice: true; img: true } };
    price: { select: { id: true; name: true; price: true } };
  };
}>;

const INCLUDE = {
  product: { select: { id: true, name: true, sellingPrice: true, img: true } },
  price: { select: { id: true, name: true, price: true } },
} as const;

export function applyDiscount(original: number, kind: PromoValueKind, value: number) {
  if (!(original > 0) || !(value > 0)) return original;
  const next = kind === PromoValueKind.PERCENT ? original * (1 - value / 100) : original - value;
  return Math.max(0, Math.round(next * 1000) / 1000);
}

export function promotionLabel(p: { valueKind: PromoValueKind; value: number }) {
  return p.valueKind === PromoValueKind.PERCENT ? `−${p.value} %` : `−${p.value} DT`;
}

/** Is the offer live at `at` (dates, weekdays, happy hour)? */
export function isLiveAt(
  p: Pick<PromotionRow, 'isActive' | 'startsAt' | 'endsAt' | 'daysOfWeek' | 'fromHour' | 'toHour'>,
  at: Date,
) {
  if (!p.isActive || p.startsAt > at || (p.endsAt && p.endsAt < at)) return false;
  if (p.daysOfWeek.length && !p.daysOfWeek.includes(at.getDay())) return false;
  if (p.fromHour != null && p.toHour != null) {
    const h = at.getHours() + at.getMinutes() / 60;
    if (p.fromHour <= p.toHour ? h < p.fromHour || h >= p.toHour : h < p.fromHour && h >= p.toHour) {
      return false;
    }
  }
  return true;
}

type CoverPrice = {
  id: string;
  category: PriceCategory | null;
  categories: PriceCategory[];
  type: string | null;
};

/** Tarif promo (PRICE / BUNDLE) rows that cover this tarif: linked to it or to one of its categories. */
function priceMatchWhere(price: {
  id: string;
  category?: PriceCategory | null;
  categories?: PriceCategory[] | null;
  type?: string | null;
}): Prisma.PromotionWhereInput {
  return {
    OR: [{ priceId: price.id }, { priceId: null, priceCategory: { in: priceCategoriesFor(price) } }],
  };
}

/** End of the current happy-hour window or of the offer, whichever comes first (for countdowns). */
function liveUntil(p: PromotionRow, at: Date) {
  let end: Date | null = p.endsAt;
  if (p.fromHour != null && p.toHour != null) {
    const d = new Date(at);
    d.setHours(p.toHour % 24, 0, 0, 0);
    if (d <= at) d.setDate(d.getDate() + 1);
    if (!end || d < end) end = d;
  }
  return end;
}

@Injectable()
export class PromotionService {
  constructor(private readonly prisma: PrismaService) {}

  private async facilityId(facilityId?: string) {
    if (facilityId) return facilityId;
    const f = await this.prisma.facility.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!f) throw new NotFoundException('Aucun espace');
    return f.id;
  }

  private async facilityOfMember(memberId: string) {
    const m = await this.prisma.member.findUnique({
      where: { id: memberId },
      select: { organizationId: true },
    });
    if (!m) return null;
    const f = await this.prisma.facility.findFirst({
      where: { organizationId: m.organizationId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return f?.id ?? null;
  }

  private async facilityOfOrg(orgSlug: string) {
    const org = await this.prisma.organization.findUnique({
      where: { slug: orgSlug },
      select: { facilities: { orderBy: { createdAt: 'asc' }, take: 1, select: { id: true } } },
    });
    return org?.facilities[0]?.id ?? null;
  }

  // ---------- admin ----------

  async list(facilityId?: string) {
    const id = await this.facilityId(facilityId);
    const rows = await this.prisma.promotion.findMany({
      where: { facilityId: id },
      include: INCLUDE,
      orderBy: [{ isActive: 'desc' }, { startsAt: 'desc' }],
    });
    const stats = await this.prisma.promotionUse.groupBy({
      by: ['promotionId'],
      where: { promotionId: { in: rows.map((r) => r.id) } },
      _count: true,
      _sum: { amount: true, discount: true },
    });
    const members = await this.prisma.promotionUse.groupBy({
      by: ['promotionId', 'memberId'],
      where: { promotionId: { in: rows.map((r) => r.id) }, memberId: { not: null } },
    });
    const vouchers = await this.prisma.promotionVoucher.groupBy({
      by: ['promotionId', 'status'],
      where: { promotionId: { in: rows.map((r) => r.id) } },
      _count: true,
    });
    const vCount = (id: string, st: PromotionVoucherStatus) =>
      vouchers.find((v) => v.promotionId === id && v.status === st)?._count ?? 0;
    const now = new Date();
    const tarifs = await this.tarifsOf(id);
    return rows.map((r) => {
      const s = stats.find((x) => x.promotionId === r.id);
      const used = vCount(r.id, 'USED');
      const accepted = vCount(r.id, 'ACCEPTED') + used;
      return {
        ...this.serialize(r, now, tarifs),
        stats: {
          views: r.views,
          clicks: r.clicks,
          uses: s?._count ?? 0,
          members: members.filter((m) => m.promotionId === r.id).length,
          revenue: round1(s?._sum.amount ?? 0),
          discount: round1(s?._sum.discount ?? 0),
          offered: accepted + vCount(r.id, 'DECLINED'),
          accepted,
          redeemed: used,
        },
      };
    });
  }

  /** Sellable tarifs of the facility's organization (to expand category promos into tarif ids). */
  private async tarifsOf(facilityId: string): Promise<CoverPrice[]> {
    const f = await this.prisma.facility.findUnique({
      where: { id: facilityId },
      select: { organizationId: true },
    });
    return this.prisma.price.findMany({
      where: { isActive: true, ...(f?.organizationId ? { organizationId: f.organizationId } : {}) },
      select: { id: true, category: true, categories: true, type: true },
    });
  }

  private serialize(r: PromotionRow, now: Date, tarifs: CoverPrice[] = []) {
    const base =
      r.target === 'PRODUCT' || r.target === 'BUNDLE'
        ? r.product?.sellingPrice
        : r.target === 'PRICE'
          ? r.price?.price
          : null;
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      target: r.target,
      productId: r.productId,
      priceId: r.priceId,
      priceCategory: r.priceCategory,
      /** PRICE / BUNDLE: every tarif id the promo covers */
      priceIds: r.priceId
        ? [r.priceId]
        : r.priceCategory
          ? tarifs.filter((t) => priceCategoriesFor(t).includes(r.priceCategory!)).map((t) => t.id)
          : [],
      /** BUNDLE: the gift; PRICE: the tarif; PRODUCT: the product */
      itemName:
        r.target === 'BUNDLE' ? r.product?.name ?? null : r.product?.name ?? r.price?.name ?? null,
      /** Tarif name for PRICE / BUNDLE (null when the promo covers a whole category) */
      priceName: r.price?.name ?? null,
      itemImg: r.product?.img ?? null,
      valueKind: r.valueKind,
      value: r.value,
      label: promotionLabel(r),
      priceBefore: base ?? null,
      priceAfter: base != null ? applyDiscount(base, r.valueKind, r.value) : null,
      startsAt: r.startsAt,
      endsAt: r.endsAt,
      daysOfWeek: r.daysOfWeek,
      fromHour: r.fromHour,
      toHour: r.toHour,
      audience: r.audience,
      maxUsesPerMember: r.maxUsesPerMember,
      maxUses: r.maxUses,
      style: r.style,
      isActive: r.isActive,
      liveNow: isLiveAt(r, now),
      liveUntil: isLiveAt(r, now) ? liveUntil(r, now) : null,
    };
  }

  private data(body: PromotionBody, creating: boolean) {
    const d: Prisma.PromotionUncheckedUpdateInput = {};
    const oneOf = <T extends readonly string[]>(v: string | undefined, list: T, label: string) => {
      if (!list.includes(v as T[number])) throw new BadRequestException(`${label} invalide`);
      return v as T[number];
    };
    if (body.title !== undefined || creating) {
      const t = (body.title || '').trim();
      if (!t || t.length > 120) throw new BadRequestException('Titre requis (120 max)');
      d.title = t;
    }
    if (body.description !== undefined) d.description = body.description?.trim() || null;
    if (body.target !== undefined || creating) d.target = oneOf(body.target, PROMOTION_TARGETS, 'Cible');
    if (body.productId !== undefined) d.productId = body.productId || null;
    if (body.priceId !== undefined) d.priceId = body.priceId || null;
    if (body.priceCategory !== undefined) {
      const c = body.priceCategory || null;
      if (c && !PRICE_CATEGORIES.includes(c)) throw new BadRequestException('Catégorie invalide');
      d.priceCategory = c as PriceCategory | null;
    }
    if (body.valueKind !== undefined || creating) {
      d.valueKind = oneOf(body.valueKind || 'PERCENT', ['PERCENT', 'FIXED_DT'] as const, 'Type de remise');
    }
    if (body.value !== undefined || creating) {
      const v = Number(body.value);
      if (!(v > 0)) throw new BadRequestException('Remise > 0 requise');
      if ((body.valueKind || 'PERCENT') === 'PERCENT' && v > 100) {
        throw new BadRequestException('Pourcentage max 100');
      }
      d.value = v;
    }
    if (body.startsAt !== undefined || creating) {
      const s = body.startsAt ? new Date(body.startsAt) : new Date();
      if (Number.isNaN(s.getTime())) throw new BadRequestException('Date de début invalide');
      d.startsAt = s;
    }
    if (body.endsAt !== undefined) {
      const e = body.endsAt ? new Date(body.endsAt) : null;
      if (e && Number.isNaN(e.getTime())) throw new BadRequestException('Date de fin invalide');
      d.endsAt = e;
    }
    if (body.daysOfWeek !== undefined) {
      d.daysOfWeek = [...new Set((body.daysOfWeek || []).map(Number))].filter((x) => x >= 0 && x <= 6);
    }
    for (const k of ['fromHour', 'toHour'] as const) {
      if (body[k] === undefined) continue;
      const v = body[k];
      if (v != null && (!Number.isInteger(v) || v < 0 || v > 24)) {
        throw new BadRequestException('Heure invalide (0–24)');
      }
      d[k] = v ?? null;
    }
    if (body.audience !== undefined) d.audience = oneOf(body.audience, PROMOTION_AUDIENCES, 'Public');
    for (const k of ['maxUsesPerMember', 'maxUses'] as const) {
      if (body[k] === undefined) continue;
      const v = body[k];
      d[k] = v == null || v <= 0 ? null : Math.round(v);
    }
    if (body.style !== undefined) d.style = oneOf(body.style, PROMOTION_STYLES, 'Style');
    if (body.isActive !== undefined) d.isActive = !!body.isActive;
    return d;
  }

  private check(d: { target?: unknown; productId?: unknown; priceId?: unknown; priceCategory?: unknown }) {
    if ((d.target === 'PRODUCT' || d.target === 'BUNDLE') && !d.productId) {
      throw new BadRequestException(d.target === 'BUNDLE' ? 'Choisissez le produit offert' : 'Choisissez le produit');
    }
    if ((d.target === 'PRICE' || d.target === 'BUNDLE') && !d.priceId && !d.priceCategory) {
      throw new BadRequestException('Choisissez le pass ou la catégorie');
    }
  }

  async create(facilityId: string | undefined, body: PromotionBody) {
    const id = await this.facilityId(facilityId);
    const d = this.data(body, true);
    this.check(d);
    const row = await this.prisma.promotion.create({
      data: { ...(d as Prisma.PromotionUncheckedCreateInput), facilityId: id },
      include: INCLUDE,
    });
    return this.serialize(row, new Date());
  }

  async update(id: string, body: PromotionBody) {
    const cur = await this.prisma.promotion.findUnique({ where: { id } });
    if (!cur) throw new NotFoundException('Promotion introuvable');
    const d = this.data(body, false);
    this.check({ ...cur, ...d });
    const row = await this.prisma.promotion.update({ where: { id }, data: d, include: INCLUDE });
    return this.serialize(row, new Date());
  }

  async remove(id: string) {
    await this.prisma.promotion.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Promotion introuvable');
    });
    return { ok: true };
  }

  // ---------- eligibility ----------

  private async usage(promotionIds: string[], memberId?: string | null) {
    if (!promotionIds.length) return { total: new Map<string, number>(), mine: new Map<string, number>() };
    const [total, mine] = await Promise.all([
      this.prisma.promotionUse.groupBy({
        by: ['promotionId'],
        where: { promotionId: { in: promotionIds } },
        _count: true,
      }),
      memberId
        ? this.prisma.promotionUse.groupBy({
            by: ['promotionId'],
            where: { promotionId: { in: promotionIds }, memberId },
            _count: true,
          })
        : Promise.resolve([]),
    ]);
    return {
      total: new Map(total.map((t) => [t.promotionId, t._count])),
      mine: new Map(mine.map((t) => [t.promotionId, t._count])),
    };
  }

  /** Live offers this member can still use, best discount first. */
  private async eligible(
    facilityId: string,
    memberId: string | null | undefined,
    where: Prisma.PromotionWhereInput,
    at = new Date(),
  ) {
    const rows = await this.prisma.promotion.findMany({
      where: {
        facilityId,
        isActive: true,
        startsAt: { lte: at },
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: at } }] }, where],
      },
      include: INCLUDE,
    });
    const live = rows.filter((r) => isLiveAt(r, at));
    if (!live.length) return [];
    const { total, mine } = await this.usage(
      live.map((r) => r.id),
      memberId,
    );
    const inSession = memberId
      ? !!(await this.prisma.journal.findFirst({
          where: { memberID: memberId, leaveTime: null, isReservation: false },
          select: { id: true },
        }))
      : false;
    return live.filter((r) => {
      if (r.maxUses != null && (total.get(r.id) ?? 0) >= r.maxUses) return false;
      if (r.maxUsesPerMember != null) {
        if (!memberId) return false;
        if ((mine.get(r.id) ?? 0) >= r.maxUsesPerMember) return false;
      }
      if (r.audience === 'IN_SESSION' && !inSession) return false;
      return true;
    });
  }

  private best<T extends { valueKind: PromoValueKind; value: number }>(rows: T[], base: number) {
    let pick: { row: T; amount: number } | null = null;
    for (const row of rows) {
      const amount = applyDiscount(base, row.valueKind, row.value);
      if (amount < base - 0.0005 && (!pick || amount < pick.amount)) pick = { row, amount };
    }
    return pick;
  }

  /**
   * Unit price for a café order with the best live offer applied (null when none).
   * A gift-with-pass voucher on the visit comes first: it covers one unit, so with
   * qty > 1 the unit price is the average.
   */
  async productDeal(
    productId: string,
    unitPrice: number,
    memberId?: string | null,
    opts: { qty?: number; journalId?: string | null } = {},
  ) {
    const voucher = await this.openVoucher(productId, memberId, opts.journalId);
    if (voucher) {
      const qty = Math.max(1, opts.qty ?? 1);
      const gift = applyDiscount(unitPrice, voucher.promotion.valueKind, voucher.promotion.value);
      return {
        promotionId: voucher.promotionId,
        unitPrice: Math.round(((gift + (qty - 1) * unitPrice) / qty) * 1000) / 1000,
        label: `${voucher.promotion.title}`,
        voucherId: voucher.id,
      };
    }
    const facilityId = memberId
      ? await this.facilityOfMember(memberId)
      : await this.facilityId();
    if (!facilityId) return null;
    const rows = await this.eligible(facilityId, memberId, { target: 'PRODUCT', productId });
    const pick = this.best(rows, unitPrice);
    return pick
      ? { promotionId: pick.row.id, unitPrice: pick.amount, label: `${pick.row.title}`, voucherId: null }
      : null;
  }

  /** Accepted, unused voucher for this product on the visit (given journal, else the member's open one). */
  private async openVoucher(productId: string, memberId?: string | null, journalId?: string | null) {
    let jid = journalId ?? null;
    if (!jid && memberId) {
      const open = await this.prisma.journal.findFirst({
        where: { memberID: memberId, leaveTime: null, isReservation: false },
        orderBy: { registredTime: 'desc' },
        select: { id: true },
      });
      jid = open?.id ?? null;
    }
    if (!jid) return null;
    return this.prisma.promotionVoucher.findFirst({
      where: { journalId: jid, productId, status: 'ACCEPTED' },
      include: { promotion: { select: { title: true, valueKind: true, value: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async markVoucherUsed(voucherId: string, dailyProductId: string) {
    await this.prisma.promotionVoucher.updateMany({
      where: { id: voucherId, status: 'ACCEPTED' },
      data: { status: 'USED', usedAt: new Date(), dailyProductId },
    });
  }

  /** A café order was cancelled: its voucher can be used again. */
  async releaseVoucher(dailyProductId: string) {
    await this.prisma.promotionVoucher.updateMany({
      where: { dailyProductId, status: 'USED' },
      data: { status: 'ACCEPTED', usedAt: null, dailyProductId: null },
    });
  }

  /** Pass / tarif amount with the best live offer applied (null when none). */
  async priceDeal(priceId: string, amount: number, memberId?: string | null) {
    if (!priceId) return null;
    const price = await this.prisma.price.findUnique({
      where: { id: priceId },
      select: { id: true, category: true, categories: true, type: true },
    });
    if (!price) return null;
    const facilityId = memberId ? await this.facilityOfMember(memberId) : await this.facilityId();
    if (!facilityId) return null;
    const rows = await this.eligible(facilityId, memberId, { target: 'PRICE', ...priceMatchWhere(price) });
    const pick = this.best(rows, amount);
    return pick
      ? {
          promotionId: pick.row.id,
          amount: pick.amount,
          label: `${pick.row.title} ${promotionLabel(pick.row)}`,
        }
      : null;
  }

  /** Live gift-with-pass offers for this tarif. */
  async bundlesFor(priceId: string, memberId?: string | null) {
    const price = await this.prisma.price.findUnique({
      where: { id: priceId },
      select: { id: true, category: true, categories: true, type: true },
    });
    if (!price) return [];
    const facilityId = memberId ? await this.facilityOfMember(memberId) : await this.facilityId();
    if (!facilityId) return [];
    return this.eligible(facilityId, memberId, {
      target: 'BUNDLE',
      productId: { not: null },
      ...priceMatchWhere(price),
    });
  }

  /**
   * The client answered the gift offers of the pass they chose: yes → voucher for
   * the visit, no → declined (kept for the accept rate). `acceptedIds` undefined =
   * the screen showed no offer, nothing is recorded. Answers for another pass of
   * the same visit are dropped (used vouchers stay).
   */
  async offerBundles(data: {
    journalId: string;
    memberId?: string | null;
    priceId: string;
    acceptedIds?: string[] | null;
  }) {
    await this.prisma.promotionVoucher.deleteMany({
      where: { journalId: data.journalId, status: { not: 'USED' } },
    });
    if (!data.acceptedIds) return [];
    const offers = await this.bundlesFor(data.priceId, data.memberId);
    const yes = new Set(data.acceptedIds);
    const used = await this.prisma.promotionVoucher.findMany({
      where: { journalId: data.journalId },
      select: { promotionId: true },
    });
    const done = new Set(used.map((u) => u.promotionId));
    const rows = offers.filter((o) => o.productId && !done.has(o.id));
    if (rows.length) {
      await this.prisma.promotionVoucher.createMany({
        data: rows.map((o) => ({
          promotionId: o.id,
          journalId: data.journalId,
          memberId: data.memberId ?? null,
          productId: o.productId!,
          status: yes.has(o.id) ? ('ACCEPTED' as const) : ('DECLINED' as const),
        })),
        skipDuplicates: true,
      });
    }
    return rows.filter((o) => yes.has(o.id)).map((o) => o.id);
  }

  /** Vouchers of the member's open visit (app session screen + café). */
  async vouchersForMember(memberId: string) {
    const open = await this.prisma.journal.findFirst({
      where: { memberID: memberId, leaveTime: null, isReservation: false },
      orderBy: { registredTime: 'desc' },
      select: { id: true },
    });
    if (!open) return [];
    return this.vouchersForJournal(open.id);
  }

  async vouchersForJournal(journalId: string) {
    const rows = await this.prisma.promotionVoucher.findMany({
      where: { journalId, status: { in: ['ACCEPTED', 'USED'] } },
      include: { promotion: { include: INCLUDE } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((v) => {
      const p = v.promotion;
      const before = p.product?.sellingPrice ?? null;
      return {
        id: v.id,
        promotionId: v.promotionId,
        journalId: v.journalId,
        productId: v.productId,
        status: v.status,
        title: p.title,
        label: promotionLabel(p),
        productName: p.product?.name ?? null,
        productImg: p.product?.img ?? null,
        priceBefore: before,
        priceAfter: before != null ? applyDiscount(before, p.valueKind, p.value) : null,
        usedAt: v.usedAt,
      };
    });
  }

  /** Re-pricing a visit: drop the tarif promo it got before (café promos stay). */
  async clearJournalPriceUses(journalId: string) {
    await this.prisma.promotionUse.deleteMany({ where: { journalId, dailyProductId: null } });
  }

  recordUse(data: {
    promotionId: string;
    memberId?: string | null;
    dailyProductId?: string | null;
    journalId?: string | null;
    amount: number;
    discount: number;
  }) {
    return this.prisma.promotionUse.create({
      data: {
        promotionId: data.promotionId,
        memberId: data.memberId ?? null,
        dailyProductId: data.dailyProductId ?? null,
        journalId: data.journalId ?? null,
        amount: Math.round(data.amount * 1000) / 1000,
        discount: Math.round(data.discount * 1000) / 1000,
      },
    });
  }

  // ---------- member app ----------

  /** Offers to show in the app (golden card popup + offers strip). */
  async forMember(orgSlug: string, memberId?: string | null) {
    const facilityId = await this.facilityOfOrg(orgSlug);
    if (!facilityId) return [];
    const now = new Date();
    const rows = await this.eligible(facilityId, memberId, {}, now);
    const tarifs = rows.some((r) => r.priceCategory) ? await this.tarifsOf(facilityId) : [];
    return rows
      .map((r) => this.serialize(r, now, tarifs))
      .sort((a, b) => (a.liveUntil?.getTime() ?? Infinity) - (b.liveUntil?.getTime() ?? Infinity));
  }

  async track(id: string, kind: 'view' | 'click') {
    await this.prisma.promotion
      .update({
        where: { id },
        data: kind === 'view' ? { views: { increment: 1 } } : { clicks: { increment: 1 } },
      })
      .catch(() => null);
    return { ok: true };
  }
}
