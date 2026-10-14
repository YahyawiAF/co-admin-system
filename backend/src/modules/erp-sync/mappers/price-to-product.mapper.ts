import { Price } from '@prisma/client';
import { ErpProductPayload } from '../types';

export function priceToProduct(price: Price): ErpProductPayload {
  return {
    name: price.name,
    description: `Tarif coworking (${price.category ?? price.type})`,
    price: price.price,
    sellingPrice: price.price,
    // No physical stock to track — supply-chain-pro treats a 0-stock product as an unstocked/service item.
    stock: 0,
  };
}
