import { Journal } from '@prisma/client';
import { ErpOrderPayload } from '../types';
import { slugSku } from './to-order-helpers';

/**
 * Feeds supply-chain-pro's own per-product "Ventes" analytics (GET /products/:id/sales-*),
 * which reads only Order/OrderItem — never Invoice/InvoiceItem (see journal-to-invoice.mapper.ts,
 * which still creates the actual payment record). Returns null for a free visit (total 0):
 * supply-chain-pro rejects a 0 TND order line outright.
 */
export function journalToOrder(
  journal: Journal,
  externalCustomerId: string,
  externalProductId: string,
): ErpOrderPayload | null {
  const total = journal.payedAmount;
  if (!(total > 0)) return null;
  const name = journal.serviceName || 'Visite coworking';
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
    amountPaid: journal.paidAmount ?? 0,
    allowStockShortage: true,
    notes: journal.guestName ? `Visiteur : ${journal.guestName}` : undefined,
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
