import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ProductOrderStatus, StockItemKind } from '@prisma/client';
import { PrismaService } from 'database/prisma.service';
import { computeStock, monthOf, type RecipeLine } from '../../business-manager-core/stock-lots';
import { orderUnitPrice } from '../product/order-price';
import { parseLocalDay } from '../../../common/parse-local-day';
import { ExpensesService } from '../expense/expense.service';
import { EventsGateway } from '../webSocket/events.gateway';

const UNITS = ['g', 'ml', 'pc'] as const;
const SOURCES = ['CAISSE', 'COFFRE', 'AUTRE', 'NONE'] as const;
const round2 = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

type PurchaseLine = { stockItemId: string; quantity: number; price: number };

/** Short "1 kg", "6 L", "100 pc" for labels. */
export function qtyLabel(q: number, unit: string) {
  if (unit === 'g' || unit === 'ml') {
    const big = unit === 'g' ? 'kg' : 'L';
    return q >= 1000 ? `${+(q / 1000).toFixed(2)} ${big}` : `${+q.toFixed(0)} ${unit}`;
  }
  return `${+q.toFixed(2)} pc`;
}

@Injectable()
export class StockService {
  private readonly log = new Logger(StockService.name);
  private syncing: Promise<void> | null = null;
  private syncAgain = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly expenses: ExpensesService,
    private readonly events: EventsGateway,
  ) {}

  private orgWhere(organizationId?: string) {
    return organizationId ? { organizationId } : {};
  }

  /** Loads every row and runs the lot math. */
  private async compute(organizationId?: string) {
    const [items, purchases, products, adjustments] = await Promise.all([
      this.prisma.stockItem.findMany({ where: this.orgWhere(organizationId), orderBy: { name: 'asc' } }),
      this.prisma.stockPurchase.findMany({
        where: this.orgWhere(organizationId),
        include: { lots: { orderBy: { createdAt: 'asc' } }, dailyExpense: { select: { id: true, amount: true } } },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.product.findMany({
        where: this.orgWhere(organizationId),
        include: { recipeLines: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.stockAdjustment.findMany({
        where: { stockItem: this.orgWhere(organizationId) },
        orderBy: { date: 'asc' },
      }),
    ]);

    const recipes = new Map<string, RecipeLine[]>();
    for (const p of products) {
      if (p.recipeLines.length) {
        recipes.set(
          p.id,
          p.recipeLines.map((l) => ({ itemId: l.stockItemId, quantity: l.quantity })),
        );
      }
    }
    const firstPurchase = purchases[0]?.date;
    const recipeIds = [...recipes.keys()];
    const orders =
      firstPurchase && recipeIds.length
        ? await this.prisma.dailyProduct.findMany({
            where: {
              productId: { in: recipeIds },
              status: { not: ProductOrderStatus.CANCELLED },
              OR: [{ date: { gte: firstPurchase } }, { date: null, createdAt: { gte: firstPurchase } }],
            },
            select: { productId: true, quantite: true, unitPrice: true, date: true, createdAt: true },
          })
        : [];
    const priceOf = new Map(products.map((p) => [p.id, p.sellingPrice]));
    const lots = purchases.flatMap((pu) =>
      pu.lots.map((l) => ({
        id: l.id,
        itemId: l.stockItemId,
        purchaseId: pu.id,
        date: pu.date,
        quantity: l.quantity,
        price: l.price,
      })),
    );
    const result = computeStock({
      items,
      lots,
      recipes,
      sales: orders.map((o) => ({
        productId: o.productId,
        date: o.date ?? o.createdAt,
        qty: o.quantite,
        unitPrice: o.unitPrice ?? priceOf.get(o.productId) ?? 0,
      })),
      adjustments: adjustments.map((a) => ({ id: a.id, itemId: a.stockItemId, date: a.date, quantity: a.quantity })),
    });
    return { items, purchases, products, adjustments, result, orders };
  }

  async overview(organizationId?: string) {
    const { items, purchases, products, adjustments, result, orders } = await this.compute(organizationId);
    const itemById = new Map(items.map((i) => [i.id, i]));
    const productName = new Map(products.map((p) => [p.id, p.name]));
    const now = new Date();
    const DAY = 86_400_000;

    const soldSince = new Map<string, number>();
    for (const o of orders) soldSince.set(o.productId, (soldSince.get(o.productId) ?? 0) + o.quantite);

    const purchaseRows = purchases
      .map((pu) => {
        const lots = pu.lots.map((l) => {
          const r = result.lots.get(l.id)!;
          const item = itemById.get(l.stockItemId);
          const ir = result.items.get(l.stockItemId);
          const end = r.finishedAt ?? now;
          const usedNet = Math.max(0, r.used - r.lost);
          return {
            id: l.id,
            stockItemId: l.stockItemId,
            itemName: item?.name ?? '?',
            unit: item?.unit ?? 'pc',
            quantity: l.quantity,
            price: l.price,
            used: round3(r.used),
            left: round3(r.left),
            recovered: round2(r.recovered),
            result: round2(r.result),
            status: r.status,
            finishedAt: r.finishedAt,
            /** Days from purchase to the end (or today) */
            days: Math.max(1, Math.round((end.getTime() - pu.date.getTime()) / DAY)),
            /** Products made with this lot (fractions when one spans two lots) */
            gave: r.gave
              .map((g) => ({ productId: g.productId, name: productName.get(g.productId) ?? '?', units: round2(g.units), quantity: round3(g.quantity), recovered: round2(g.recovered) }))
              .sort((a, b) => b.units - a.units),
            sold: round3(usedNet),
            lost: round3(r.lost),
            /** Open lot: day it should run out at the recent pace */
            endsAround:
              r.status === 'OPEN' && ir && ir.dailyUse > 1e-9 ? new Date(now.getTime() + (r.left / ir.dailyUse) * DAY) : null,
          };
        });
        const invested = lots.reduce((s, l) => s + l.price, 0);
        const recovered = lots.reduce((s, l) => s + l.recovered, 0);
        return {
          id: pu.id,
          date: pu.date,
          source: pu.source,
          note: pu.note,
          dailyExpenseId: pu.dailyExpenseId,
          invested: round2(invested),
          recovered: round2(recovered),
          result: round2(recovered - invested),
          done: lots.every((l) => l.status === 'DONE'),
          lots,
        };
      })
      .reverse();

    const itemRows = items.map((i) => {
      const r = result.items.get(i.id)!;
      const itemLots = purchaseRows.flatMap((p) => p.lots.filter((l) => l.stockItemId === i.id).map((l) => ({ ...l, purchaseDate: p.date })));
      const current = itemLots.find((l) => l.id === r.currentLotId) ?? null;
      const reserve = itemLots.filter((l) => l.status === 'RESERVE').reduce((s, l) => s + l.left, 0);
      return {
        id: i.id,
        name: i.name,
        unit: i.unit,
        kind: i.kind,
        left: round3(r.left),
        unitCost: r.unitCost,
        dailyUse: round3(r.dailyUse),
        daysLeft: r.daysLeft == null ? null : Math.round(r.daysLeft * 10) / 10,
        uncovered: round3(r.uncovered),
        reserve: round3(reserve),
        hasLots: itemLots.length > 0,
        currentLot: current
          ? { id: current.id, quantity: current.quantity, left: current.left, price: current.price, purchaseDate: current.purchaseDate }
          : null,
        usedBy: products.filter((p) => p.recipeLines.some((l) => l.stockItemId === i.id)).map((p) => p.name),
      };
    });

    const productRows = products.map((p) => {
      const r = result.products.get(p.id);
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        img: p.img,
        sellingPrice: p.sellingPrice,
        purchasePrice: p.purchasePrice,
        stock: p.stock,
        tracked: !!r,
        unitCost: r ? round3(r.unitCost) : p.purchasePrice,
        possible: r ? r.possible : p.stock,
        limitedBy: r?.limitedBy ? itemById.get(r.limitedBy)?.name ?? null : null,
        soldSinceFirstPurchase: soldSince.get(p.id) ?? 0,
        recipe: p.recipeLines.map((l) => ({
          stockItemId: l.stockItemId,
          quantity: l.quantity,
          itemName: itemById.get(l.stockItemId)?.name ?? '?',
          unit: itemById.get(l.stockItemId)?.unit ?? 'pc',
          kind: itemById.get(l.stockItemId)?.kind ?? StockItemKind.INGREDIENT,
          cost: round3(l.quantity * (result.items.get(l.stockItemId)?.unitCost ?? 0)),
        })),
      };
    });

    const adjById = new Map(adjustments.map((a) => [a.id, a]));
    const losses = result.losses
      .map((l) => ({
        id: l.adjustmentId,
        date: l.date,
        stockItemId: l.itemId,
        itemName: itemById.get(l.itemId)?.name ?? '?',
        unit: itemById.get(l.itemId)?.unit ?? 'pc',
        quantity: l.quantity,
        amount: round2(l.amount),
        note: adjById.get(l.adjustmentId)?.note ?? null,
      }))
      .reverse();

    const invested = purchaseRows.reduce((s, p) => s + p.invested, 0);
    const recovered = purchaseRows.reduce((s, p) => s + p.recovered, 0);
    const stockValue = itemRows.reduce(
      (s, i) => s + purchaseRows.reduce((ss, p) => ss + p.lots.filter((l) => l.stockItemId === i.id).reduce((x, l) => x + (l.left * l.price) / (l.quantity || 1), 0), 0),
      0,
    );
    // Sales, cost and margin of every product, month by month (12 months).
    // Recipe products: cost of the lots really used. Others: purchase price × qty (estimate).
    const since = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const sold = await this.prisma.dailyProduct.findMany({
      where: {
        productId: { in: products.map((p) => p.id) },
        status: { notIn: [ProductOrderStatus.PENDING, ProductOrderStatus.CANCELLED] },
        OR: [{ date: { gte: since } }, { date: null, createdAt: { gte: since } }],
      },
      select: { productId: true, quantite: true, unitPrice: true, date: true, createdAt: true, product: { select: { sellingPrice: true } } },
    });
    const unitCostOf = new Map(productRows.map((p) => [p.id, p.unitCost]));
    const sales = new Map<string, Map<string, { qty: number; revenue: number; cost: number; estimated: boolean }>>();
    for (const o of sold) {
      const key = monthOf(o.date ?? o.createdAt);
      const byMonth = sales.get(o.productId) ?? new Map();
      const m = byMonth.get(key) ?? { qty: 0, revenue: 0, cost: 0, estimated: false };
      m.qty += o.quantite;
      m.revenue += orderUnitPrice(o) * o.quantite;
      byMonth.set(key, m);
      sales.set(o.productId, byMonth);
    }
    for (const [pid, byMonth] of sales) {
      const real = result.productMonths.get(pid);
      for (const [key, m] of byMonth) {
        const r = real?.get(key);
        // Real FIFO cost for the units the lots covered; the rest at today's cost
        const covered = r ? Math.min(r.qty, m.qty) : 0;
        m.cost = (r ? r.cost * (covered / (r.qty || 1)) : 0) + (m.qty - covered) * (unitCostOf.get(pid) ?? 0);
        m.estimated = covered < m.qty;
      }
    }
    const monthKeys = Array.from({ length: 12 }, (_, i) => monthOf(new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)));
    const purchasesByMonth: Record<string, number> = {};
    for (const p of purchaseRows) {
      const k = monthOf(new Date(p.date));
      purchasesByMonth[k] = round2((purchasesByMonth[k] ?? 0) + p.invested);
    }
    const salesRows = products
      .map((p) => {
        const byMonth = sales.get(p.id) ?? new Map();
        return {
          id: p.id,
          name: p.name,
          sellingPrice: p.sellingPrice,
          unitCost: unitCostOf.get(p.id) ?? p.purchasePrice,
          tracked: result.products.has(p.id),
          months: Object.fromEntries(
            [...byMonth.entries()].map(([k, m]) => [k, { qty: m.qty, revenue: round2(m.revenue), cost: round2(m.cost), estimated: m.estimated }]),
          ) as Record<string, { qty: number; revenue: number; cost: number; estimated: boolean }>,
        };
      })
      .filter((p) => Object.keys(p.months).length);

    return {
      sales: { months: monthKeys, products: salesRows, purchasesByMonth },
      totals: {
        invested: round2(invested),
        recovered: round2(recovered),
        result: round2(recovered - invested),
        stockValue: round2(stockValue),
        losses: round2(losses.reduce((s, l) => s + l.amount, 0)),
        purchases: purchaseRows.length,
        firstPurchaseDate: purchases[0]?.date ?? null,
      },
      items: itemRows,
      products: productRows,
      purchases: purchaseRows,
      losses,
    };
  }

  /* ---------- Items ---------- */

  async createItem(body: { name?: string; unit?: string; kind?: StockItemKind; organizationId?: string }) {
    const name = body.name?.trim();
    if (!name) throw new BadRequestException('Nom requis');
    const unit = UNITS.includes(body.unit as (typeof UNITS)[number]) ? body.unit! : 'pc';
    return this.prisma.stockItem.create({
      data: {
        name,
        unit,
        kind: body.kind === StockItemKind.UNIT ? StockItemKind.UNIT : StockItemKind.INGREDIENT,
        organizationId: body.organizationId || (await this.defaultOrgId()),
      },
    });
  }

  async updateItem(id: string, body: { name?: string; unit?: string }) {
    const data: { name?: string; unit?: string } = {};
    if (body.name?.trim()) data.name = body.name.trim();
    if (body.unit && UNITS.includes(body.unit as (typeof UNITS)[number])) data.unit = body.unit;
    return this.prisma.stockItem.update({ where: { id }, data });
  }

  async removeItem(id: string) {
    await this.prisma.stockItem.delete({ where: { id } });
    await this.syncProductStock();
    return { ok: true };
  }

  /** Inventory count: the real remaining amount. The gap with the computed stock is saved as an adjustment. */
  async count(id: string, body: { remaining?: number; note?: string }, organizationId?: string) {
    const remaining = Number(body.remaining);
    if (!Number.isFinite(remaining) || remaining < 0) throw new BadRequestException('Quantité invalide');
    const item = await this.prisma.stockItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Article introuvable');
    const { result } = await this.compute(organizationId ?? item.organizationId ?? undefined);
    const left = result.items.get(id)?.left ?? 0;
    const gap = round3(left - remaining);
    if (Math.abs(gap) < 1e-6) return { gap: 0 };
    await this.prisma.stockAdjustment.create({
      data: { stockItemId: id, quantity: gap, note: body.note?.trim() || null, date: new Date() },
    });
    await this.syncProductStock();
    return { gap };
  }

  async removeAdjustment(id: string) {
    await this.prisma.stockAdjustment.delete({ where: { id } });
    await this.syncProductStock();
    return { ok: true };
  }

  /* ---------- Recipes ---------- */

  /**
   * mode RECIPE: lines as given. UNIT: the product is its own stock item (created if needed).
   * NONE: no tracking, stock typed by hand.
   */
  async setRecipe(productId: string, body: { mode?: 'RECIPE' | 'UNIT' | 'NONE'; lines?: { stockItemId: string; quantity: number }[] }) {
    const product = await this.prisma.product.findUnique({ where: { id: productId }, include: { recipeLines: { include: { stockItem: true } } } });
    if (!product) throw new NotFoundException('Produit introuvable');
    let lines: { stockItemId: string; quantity: number }[] = [];
    if (body.mode === 'UNIT') {
      const existing = product.recipeLines.find((l) => l.stockItem.kind === StockItemKind.UNIT);
      const item =
        existing?.stockItem ??
        (await this.prisma.stockItem.create({
          data: { name: product.name, unit: 'pc', kind: StockItemKind.UNIT, organizationId: product.organizationId },
        }));
      lines = [{ stockItemId: item.id, quantity: 1 }];
    } else if (body.mode !== 'NONE') {
      const seen = new Set<string>();
      for (const l of body.lines ?? []) {
        const q = Number(l.quantity);
        if (!l.stockItemId || !(q > 0) || seen.has(l.stockItemId)) continue;
        seen.add(l.stockItemId);
        lines.push({ stockItemId: l.stockItemId, quantity: q });
      }
      if (!lines.length) throw new BadRequestException('Ajoute au moins un ingrédient');
    }
    await this.prisma.$transaction([
      this.prisma.productRecipeLine.deleteMany({ where: { productId } }),
      ...lines.map((l) => this.prisma.productRecipeLine.create({ data: { productId, ...l } })),
    ]);
    await this.syncProductStock();
    return { ok: true };
  }

  /* ---------- Purchases ---------- */

  async createPurchase(body: { date?: string; source?: string; note?: string; lines?: PurchaseLine[]; organizationId?: string }) {
    const lines = (body.lines ?? [])
      .map((l) => ({ stockItemId: l.stockItemId, quantity: Number(l.quantity), price: Number(l.price) }))
      .filter((l) => l.stockItemId && l.quantity > 0 && l.price >= 0);
    if (!lines.length) throw new BadRequestException('Ajoute au moins un article');
    const source = SOURCES.includes(body.source as (typeof SOURCES)[number]) ? body.source! : 'CAISSE';
    const items = await this.prisma.stockItem.findMany({ where: { id: { in: lines.map((l) => l.stockItemId) } } });
    if (items.length !== new Set(lines.map((l) => l.stockItemId)).size) throw new BadRequestException('Article introuvable');
    const byId = new Map(items.map((i) => [i.id, i]));
    const total = round2(lines.reduce((s, l) => s + l.price, 0));
    const date = parseLocalDay(body.date ?? null);
    const label =
      'Achat stock — ' + lines.map((l) => `${byId.get(l.stockItemId)!.name} ${qtyLabel(l.quantity, byId.get(l.stockItemId)!.unit)}`).join(', ');

    const expense =
      source !== 'NONE' && total > 0
        ? await this.expenses.createDailyExpense({ amount: total, label: label.slice(0, 180), date, source, Summary: body.note ?? null })
        : null;
    try {
      const purchase = await this.prisma.stockPurchase.create({
        data: {
          date,
          source,
          note: body.note?.trim() || null,
          organizationId: body.organizationId || items[0].organizationId || (await this.defaultOrgId()),
          dailyExpenseId: expense?.id ?? null,
          lots: { create: lines.map((l) => ({ stockItemId: l.stockItemId, quantity: l.quantity, price: l.price })) },
        },
      });
      await this.syncProductStock();
      return { ...purchase, total, expenseId: expense?.id ?? null };
    } catch (e) {
      if (expense) await this.prisma.dailyExpense.delete({ where: { id: expense.id } }).catch(() => undefined);
      throw e;
    }
  }

  async removePurchase(id: string) {
    const purchase = await this.prisma.stockPurchase.findUnique({ where: { id } });
    if (!purchase) throw new NotFoundException('Achat introuvable');
    await this.prisma.$transaction(async (tx) => {
      await tx.stockPurchase.delete({ where: { id } });
      if (purchase.dailyExpenseId) {
        await tx.coffreEntry.deleteMany({ where: { dailyExpenseId: purchase.dailyExpenseId } });
        await tx.dailyExpense.delete({ where: { id: purchase.dailyExpenseId } });
      }
    });
    await this.syncProductStock();
    return { ok: true };
  }

  /* ---------- Product stock ---------- */

  /**
   * Products with a recipe get their stock from the ingredients. Called after every sale,
   * purchase, count or recipe change. Runs one at a time; a call during a run queues one more.
   */
  syncProductStock(): Promise<void> {
    if (this.syncing) {
      this.syncAgain = true;
      return this.syncing;
    }
    this.syncing = (async () => {
      do {
        this.syncAgain = false;
        try {
          await this.syncOnce();
        } catch (e) {
          this.log.warn(`Stock sync failed: ${(e as Error).message}`);
        }
      } while (this.syncAgain);
    })().finally(() => {
      this.syncing = null;
    });
    return this.syncing;
  }

  private async syncOnce() {
    const orgs = await this.prisma.product.findMany({
      where: { recipeLines: { some: {} } },
      select: { organizationId: true },
      distinct: ['organizationId'],
    });
    for (const { organizationId } of orgs) {
      const { products, result } = await this.compute(organizationId ?? undefined);
      for (const p of products) {
        const r = result.products.get(p.id);
        if (!r) continue;
        const stock = Math.max(0, r.possible);
        if (stock === p.stock) continue;
        await this.prisma.product.update({ where: { id: p.id }, data: { stock } });
        this.events.sendProductUpdated({ type: 'product_updated', productId: p.id, name: p.name, stock });
      }
    }
  }

  private async defaultOrgId() {
    const org = await this.prisma.organization.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });
    return org?.id ?? null;
  }
}
