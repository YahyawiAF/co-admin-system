import { BadRequestException } from '@nestjs/common';
import { PriceCategory, SpaceReserveMode } from '@prisma/client';

export function spaceAllowsSeat(mode?: SpaceReserveMode | null) {
  return (mode || SpaceReserveMode.BOTH) !== SpaceReserveMode.WHOLE;
}

export function spaceAllowsWhole(mode?: SpaceReserveMode | null) {
  return (mode || SpaceReserveMode.BOTH) !== SpaceReserveMode.SEAT;
}

export function defaultReserveMode(
  category?: PriceCategory | null,
): SpaceReserveMode {
  if (category === PriceCategory.SALLE) return SpaceReserveMode.WHOLE;
  if (category === PriceCategory.OPEN_SPACE) return SpaceReserveMode.BOTH;
  return SpaceReserveMode.SEAT;
}

export function defaultOccupy(category?: PriceCategory | null) {
  if (category === PriceCategory.SALLE) {
    return { occupySeat: false, occupyWhole: true };
  }
  if (category === PriceCategory.OPEN_SPACE) {
    return { occupySeat: true, occupyWhole: true };
  }
  return { occupySeat: true, occupyWhole: false };
}

export function linkedSpaceIds(price: {
  spaceId?: string | null;
  offerSpaces?: { spaceId: string }[];
}): string[] {
  const ids = [
    ...(price.offerSpaces || []).map((o) => o.spaceId),
    ...(price.spaceId ? [price.spaceId] : []),
  ];
  return [...new Set(ids.filter(Boolean))];
}

const VISIT_CATS = new Set<string>([
  PriceCategory.JOURNEE,
  PriceCategory.OPEN_SPACE,
  PriceCategory.SALLE,
]);

const ALL_PRICE_CATS = new Set<string>([
  ...VISIT_CATS,
  PriceCategory.ABONNEMENT,
]);

export function spaceCategoriesOf(space: {
  name?: string | null;
  category?: PriceCategory | string | null;
  categories?: (PriceCategory | string | null)[] | null;
}): PriceCategory[] {
  const fromList = (space.categories || []).filter((c): c is PriceCategory =>
    VISIT_CATS.has(c || ''),
  ) as PriceCategory[];
  if (fromList.length) return [...new Set(fromList)];
  if (space.category && VISIT_CATS.has(space.category)) {
    return [space.category as PriceCategory];
  }
  if (/salle|r[ée]union|meeting/i.test(space.name || '')) {
    return [PriceCategory.SALLE];
  }
  if (/open|ouvert/i.test(space.name || '')) {
    return [PriceCategory.OPEN_SPACE];
  }
  return [PriceCategory.JOURNEE];
}

export function priceCategoriesOf(price: {
  category?: PriceCategory | string | null;
  categories?: (PriceCategory | string | null)[] | null;
}): PriceCategory[] {
  const fromList = (price.categories || []).filter((c): c is PriceCategory =>
    ALL_PRICE_CATS.has(c || ''),
  ) as PriceCategory[];
  if (fromList.length) return [...new Set(fromList)];
  if (price.category && ALL_PRICE_CATS.has(price.category)) {
    return [price.category as PriceCategory];
  }
  return [];
}

export function priceMatchesSpaceCategories(
  price: {
    category?: PriceCategory | string | null;
    categories?: (PriceCategory | string | null)[] | null;
  },
  space: {
    name?: string | null;
    category?: PriceCategory | string | null;
    categories?: (PriceCategory | string | null)[] | null;
  },
): boolean {
  const pc = priceCategoriesOf(price);
  if (!pc.length || pc.includes(PriceCategory.ABONNEMENT)) return true;
  const sc = spaceCategoriesOf(space);
  return pc.some((c) => sc.includes(c));
}

export function assertPriceCanOccupy(opts: {
  price: {
    occupySeat?: boolean;
    occupyWhole?: boolean;
    category?: PriceCategory | string | null;
    categories?: (PriceCategory | string | null)[] | null;
    spaceId?: string | null;
    offerSpaces?: { spaceId: string }[];
  };
  space: {
    id: string;
    name: string;
    category?: PriceCategory | string | null;
    categories?: (PriceCategory | string | null)[] | null;
    reserveMode?: SpaceReserveMode | null;
  };
  mode: 'seat' | 'whole';
}) {
  const ids = linkedSpaceIds(opts.price);
  if (ids.length && !ids.includes(opts.space.id)) {
    throw new BadRequestException(
      `Le forfait n’est pas proposé dans ${opts.space.name}`,
    );
  }
  if (!ids.length && !priceMatchesSpaceCategories(opts.price, opts.space)) {
    throw new BadRequestException(
      `Ce forfait ne correspond pas à ${opts.space.name}`,
    );
  }
  if (opts.mode === 'seat') {
    if (opts.price.occupySeat === false) {
      throw new BadRequestException(
        'Ce forfait réserve l’espace entier, pas une place',
      );
    }
    if (!spaceAllowsSeat(opts.space.reserveMode)) {
      throw new BadRequestException(
        `${opts.space.name} se réserve entièrement, pas par place`,
      );
    }
  } else {
    if (!opts.price.occupyWhole) {
      throw new BadRequestException(
        'Ce forfait ne permet pas de réserver l’espace entier',
      );
    }
    if (!spaceAllowsWhole(opts.space.reserveMode)) {
      throw new BadRequestException(
        `${opts.space.name} se réserve uniquement par place`,
      );
    }
  }
}
