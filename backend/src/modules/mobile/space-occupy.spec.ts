import { PriceCategory } from '@prisma/client';
import { priceCategoriesFor } from './space-occupy';

describe('priceCategoriesFor (promo scopes)', () => {
  it('counts an Open space time pack as Journée too (app promo scoped to Journée)', () => {
    expect(
      priceCategoriesFor({ categories: [PriceCategory.OPEN_SPACE], billingUnit: 'PACK', type: 'journal' }),
    ).toEqual([PriceCategory.OPEN_SPACE, PriceCategory.JOURNEE]);
  });

  it('keeps hourly Open space and meeting-room packs out of Journée', () => {
    expect(
      priceCategoriesFor({ categories: [PriceCategory.OPEN_SPACE], billingUnit: 'HOURLY', type: 'journal' }),
    ).toEqual([PriceCategory.OPEN_SPACE]);
    expect(
      priceCategoriesFor({ categories: [PriceCategory.SALLE], billingUnit: 'PACK', type: 'journal' }),
    ).toEqual([PriceCategory.SALLE]);
  });

  it('keeps abonnements out of Journée', () => {
    expect(
      priceCategoriesFor({ categories: [PriceCategory.ABONNEMENT], billingUnit: 'PERIOD', type: 'abonnement' }),
    ).toEqual([PriceCategory.ABONNEMENT]);
  });

  it('falls back on the tarif type when uncategorised', () => {
    expect(priceCategoriesFor({ type: 'abonnement' })).toEqual([PriceCategory.ABONNEMENT]);
    expect(priceCategoriesFor({ type: 'journal' })).toEqual([PriceCategory.JOURNEE]);
  });
});
