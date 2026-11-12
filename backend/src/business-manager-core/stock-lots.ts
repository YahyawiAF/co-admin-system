/**
 * Stock by purchase lot: what was invested, what the sales brought back, what is left.
 *
 * - Every article bought is a lot. Sales use lots first in, first out (quantities).
 * - Cost is the AVERAGE cost: all purchases of the item added up ÷ total quantity bought
 *   (6 bottles for 5 DT + 6 for 6 DT → 11 ÷ 12 = 0.917 DT). A sale is valued with the
 *   average of the purchases made up to its date.
 * - A product sold uses ingredients (its recipe). Its price is split between those
 *   ingredients in proportion to their cost: that share is what the lot "recovered".
 * - Lot result = recovered − price paid. Inventory counts (adjustments) use stock
 *   without bringing money back: they are losses.
 *
 * Plain TypeScript, no database: the host loads rows and calls `computeStock`.
 */

export type StockItemInput = { id: string };
export type StockLotInput = {
  id: string;
  itemId: string;
  purchaseId: string;
  /** Purchase date */
  date: Date;
  /** Base unit (g, ml, pc) */
  quantity: number;
  /** DT paid for the whole lot */
  price: number;
};
export type RecipeLine = { itemId: string; quantity: number };
export type SaleInput = { productId: string; date: Date; qty: number; unitPrice: number };
export type AdjustmentInput = { id: string; itemId: string; date: Date; quantity: number };

export type LotStatus = 'OPEN' | 'RESERVE' | 'DONE';
/** What a lot fed: product units made with it (fractions when a unit spans two lots). */
export type LotGave = { productId: string; units: number; quantity: number; recovered: number };
export type LotResult = {
  id: string;
  used: number;
  left: number;
  recovered: number;
  result: number;
  status: LotStatus;
  finishedAt: Date | null;
  /** Products made with this lot */
  gave: LotGave[];
  /** Base units thrown away / lost (inventory counts) */
  lost: number;
};
/** One product in one month (yyyy-MM): units sold, money, cost of the lots really used. */
export type ProductMonth = { qty: number; revenue: number; cost: number };
export type ItemResult = {
  id: string;
  left: number;
  /** Average cost: DT per base unit, all purchases ÷ all quantity bought */
  unitCost: number;
  /** Lot in use, if any */
  currentLotId: string | null;
  /** Average daily use over the last `paceDays` days (base unit) */
  dailyUse: number;
  daysLeft: number | null;
  /** Used after every lot was empty (sold without stock recorded) */
  uncovered: number;
};
export type ProductResult = { productId: string; unitCost: number; possible: number; limitedBy: string | null };
export type LossResult = { adjustmentId: string; itemId: string; date: Date; quantity: number; amount: number };

export type StockResult = {
  lots: Map<string, LotResult>;
  items: Map<string, ItemResult>;
  products: Map<string, ProductResult>;
  losses: LossResult[];
  /** productId → month (yyyy-MM) → sales and cost (recipe products only) */
  productMonths: Map<string, Map<string, ProductMonth>>;
};

export const monthOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const EPS = 1e-9;
const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function computeStock(input: {
  items: StockItemInput[];
  lots: StockLotInput[];
  recipes: Map<string, RecipeLine[]>;
  sales: SaleInput[];
  adjustments: AdjustmentInput[];
  asOf?: Date;
  paceDays?: number;
}): StockResult {
  const asOf = input.asOf ?? new Date();
  const paceDays = input.paceDays ?? 14;

  const lotsByItem = new Map<string, StockLotInput[]>();
  for (const l of input.lots) {
    const arr = lotsByItem.get(l.itemId) ?? [];
    arr.push(l);
    lotsByItem.set(l.itemId, arr);
  }
  for (const arr of lotsByItem.values()) arr.sort((a, b) => a.date.getTime() - b.date.getTime());

  type LotState = { lot: StockLotInput; used: number; recovered: number; finishedAt: Date | null; gave: Map<string, LotGave>; lost: number };
  type ItemState = { lots: LotState[]; firstDay: number; uncovered: number; recentUse: number };
  const state = new Map<string, ItemState>();
  for (const item of input.items) {
    const arr = lotsByItem.get(item.id) ?? [];
    state.set(item.id, {
      lots: arr.map((lot) => ({ lot, used: 0, recovered: 0, finishedAt: null, gave: new Map(), lost: 0 })),
      firstDay: arr.length ? startOfDay(arr[0].date).getTime() : Infinity,
      uncovered: 0,
      recentUse: 0,
    });
  }
  /** Average cost per base unit of the purchases made up to `t` (all of them when none yet). */
  const avgAt = (st: ItemState, t = Infinity) => {
    let price = 0;
    let quantity = 0;
    for (const s of st.lots) {
      if (s.lot.date.getTime() > t) continue;
      price += s.lot.price;
      quantity += s.lot.quantity;
    }
    if (quantity <= EPS && t !== Infinity) return avgAt(st);
    return quantity > EPS ? price / quantity : 0;
  };
  /**
   * Takes `need` from the lots first in first out. Returns DT of stock used.
   * `product` = the sale it is for (with the recipe dose), null for a loss.
   */
  const consume = (st: ItemState, need: number, date: Date, revenue: number, product: { id: string; dose: number } | null = null) => {
    const total = need;
    const cost = avgAt(st, date.getTime());
    for (const s of st.lots) {
      if (need <= EPS) break;
      const room = s.lot.quantity - s.used;
      if (room <= EPS) continue;
      const take = Math.min(need, room);
      s.used += take;
      s.recovered += (revenue * take) / total;
      if (product) {
        const g = s.gave.get(product.id) ?? { productId: product.id, units: 0, quantity: 0, recovered: 0 };
        g.units += product.dose > 0 ? take / product.dose : 0;
        g.quantity += take;
        g.recovered += (revenue * take) / total;
        s.gave.set(product.id, g);
      } else {
        s.lost += take;
      }
      if (s.lot.quantity - s.used <= EPS) s.finishedAt = date;
      need -= take;
    }
    if (need > EPS) st.uncovered += need;
    return total * cost;
  };

  // One timeline for every item, so each sale is split with the prices of the lots it really used.
  type Event =
    | { kind: 'sale'; date: Date; sale: SaleInput }
    | { kind: 'adj'; date: Date; adj: AdjustmentInput };
  const timeline: Event[] = [
    ...input.sales.map((sale) => ({ kind: 'sale' as const, date: sale.date, sale })),
    ...input.adjustments.map((adj) => ({ kind: 'adj' as const, date: adj.date, adj })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  const losses: LossResult[] = [];
  const paceFrom = asOf.getTime() - paceDays * DAY;
  const productMonths = new Map<string, Map<string, ProductMonth>>();

  for (const e of timeline) {
    const t = e.date.getTime();
    if (e.kind === 'sale') {
      const recipe = input.recipes.get(e.sale.productId);
      if (!recipe?.length || e.sale.qty <= 0) continue;
      // Items not bought yet at that date are not tracked for this sale
      const lines = recipe
        .map((r) => ({ r, st: state.get(r.itemId) }))
        .filter((x): x is { r: RecipeLine; st: ItemState } => !!x.st && t >= x.st.firstDay);
      if (!lines.length) continue;
      const costs = lines.map(({ r, st }) => r.quantity * avgAt(st, t));
      const totalCost = costs.reduce((a, b) => a + b, 0);
      const money = e.sale.qty * e.sale.unitPrice;
      let cost = 0;
      lines.forEach(({ r, st }, i) => {
        const share = totalCost > EPS ? costs[i] / totalCost : 1 / lines.length;
        const need = e.sale.qty * r.quantity;
        if (t >= paceFrom) st.recentUse += need;
        cost += consume(st, need, e.date, money * share, { id: e.sale.productId, dose: r.quantity });
      });
      const byMonth = productMonths.get(e.sale.productId) ?? new Map<string, ProductMonth>();
      const m = byMonth.get(monthOf(e.date)) ?? { qty: 0, revenue: 0, cost: 0 };
      m.qty += e.sale.qty;
      m.revenue += money;
      m.cost += cost;
      byMonth.set(monthOf(e.date), m);
      productMonths.set(e.sale.productId, byMonth);
      continue;
    }
    const st = state.get(e.adj.itemId);
    if (!st || t < st.firstDay) continue;
    if (e.adj.quantity < 0) {
      // More than expected: give it back to the lot in use (or the last one emptied).
      let back = -e.adj.quantity;
      for (let i = st.lots.length - 1; i >= 0 && back > EPS; i--) {
        const s = st.lots[i];
        if (s.used <= EPS) continue;
        const take = Math.min(back, s.used);
        s.used -= take;
        s.finishedAt = null;
        back -= take;
      }
      losses.push({ adjustmentId: e.adj.id, itemId: e.adj.itemId, date: e.date, quantity: e.adj.quantity, amount: 0 });
    } else {
      const amount = consume(st, e.adj.quantity, e.date, 0);
      losses.push({ adjustmentId: e.adj.id, itemId: e.adj.itemId, date: e.date, quantity: e.adj.quantity, amount });
    }
  }

  const lots = new Map<string, LotResult>();
  const items = new Map<string, ItemResult>();
  for (const item of input.items) {
    const st = state.get(item.id)!;
    const current = st.lots.find((s) => s.lot.quantity - s.used > EPS) ?? null;
    for (const s of st.lots) {
      const left = Math.max(0, s.lot.quantity - s.used);
      const status: LotStatus = left <= EPS ? 'DONE' : s === current ? 'OPEN' : 'RESERVE';
      lots.set(s.lot.id, {
        id: s.lot.id,
        used: s.used,
        left,
        recovered: s.recovered,
        result: s.recovered - s.lot.price,
        status,
        finishedAt: status === 'DONE' ? s.finishedAt : null,
        gave: [...s.gave.values()],
        lost: s.lost,
      });
    }
    const left = st.lots.reduce((sum, s) => sum + Math.max(0, s.lot.quantity - s.used), 0);
    const window = Math.max(1, Math.min(paceDays, (asOf.getTime() - st.firstDay) / DAY));
    const dailyUse = Number.isFinite(st.firstDay) ? st.recentUse / window : 0;
    items.set(item.id, {
      id: item.id,
      left,
      unitCost: avgAt(st),
      currentLotId: current?.lot.id ?? null,
      dailyUse,
      daysLeft: dailyUse > EPS ? left / dailyUse : null,
      uncovered: st.uncovered,
    });
  }

  const products = new Map<string, ProductResult>();
  for (const [productId, recipe] of input.recipes) {
    if (!recipe.length) continue;
    let possible = Infinity;
    let limitedBy: string | null = null;
    let unitCost = 0;
    for (const r of recipe) {
      const it = items.get(r.itemId);
      unitCost += r.quantity * (it?.unitCost ?? 0);
      const n = r.quantity > 0 ? Math.floor(((it?.left ?? 0) + EPS) / r.quantity) : Infinity;
      if (n < possible) {
        possible = n;
        limitedBy = r.itemId;
      }
    }
    products.set(productId, {
      productId,
      unitCost,
      possible: Number.isFinite(possible) ? possible : 0,
      limitedBy,
    });
  }

  return { lots, items, products, losses, productMonths };
}
