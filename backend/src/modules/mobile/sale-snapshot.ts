import { Price } from '@prisma/client';

export type SaleSnapshot = {
  serviceName: string;
  listPrice: number;
  spaceId?: string | null;
  spaceName?: string | null;
};

export function saleSnapshotFromPrice(
  price: Pick<Price, 'name' | 'price'> & {
    spaceId?: string | null;
    space?: { id?: string; name?: string } | null;
  },
  space?: { id?: string | null; name?: string | null } | null,
): SaleSnapshot {
  const spaceId =
    space?.id ||
    price.spaceId ||
    price.space?.id ||
    null;
  const spaceName = space?.name || price.space?.name || null;
  return {
    serviceName: price.name,
    listPrice: Number(price.price) || 0,
    spaceId: spaceId || null,
    spaceName: spaceName || null,
  };
}
