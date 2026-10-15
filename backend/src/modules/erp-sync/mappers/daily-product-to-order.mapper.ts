import { DailyProduct, Product } from '@prisma/client';
import { ErpOrderPayload } from '../types';
import { slugSku } from './to-order-helpers';

/**
 * Feeds supply-chain-pro's own per-product "Ventes" analytics (GET /products/:id/sales-*),
 * which reads only Order/OrderItem — never Invoice/InvoiceItem (see daily-product-to-invoice.mapper.ts,
 * which still creates the actual payment record). Returns null for a free item (total 0):
 * supply-chain-pro rejects a 0 TND order line outright.
 */
export function dailyProductToOrder(
  dailyProduct: DailyProduct & { product: Product },
  externalCustomerId: string,
  externalProductId: string,
): ErpOrderPayload | null {
  const unitPrice = dailyProduct.unitPrice ?? dailyProduct.product.sellingPrice;
  const total = Math.round(unitPrice * dailyProduct.quantite * 100) / 100;
  if (!(total > 0)) return null;
  return {
    customerId: externalCustomerId,
    status: 'delivered',
    subtotal: total,
    tax: 0,
    shipping: 0,
    total,
    shippingMethod: 'pickup',
    shippingAddress: {},
    paymentMethod: 'cash',
    allowStockShortage: true,
    orderItems: [
      {
        productId: externalProductId,
        name: dailyProduct.product.name,
        sku: slugSku(dailyProduct.product.name),
        price: unitPrice,
        quantity: dailyProduct.quantite,
        total,
      },
    ],
  };
}
