import type { StockOverview, StockPurchaseRow, StockUnit } from "@/lib/api/resources";
import { buyUnit } from "./stock-ui";

/** One article bought: a lot with its purchase details. */
export type Buy = {
  lotId: string;
  purchaseId: string;
  stockItemId: string;
  itemName: string;
  unit: StockUnit;
  date: string;
  /** Base unit (g, ml, pc) */
  quantity: number;
  price: number;
  paid: boolean;
  source: StockPurchaseRow["source"];
  paidAt: string | null;
  supplier: string | null;
  /** Other articles bought in the same purchase */
  others: string[];
};

/** Every article bought, newest first. */
export function allBuys(overview: StockOverview): Buy[] {
  return overview.purchases.flatMap((p) =>
    p.lots.map((l) => ({
      lotId: l.id,
      purchaseId: p.id,
      stockItemId: l.stockItemId,
      itemName: l.itemName,
      unit: l.unit,
      date: p.date,
      quantity: l.quantity,
      price: l.price,
      paid: p.paid !== false,
      source: p.source,
      paidAt: p.paidAt ?? null,
      supplier: p.supplier ?? null,
      others: p.lots.filter((x) => x.id !== l.id).map((x) => x.itemName),
    }))
  );
}

/** Purchases of one article, oldest first. */
export function itemBuys(overview: StockOverview, itemId: string) {
  return allBuys(overview)
    .filter((b) => b.stockItemId === itemId)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Average cost = all prices added up ÷ all quantity bought (DT per base unit). */
export function average(buys: { quantity: number; price: number }[]) {
  const total = buys.reduce((s, b) => s + b.price, 0);
  const quantity = buys.reduce((s, b) => s + b.quantity, 0);
  return { total, quantity, perBase: quantity > 0 ? total / quantity : 0 };
}

/** "0,917 DT / pc", "40,000 DT / kg" */
export function perBuyUnit(perBase: number, unit: StockUnit) {
  const bu = buyUnit(unit);
  return `${(perBase * bu.factor).toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DT / ${bu.label}`;
}

/** Payment label of a purchase */
export function payLabel(b: { paid: boolean; source: string }) {
  if (!b.paid) return "À payer";
  return { CAISSE: "Payé · Caisse", COFFRE: "Payé · Coffre", AUTRE: "Payé · Autre", NONE: "Stock de départ" }[b.source] ?? "Payé";
}

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
/** ISO date → yyyy-MM-dd in local time */
export const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
