import { Product } from '@prisma/client';
import { ErpProductPayload } from '../types';

/**
 * Café/goods products (coffee, snacks...) — unlike tariffs, these have real stock and cost.
 * Synced as a plain stocked Product; turning it into a recipe (ingredients, yield, labor)
 * is deliberately left for the user to do inside supply-chain-pro itself once it lands there.
 */
export function productToErpProduct(product: Product): ErpProductPayload {
  return {
    name: product.name,
    description: product.description || undefined,
    price: product.sellingPrice,
    sellingPrice: product.sellingPrice,
    purchasePrice: product.purchasePrice,
    stock: product.stock,
  };
}
