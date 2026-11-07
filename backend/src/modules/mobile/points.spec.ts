import { pointsToDt, redeemablePoints } from './points';

describe('points redeem (1000 pts = 1 DT)', () => {
  it('values points at 1000 per DT', () => {
    expect(pointsToDt(2000)).toBe(2);
    expect(pointsToDt(1000)).toBe(1);
  });

  it('only uses whole 1000-pt blocks', () => {
    expect(redeemablePoints(1200, 5)).toBe(1000);
    expect(redeemablePoints(999, 5)).toBe(0);
    expect(redeemablePoints(3200, 5)).toBe(3000);
  });

  it('never goes over the amount due', () => {
    expect(redeemablePoints(10000, 3.5)).toBe(3000);
    expect(redeemablePoints(10000, 3)).toBe(3000);
    expect(redeemablePoints(10000, 0.5)).toBe(0);
  });
});
