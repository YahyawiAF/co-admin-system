import { computeStock, type RecipeLine } from './stock-lots';

const d = (day: number, h = 10) => new Date(2026, 9, day, h);

const items = [{ id: 'cafe' }, { id: 'lait' }, { id: 'gob' }];
const recipes = new Map<string, RecipeLine[]>([
  ['express', [{ itemId: 'cafe', quantity: 8 }, { itemId: 'gob', quantity: 1 }]],
  ['direct', [{ itemId: 'cafe', quantity: 8 }, { itemId: 'lait', quantity: 120 }, { itemId: 'gob', quantity: 1 }]],
]);
// café 48 DT / 1000 g → 0.048 per g → 0.384 per dose; lait 9.6 / 6000 ml; gobelets 8 / 100
const lots = [
  { id: 'c1', itemId: 'cafe', purchaseId: 'A1', date: d(1), quantity: 1000, price: 48 },
  { id: 'l1', itemId: 'lait', purchaseId: 'A1', date: d(1), quantity: 6000, price: 9.6 },
  { id: 'g1', itemId: 'gob', purchaseId: 'A1', date: d(1), quantity: 100, price: 8 },
];

describe('computeStock', () => {
  it('splits a sale between ingredients by cost and counts what is left', () => {
    const r = computeStock({
      items,
      lots,
      recipes,
      sales: [{ productId: 'express', date: d(2), qty: 10, unitPrice: 1.5 }],
      adjustments: [],
      asOf: d(3),
    });
    const cafe = r.lots.get('c1')!;
    const gob = r.lots.get('g1')!;
    expect(cafe.used).toBe(80);
    expect(r.items.get('cafe')!.left).toBe(920);
    // 15 DT split 0.384 : 0.08
    expect(cafe.recovered + gob.recovered).toBeCloseTo(15);
    expect(cafe.recovered).toBeCloseTo((15 * 0.384) / 0.464);
    expect(cafe.result).toBeCloseTo(cafe.recovered - 48);
    expect(cafe.status).toBe('OPEN');
  });

  it('possible count is limited by the scarcest ingredient', () => {
    const r = computeStock({
      items,
      lots,
      recipes,
      sales: [{ productId: 'direct', date: d(2), qty: 40, unitPrice: 2 }],
      adjustments: [],
      asOf: d(3),
    });
    // lait left 6000 − 4800 = 1200 → 10 directs
    expect(r.products.get('direct')!.possible).toBe(10);
    expect(r.products.get('direct')!.limitedBy).toBe('lait');
    expect(r.products.get('express')!.possible).toBe(60); // gobelets 100 − 40
    expect(r.products.get('express')!.unitCost).toBeCloseTo(0.464);
  });

  it('moves to the next lot first in first out, new price applies', () => {
    const r = computeStock({
      items: [{ id: 'cafe' }],
      lots: [
        { id: 'c1', itemId: 'cafe', purchaseId: 'A1', date: d(1), quantity: 100, price: 5 },
        { id: 'c2', itemId: 'cafe', purchaseId: 'A2', date: d(5), quantity: 100, price: 6 },
      ],
      recipes: new Map([['x', [{ itemId: 'cafe', quantity: 10 }]]]),
      sales: [{ productId: 'x', date: d(6), qty: 12, unitPrice: 1 }],
      adjustments: [],
      asOf: d(7),
    });
    expect(r.lots.get('c1')!.status).toBe('DONE');
    expect(r.lots.get('c1')!.recovered).toBeCloseTo(10);
    expect(r.lots.get('c2')!.used).toBe(20);
    expect(r.lots.get('c2')!.recovered).toBeCloseTo(2);
    // average cost: (5 + 6) ÷ 200
    expect(r.items.get('cafe')!.unitCost).toBeCloseTo(0.055);
  });

  it('a lot bought but not yet started is in reserve', () => {
    const r = computeStock({
      items: [{ id: 'cafe' }],
      lots: [
        { id: 'c1', itemId: 'cafe', purchaseId: 'A1', date: d(1), quantity: 100, price: 5 },
        { id: 'c2', itemId: 'cafe', purchaseId: 'A2', date: d(5), quantity: 100, price: 6 },
      ],
      recipes: new Map([['x', [{ itemId: 'cafe', quantity: 10 }]]]),
      sales: [{ productId: 'x', date: d(6), qty: 2, unitPrice: 1 }],
      adjustments: [],
      asOf: d(7),
    });
    expect(r.lots.get('c1')!.status).toBe('OPEN');
    expect(r.lots.get('c2')!.status).toBe('RESERVE');
    expect(r.items.get('cafe')!.left).toBe(180);
  });

  it('ignores sales before the first purchase and records uncovered use', () => {
    const r = computeStock({
      items: [{ id: 'cafe' }],
      lots: [{ id: 'c1', itemId: 'cafe', purchaseId: 'A1', date: d(5), quantity: 20, price: 2 }],
      recipes: new Map([['x', [{ itemId: 'cafe', quantity: 10 }]]]),
      sales: [
        { productId: 'x', date: d(2), qty: 5, unitPrice: 1 },
        { productId: 'x', date: d(6), qty: 3, unitPrice: 1 },
      ],
      adjustments: [],
      asOf: d(7),
    });
    expect(r.items.get('cafe')!.left).toBe(0);
    expect(r.items.get('cafe')!.uncovered).toBe(10);
    expect(r.lots.get('c1')!.recovered).toBeCloseTo(2);
  });

  it('inventory count: missing stock is a loss with no money back; extra stock goes back', () => {
    const r = computeStock({
      items: [{ id: 'cafe' }],
      lots: [{ id: 'c1', itemId: 'cafe', purchaseId: 'A1', date: d(1), quantity: 1000, price: 48 }],
      recipes: new Map(),
      sales: [],
      adjustments: [
        { id: 'a1', itemId: 'cafe', date: d(3), quantity: 30 },
        { id: 'a2', itemId: 'cafe', date: d(4), quantity: -10 },
      ],
      asOf: d(5),
    });
    expect(r.items.get('cafe')!.left).toBe(980);
    expect(r.losses[0].amount).toBeCloseTo(1.44);
    expect(r.losses[1].amount).toBe(0);
    expect(r.lots.get('c1')!.recovered).toBe(0);
  });

  it('daily use and days left come from recent sales', () => {
    const r = computeStock({
      items: [{ id: 'cafe' }],
      lots: [{ id: 'c1', itemId: 'cafe', purchaseId: 'A1', date: d(1, 8), quantity: 1000, price: 48 }],
      recipes: new Map([['x', [{ itemId: 'cafe', quantity: 10 }]]]),
      sales: [{ productId: 'x', date: d(3), qty: 50, unitPrice: 1 }],
      adjustments: [],
      asOf: d(11, 0),
    });
    // 500 g over 10 days → 50 g/day, 500 left → 10 days
    expect(r.items.get('cafe')!.dailyUse).toBeCloseTo(50);
    expect(r.items.get('cafe')!.daysLeft).toBeCloseTo(10);
  });

  it('a new lot bought at a higher price does not change how past sales were split', () => {
    const base = {
      items,
      recipes,
      sales: [{ productId: 'direct', date: d(2), qty: 20, unitPrice: 2 }],
      adjustments: [],
      asOf: d(3),
    };
    const before = computeStock({ ...base, lots });
    const after = computeStock({
      ...base,
      lots: [...lots, { id: 'l2', itemId: 'lait', purchaseId: 'A2', date: d(2, 18), quantity: 6000, price: 12 }],
    });
    for (const id of ['c1', 'l1', 'g1']) {
      expect(after.lots.get(id)!.recovered).toBeCloseTo(before.lots.get(id)!.recovered);
    }
    expect(after.lots.get('l2')!.status).toBe('RESERVE');
    // the cost shown is the average of every purchase
    expect(after.items.get('lait')!.unitCost).toBeCloseTo((9.6 + 12) / 12000);
  });

  it('a lot says what it made, and each product has its month of sales and cost', () => {
    const small = [{ id: 'c1', itemId: 'cafe', purchaseId: 'A1', date: d(1), quantity: 40, price: 2 }, ...lots.slice(1)];
    const r = computeStock({
      items,
      lots: [...small, { id: 'c2', itemId: 'cafe', purchaseId: 'A2', date: d(5), quantity: 1000, price: 48 }],
      recipes,
      sales: [
        { productId: 'express', date: d(2), qty: 3, unitPrice: 1.5 },
        { productId: 'direct', date: d(3), qty: 4, unitPrice: 2 },
      ],
      adjustments: [],
      asOf: d(10),
    });
    // 40 g = 5 doses: 3 express + 2 direct; the 2 other direct come from the next lot
    const c1 = r.lots.get('c1')!;
    expect(c1.status).toBe('DONE');
    expect(c1.gave.find((g) => g.productId === 'express')!.units).toBeCloseTo(3);
    expect(c1.gave.find((g) => g.productId === 'direct')!.units).toBeCloseTo(2);
    expect(r.lots.get('c2')!.gave[0].units).toBeCloseTo(2);
    const oct = r.productMonths.get('direct')!.get('2026-10')!;
    expect(oct.qty).toBe(4);
    expect(oct.revenue).toBe(8);
    // cost = average of what was bought by then (only c1: 0.05/g) + milk + cups
    expect(oct.cost).toBeCloseTo(32 * 0.05 + 480 * 0.0016 + 4 * 0.08);
  });

  it('average cost: 6 bottles for 5 DT + 6 for 6 DT = 11 ÷ 12 per bottle', () => {
    const r = computeStock({
      items: [{ id: 'eau' }],
      lots: [
        { id: 'e1', itemId: 'eau', purchaseId: 'A1', date: d(1), quantity: 6, price: 5 },
        { id: 'e2', itemId: 'eau', purchaseId: 'A2', date: d(8), quantity: 6, price: 6 },
      ],
      recipes: new Map([['bottle', [{ itemId: 'eau', quantity: 1 }]]]),
      sales: [
        { productId: 'bottle', date: d(3), qty: 2, unitPrice: 1.5 },
        { productId: 'bottle', date: d(9), qty: 3, unitPrice: 1.5 },
      ],
      adjustments: [],
      asOf: d(10),
    });
    expect(r.items.get('eau')!.unitCost).toBeCloseTo(11 / 12);
    expect(r.products.get('bottle')!.unitCost).toBeCloseTo(11 / 12);
    expect(r.items.get('eau')!.left).toBe(7);
    const oct = r.productMonths.get('bottle')!.get('2026-10')!;
    // before the 2nd purchase: 5/6 each; after: 11/12 each
    expect(oct.cost).toBeCloseTo(2 * (5 / 6) + 3 * (11 / 12));
  });
});
