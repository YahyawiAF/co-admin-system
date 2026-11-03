import { promoOutsidePrice, promoShare } from './session-pricing-context';

describe('promo on a pass change (Régler)', () => {
  it('keeps the same share of the new pass', () => {
    // −20 % on a 5 DT pass → 1 DT off; on a 10 DT pass it is 2 DT
    const share = promoShare({ priceBeforePromo: 5, promoDiscount: 1 });
    expect(share).toBeCloseTo(0.2);
    expect(10 * (1 - share)).toBeCloseTo(8);
  });

  it('is 0 without a promo', () => {
    expect(promoShare({ priceBeforePromo: 5, promoDiscount: null })).toBe(0);
    expect(promoShare({ priceBeforePromo: null, promoDiscount: 1 })).toBe(0);
  });

  it('does not take the promo off twice when the pass price carries it', () => {
    expect(
      promoOutsidePrice({ pricingMode: 'FIXED', fixedAmount: 4, priceBeforePromo: 5, promoDiscount: 1 }),
    ).toBe(0);
  });

  it('takes it off for auto pricing or an older pass stored before promo', () => {
    expect(promoOutsidePrice({ pricingMode: 'AUTO', fixedAmount: null, promoDiscount: 1 })).toBe(1);
    expect(
      promoOutsidePrice({ pricingMode: 'FIXED', fixedAmount: 5, priceBeforePromo: 5, promoDiscount: 1 }),
    ).toBe(1);
  });
});
