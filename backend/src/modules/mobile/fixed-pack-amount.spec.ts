import { fixedPackAmount } from './session-pricing-context';

const pack = { id: 'p4h', name: '4h', price: 10, durationHours: 4, billingUnit: 'PACK', category: 'OPEN_SPACE' };
const base = {
  registredTime: new Date(),
  priceId: 'p4h',
  fixedPriceId: 'p4h',
  prices: pack,
};

describe('fixedPackAmount', () => {
  it('applies the member discount to a pack stored at full price', () => {
    expect(
      fixedPackAmount({ ...base, fixedAmount: 10, members: { discountOpenSpace: 20 } }),
    ).toBe(8);
  });

  it('applies the group discount too', () => {
    expect(
      fixedPackAmount({ ...base, fixedAmount: 10, members: { group: { discountForfait: 30 } } }),
    ).toBe(7);
  });

  it('keeps a price that already carries the discount', () => {
    expect(
      fixedPackAmount({ ...base, fixedAmount: 8, members: { discountOpenSpace: 20 } }),
    ).toBe(8);
  });

  it('keeps the stored price when a promo was applied', () => {
    expect(
      fixedPackAmount({ ...base, fixedAmount: 10, promoDiscount: 2, members: { discountOpenSpace: 20 } }),
    ).toBe(10);
  });

  it('keeps the stored price without discount', () => {
    expect(fixedPackAmount({ ...base, fixedAmount: 10, members: {} })).toBe(10);
  });
});
