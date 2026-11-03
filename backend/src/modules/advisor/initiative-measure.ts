import { Injectable } from '@nestjs/common';
import { addDays, startOfDay } from 'date-fns';
import { PrismaService } from 'database/prisma.service';
import { localDayKey } from '../../../common/parse-local-day';
import { round1, visitEnd } from '../analytics/traffic';
import { orderUnitPrice } from '../product/order-price';
import type { FunnelInput } from './funnel';
import { type LinkedSale, sale } from './sales';

/** Figures in % already: the effect is a difference in points, not a % change. */
export const RATE_METRICS = ['cafeAttachRatePct', 'avgOccupancyPct'];

/** What can be measured on a slot (time of day) or on a client list. Others: whole space. */
const SLOT_METRICS = ['revenuePerDay', 'visitsPerDay', 'revenueCafe', 'cafeAttachRatePct', 'avgStayHours'];
const LIST_METRICS = [...SLOT_METRICS, 'revenueSubscriptions'];

const DAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

export type InitiativeTarget = {
  targetKind?: string | null;
  targetDays?: number[] | null;
  targetFromHour?: number | null;
  targetToHour?: number | null;
  targetSegment?: string | null;
  targetMemberIds?: string[] | null;
};

type Visit = {
  id: string;
  registredTime: Date;
  leaveTime: Date | null;
  isPayed: boolean;
  payedAmount: number;
  memberID: string | null;
};
type Order = { journalId: string | null; memberId: string | null; at: Date; revenue: number };
type Abo = { memberID: string; createdAt: Date; amount: number };
type Slice = { visits: Visit[]; orders: Order[]; abos: Abo[] };
/** skip: days left out of the window (paused days of the action) */
type Window = { from: Date; to: Date; skip?: (d: Date) => boolean };

export { sale, sumSales, type LinkedSale, type SaleItem } from './sales';

const inHours = (h: number, from: number | null | undefined, to: number | null | undefined) => {
  if (from == null || to == null) return true;
  return from < to ? h >= from && h < to : h >= from || h < to;
};

export const slotLabel = (t: InitiativeTarget) => {
  const days = t.targetDays?.length
    ? [...t.targetDays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => DAY_SHORT[d]).join(', ')
    : 'Tous les jours';
  const hours =
    t.targetFromHour != null && t.targetToHour != null
      ? ` · ${t.targetFromHour}h–${t.targetToHour === 24 ? '00' : t.targetToHour}h`
      : '';
  return days + hours;
};

/** Days of a window matching a weekday filter (empty = all). */
function countDays(w: Window, days: number[], invert = false) {
  let n = 0;
  for (let d = startOfDay(w.from); d <= w.to; d = addDays(d, 1)) {
    if (w.skip?.(d)) continue;
    const match = !days.length || days.includes(d.getDay());
    if (match !== invert) n += 1;
  }
  return Math.max(1, n);
}

/** One group's figures, divided per day (slot) or per client (list). */
function figures(s: Slice, denom: number) {
  const revenueVisits = s.visits.reduce((a, v) => a + (v.isPayed ? v.payedAmount || 0 : 0), 0);
  const revenueCafe = s.orders.reduce((a, o) => a + o.revenue, 0);
  const revenueSubscriptions = s.abos.reduce((a, x) => a + x.amount, 0);
  const withOrder = new Set(s.orders.map((o) => o.journalId).filter(Boolean));
  const buyerDays = new Set(
    s.orders.filter((o) => o.memberId).map((o) => `${o.memberId}|${localDayKey(o.at)}`),
  );
  const attached = s.visits.filter(
    (v) => withOrder.has(v.id) || (v.memberID && buyerDays.has(`${v.memberID}|${localDayKey(v.registredTime)}`)),
  ).length;
  const now = new Date();
  const stays = s.visits.map((v) => (visitEnd(v, now).getTime() - v.registredTime.getTime()) / 3_600_000);
  const total = revenueVisits + revenueCafe + revenueSubscriptions;
  return {
    values: {
      visitsPerDay: round1(s.visits.length / denom),
      revenuePerDay: round1(total / denom),
      revenueCafe: round1(revenueCafe / denom),
      revenueSubscriptions: round1(revenueSubscriptions / denom),
      cafeAttachRatePct: s.visits.length ? Math.round((attached / s.visits.length) * 100) : null,
      avgStayHours: stays.length ? round1(stays.reduce((a, b) => a + b, 0) / stays.length) : null,
    } as Record<string, number | null>,
    revenue: total,
    visits: s.visits.length,
  };
}

@Injectable()
export class InitiativeMeasure {
  constructor(private readonly prisma: PrismaService) {}

  private async load(w: Window, memberIds?: string[]): Promise<Slice> {
    const member = memberIds ? { in: memberIds } : undefined;
    const [visits, orders, abos] = await Promise.all([
      this.prisma.journal.findMany({
        where: { registredTime: { gte: w.from, lte: w.to }, isReservation: false, ...(member && { memberID: member }) },
        select: { id: true, registredTime: true, leaveTime: true, isPayed: true, payedAmount: true, memberID: true },
      }),
      this.prisma.dailyProduct.findMany({
        where: {
          createdAt: { gte: w.from, lte: w.to },
          status: { notIn: ['PENDING', 'CANCELLED'] },
          ...(member && { memberId: member }),
        },
        select: {
          journalId: true,
          memberId: true,
          createdAt: true,
          quantite: true,
          unitPrice: true,
          product: { select: { sellingPrice: true } },
        },
      }),
      memberIds
        ? this.prisma.abonnement.findMany({
            where: { createdAt: { gte: w.from, lte: w.to }, isReservation: false, memberID: member },
            select: { memberID: true, createdAt: true, amountDue: true, payedAmount: true },
          })
        : Promise.resolve([]),
    ]);
    const keep = (d: Date) => !w.skip?.(d);
    return {
      visits: visits.filter((v) => keep(v.registredTime)),
      orders: orders.filter((o) => keep(o.createdAt)).map((o) => ({
        journalId: o.journalId,
        memberId: o.memberId,
        at: o.createdAt,
        revenue: orderUnitPrice(o) * (o.quantite || 0),
      })),
      abos: abos.filter((a) => a.createdAt && keep(a.createdAt)).map((a) => ({
        memberID: a.memberID,
        createdAt: a.createdAt!,
        amount: a.amountDue ?? a.payedAmount ?? 0,
      })),
    };
  }

  /**
   * The chosen figure on the target and on a comparison group, before and after.
   * Effect = target change − comparison change: what moved everywhere (season, weather) is removed.
   * Returns null when the action targets the whole space (or the figure can't be split).
   */
  async measure(t: InitiativeTarget, metric: string, before: Window, after: Window) {
    const kind = t.targetKind || 'ALL';
    if (kind === 'SLOT') return this.measureSlot(t, metric, before, after);
    if (kind === 'LIST') return this.measureList(t, metric, before, after);
    return null;
  }

  private async measureSlot(t: InitiativeTarget, metric: string, before: Window, after: Window) {
    if (!SLOT_METRICS.includes(metric)) return null;
    const days = t.targetDays ?? [];
    const hasHours = t.targetFromHour != null && t.targetToHour != null;
    if (!days.length && !hasHours) return null;
    const dayOk = (d: Date) => !days.length || days.includes(d.getDay());
    const inTarget = (d: Date) => dayOk(d) && inHours(d.getHours(), t.targetFromHour, t.targetToHour);
    // Same days, other hours; or, for whole days, the other days
    const inComparison = (d: Date) =>
      hasHours ? dayOk(d) && !inHours(d.getHours(), t.targetFromHour, t.targetToHour) : !dayOk(d);
    const split = (s: Slice, keep: (d: Date) => boolean): Slice => ({
      visits: s.visits.filter((v) => keep(v.registredTime)),
      orders: s.orders.filter((o) => keep(o.at)),
      abos: [],
    });
    const [b, a] = await Promise.all([this.load(before), this.load(after)]);
    const tDays = (w: Window) => countDays(w, days);
    const cDays = (w: Window) => (hasHours ? countDays(w, days) : countDays(w, days, true));
    const tb = figures(split(b, inTarget), tDays(before));
    const ta = figures(split(a, inTarget), tDays(after));
    const cb = figures(split(b, inComparison), cDays(before));
    const ca = figures(split(a, inComparison), cDays(after));
    return this.compare(metric, 'slot', slotLabel(t), hasHours ? 'Autres heures, mêmes jours' : 'Autres jours', 'par jour', tb, ta, cb, ca);
  }

  private async measureList(t: InitiativeTarget, metric: string, before: Window, after: Window) {
    const ids = t.targetMemberIds ?? [];
    if (!ids.length || !LIST_METRICS.includes(metric)) return null;
    const [tB, tA, allB, allA] = await Promise.all([
      this.load(before, ids),
      this.load(after, ids),
      this.load(before),
      this.load(after),
    ]);
    // Comparison: the other clients seen in either window
    const others = new Set(
      [...allB.visits, ...allA.visits].map((v) => v.memberID).filter((m): m is string => !!m && !ids.includes(m)),
    );
    const otherIds = [...others];
    const [oB, oA] = otherIds.length
      ? await Promise.all([this.load(before, otherIds), this.load(after, otherIds)])
      : [null, null];
    const tb = figures(tB, ids.length);
    const ta = figures(tA, ids.length);
    const cb = oB ? figures(oB, otherIds.length) : null;
    const ca = oA ? figures(oA, otherIds.length) : null;
    return this.compare(
      metric,
      'list',
      `${ids.length} client${ids.length > 1 ? 's' : ''}`,
      cb ? `Autres clients (${otherIds.length})` : null,
      'par client',
      tb,
      ta,
      cb,
      ca,
    );
  }

  private compare(
    metric: string,
    mode: 'slot' | 'list',
    targetLabel: string,
    comparisonLabel: string | null,
    per: string,
    tb: ReturnType<typeof figures>,
    ta: ReturnType<typeof figures>,
    cb: ReturnType<typeof figures> | null,
    ca: ReturnType<typeof figures> | null,
  ) {
    // Money gain on the target, net of the comparison's drift
    // Capped: with few sales (or a bad price) the comparison can jump ×10 and swamp the target
    const rawDrift = cb && ca && cb.revenue > 0 ? ca.revenue / cb.revenue : 1;
    const drift = Math.min(1.5, Math.max(0.5, rawDrift));
    return {
      mode,
      per,
      targetLabel,
      comparisonLabel,
      target: { before: tb.values[metric] ?? null, after: ta.values[metric] ?? null },
      comparison: cb && ca ? { before: cb.values[metric] ?? null, after: ca.values[metric] ?? null } : null,
      targetVisits: tb.visits + ta.visits,
      gain: round1(ta.revenue - tb.revenue * drift),
    };
  }

  /**
   * What one tool brought since the action started: each sale is an item with a key
   * (visit, abonnement, order, ticket…) so a sale reached by two tools counts once.
   */
  async linkedSale(kind: string, id: string, from: Date, to: Date): Promise<LinkedSale | null> {
    if (kind === 'PRICE') {
      const [price, visits, abos] = await Promise.all([
        this.prisma.price.findUnique({ where: { id }, select: { name: true } }),
        this.prisma.journal.findMany({
          where: { priceId: id, registredTime: { gte: from, lte: to }, isReservation: false },
          select: { id: true, isPayed: true, payedAmount: true },
        }),
        this.prisma.abonnement.findMany({
          where: { priceId: id, createdAt: { gte: from, lte: to }, isReservation: false },
          select: { id: true, amountDue: true, payedAmount: true },
        }),
      ]);
      const items = [
        ...visits.map((v) => ({ key: `j:${v.id}`, amount: v.isPayed ? v.payedAmount || 0 : 0 })),
        ...abos.map((a) => ({ key: `a:${a.id}`, amount: a.amountDue ?? a.payedAmount ?? 0 })),
      ];
      return sale(kind, id, price?.name ?? 'Offre supprimée', items, 0, [{ label: 'Ventes', value: items.length }]);
    }
    if (kind === 'PRODUCT') {
      const [product, rows] = await Promise.all([
        this.prisma.product.findUnique({ where: { id }, select: { name: true } }),
        this.prisma.dailyProduct.findMany({
          where: { productId: id, createdAt: { gte: from, lte: to }, status: { notIn: ['PENDING', 'CANCELLED'] } },
          select: { id: true, quantite: true, unitPrice: true, product: { select: { sellingPrice: true, purchasePrice: true } } },
        }),
      ]);
      // A product brings its margin, not its price
      const items = rows.map((r) => ({
        key: `o:${r.id}`,
        amount: (orderUnitPrice(r) - (r.product?.purchasePrice || 0)) * (r.quantite || 0),
      }));
      const qty = rows.reduce((a, r) => a + (r.quantite || 0), 0);
      return sale(kind, id, product?.name ?? 'Produit supprimé', items, 0, [{ label: 'Vendus', value: qty }], qty);
    }
    if (kind === 'PROMOTION') {
      const [promo, uses] = await Promise.all([
        this.prisma.promotion.findUnique({ where: { id }, select: { title: true, views: true, clicks: true } }),
        this.prisma.promotionUse.findMany({
          where: { promotionId: id, createdAt: { gte: from, lte: to } },
          select: { id: true, amount: true, discount: true, journalId: true, dailyProductId: true },
        }),
      ]);
      const items = uses.map((u) => ({
        key: u.journalId ? `j:${u.journalId}` : u.dailyProductId ? `o:${u.dailyProductId}` : `pu:${u.id}`,
        amount: u.amount,
      }));
      const discount = uses.reduce((a, u) => a + u.discount, 0);
      return sale(kind, id, promo?.title ?? 'Promo supprimée', items, discount, [
        { label: 'Vues', value: promo?.views ?? 0 },
        { label: 'Clics', value: promo?.clicks ?? 0 },
        { label: 'Utilisées', value: uses.length },
      ]);
    }
    if (kind === 'EVENT') {
      const event = await this.prisma.event.findUnique({
        where: { id },
        select: { title: true, price: true, startAt: true, registrations: { select: { id: true, status: true, paidAmount: true, paidAt: true } } },
      });
      const regs = (event?.registrations ?? []).filter((r) => r.status !== 'CANCELLED');
      const paid = regs.filter((r) => r.paidAt);
      const items = paid.map((r) => ({ key: `r:${r.id}`, amount: r.paidAmount ?? event?.price ?? 0 }));
      const held = !!event && event.startAt <= new Date();
      return sale(kind, id, event?.title ?? 'Événement supprimé', items, 0, [
        { label: 'Inscrits', value: regs.length },
        ...(event?.price ? [{ label: 'Payés', value: paid.length }] : []),
        { label: 'Venus', value: held ? regs.filter((r) => r.status === 'ATTENDED').length : null },
      ], event?.price ? paid.length : regs.length);
    }
    if (kind === 'SURVEY') {
      const [survey, visits, responses] = await Promise.all([
        this.prisma.survey.findUnique({ where: { id }, select: { title: true } }),
        this.prisma.surveyVisit.count({ where: { surveyId: id, firstSeenAt: { gte: from, lte: to } } }),
        this.prisma.surveyResponse.findMany({
          where: { surveyId: id, createdAt: { gte: from, lte: to }, flagged: false, supersededAt: null },
          select: { memberId: true, createdAt: true },
        }),
      ]);
      // A respondent becomes a client: what they paid after answering counts
      const firstAnswer = new Map<string, Date>();
      for (const r of responses) {
        if (!r.memberId) continue;
        const cur = firstAnswer.get(r.memberId);
        if (!cur || r.createdAt < cur) firstAnswer.set(r.memberId, r.createdAt);
      }
      const ids = [...firstAnswer.keys()];
      const [jv, ab] = ids.length
        ? await Promise.all([
            this.prisma.journal.findMany({
              where: { memberID: { in: ids }, registredTime: { gte: from, lte: to }, isPayed: true },
              select: { id: true, memberID: true, registredTime: true, payedAmount: true },
            }),
            this.prisma.abonnement.findMany({
              where: { memberID: { in: ids }, createdAt: { gte: from, lte: to }, isReservation: false },
              select: { id: true, memberID: true, createdAt: true, amountDue: true, payedAmount: true },
            }),
          ])
        : [[], []];
      const after = (m: string | null, d: Date | null) => !!m && !!d && d >= (firstAnswer.get(m) ?? to);
      const items = [
        ...jv.filter((v) => after(v.memberID, v.registredTime)).map((v) => ({ key: `j:${v.id}`, amount: v.payedAmount || 0 })),
        ...ab.filter((a) => after(a.memberID, a.createdAt)).map((a) => ({ key: `a:${a.id}`, amount: a.amountDue ?? a.payedAmount ?? 0 })),
      ];
      const clients = new Set([
        ...jv.filter((v) => after(v.memberID, v.registredTime)).map((v) => v.memberID),
        ...ab.filter((a) => after(a.memberID, a.createdAt)).map((a) => a.memberID),
      ]).size;
      return sale(kind, id, survey?.title ?? 'Enquête supprimée', items, 0, [
        { label: 'Ouvertures', value: visits },
        { label: 'Réponses', value: responses.length },
        { label: 'Devenus clients', value: clients },
      ], responses.length);
    }
    return null;
  }

  /**
   * The raw numbers of the action's funnel, from what the app records:
   * event → typed reach, tracked link opens, registrations, payments, attendance;
   * promo → views, clicks, uses; client relance → contacted, came back.
   */
  async funnelInput(
    i: { id: string; linkedKind?: string | null; linkedId?: string | null; channels?: string[] | null; interested?: number | null },
    reach: number | null,
    links: Array<{ opens: number }>,
    campaign: { total: number; contacted: number; won: number } | null,
  ): Promise<{ input: FunnelInput | null; price: number | null }> {
    if (i.linkedKind === 'EVENT' && i.linkedId) {
      const event = await this.prisma.event.findUnique({
        where: { id: i.linkedId },
        select: {
          price: true,
          startAt: true,
          registrations: { select: { status: true, paidAt: true } },
        },
      });
      if (!event) return { input: null, price: null };
      const regs = event.registrations.filter((r) => r.status !== 'CANCELLED');
      const held = event.startAt <= new Date();
      return {
        price: event.price,
        input: {
          kind: 'EVENT',
          channels: i.channels ?? [],
          reach,
          interested: i.interested ?? null,
          links: links.length,
          opens: links.reduce((a, l) => a + l.opens, 0),
          registered: regs.length,
          paid: event.price ? regs.filter((r) => r.paidAt).length : null,
          price: event.price,
          came: held ? regs.filter((r) => r.status === 'ATTENDED').length : null,
        },
      };
    }
    if (i.linkedKind === 'PROMOTION' && i.linkedId) {
      const promo = await this.prisma.promotion.findUnique({
        where: { id: i.linkedId },
        select: { views: true, clicks: true, _count: { select: { uses: true } } },
      });
      if (!promo) return { input: null, price: null };
      return { price: null, input: { kind: 'PROMOTION', views: promo.views, clicks: promo.clicks, uses: promo._count.uses } };
    }
    if (campaign) {
      return { price: null, input: { kind: 'CAMPAIGN', ...campaign } };
    }
    return { input: null, price: null };
  }
}
