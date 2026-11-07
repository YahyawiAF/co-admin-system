import { round1 } from '../analytics/traffic';

export type SaleItem = { key: string; amount: number };
export type LinkedSale = {
  kind: string;
  id: string;
  label: string;
  /** Sales / tickets / uses counted */
  count: number;
  revenue: number;
  /** Same as revenue, except a product (margin) */
  margin: number;
  discount: number;
  items: SaleItem[];
  stages: Array<{ label: string; value: number | null }>;
};

export function sale(
  kind: string,
  id: string,
  label: string,
  items: SaleItem[],
  discount: number,
  stages: LinkedSale['stages'],
  count = items.length,
): LinkedSale {
  const total = round1(items.reduce((a, i) => a + i.amount, 0));
  return { kind, id, label, count, revenue: total, margin: total, discount: round1(discount), items, stages };
}

/** Several tools' sales added up, each sale (key) once; the first tool that counted it keeps it. */
export function sumSales(sales: Array<LinkedSale | null>) {
  const seen = new Set<string>();
  let total = 0;
  let discount = 0;
  let count = 0;
  for (const s of sales) {
    if (!s) continue;
    discount += s.discount;
    count += s.count;
    for (const i of s.items) {
      if (seen.has(i.key)) continue;
      seen.add(i.key);
      total += i.amount;
    }
  }
  return { total: round1(total), discount: round1(discount), count };
}
