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

export function assertPriceCanOccupy(opts: {
  price: {
    occupySeat?: boolean;
    occupyWhole?: boolean;
    category?: PriceCategory | string | null;
    spaceId?: string | null;
    offerSpaces?: { spaceId: string }[];
  };
  space: {
    id: string;
    name: string;
    category?: PriceCategory | string | null;
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
  if (
    !ids.length &&
    opts.price.category &&
    opts.price.category !== PriceCategory.ABONNEMENT &&
    opts.space.category &&
    opts.space.category !== opts.price.category
  ) {
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
