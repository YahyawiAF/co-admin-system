import { Abonnement } from '@prisma/client';
import { ErpOrderPayload } from '../types';
import { slugSku } from './to-order-helpers';

/**
 * Feeds supply-chain-pro's own per-product "Ventes" analytics (GET /products/:id/sales-*),
 * which reads only Order/OrderItem — never Invoice/InvoiceItem (see abonnement-to-invoice.mapper.ts,
 * which still creates the actual payment record). Returns null when fully covered by a promo
 * (total 0): supply-chain-pro rejects a 0 TND order line outright.
 */
export function abonnementToOrder(
  abonnement: Abonnement,
  externalCustomerId: string,
  externalProductId: string,
): ErpOrderPayload | null {
  const total = abonnement.amountDue ?? abonnement.payedAmount;
  if (!(total > 0)) return null;
  const name = abonnement.serviceName || 'Abonnement coworking';
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
    amountPaid: abonnement.payedAmount,
    allowStockShortage: true,
    notes: abonnement.promoLabel || undefined,
    orderItems: [
      {
        productId: externalProductId,
        name,
        sku: slugSku(name),
        price: total,
        quantity: 1,
        total,
      },
    ],
  };
}
