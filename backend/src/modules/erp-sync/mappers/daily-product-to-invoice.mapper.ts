import { DailyProduct, Product } from '@prisma/client';
import { ErpInvoicePayload } from '../types';

export function dailyProductToInvoice(
  dailyProduct: DailyProduct & { product: Product },
  externalCustomerId: string,
  externalProductId: string | null,
): ErpInvoicePayload {
  const unitPrice = dailyProduct.unitPrice ?? dailyProduct.product.sellingPrice;
  const total = Math.round(unitPrice * dailyProduct.quantite * 100) / 100;
  const amountPaid = dailyProduct.isPayed ? total : 0;
  const issueDate = (dailyProduct.date ?? dailyProduct.createdAt).toISOString();
  return {
    customerId: externalCustomerId,
    issueDate,
    dueDate: issueDate,
    subtotal: total,
    tax: 0,
    total,
    amountPaid,
    amountDue: Math.max(0, Math.round((total - amountPaid) * 100) / 100),
    paymentStatus: amountPaid >= total && total > 0 ? 'paid' : 'pending',
    invoiceItems: [
      {
        productId: externalProductId ?? undefined,
        name: dailyProduct.product.name,
        quantity: dailyProduct.quantite,
        unitPrice,
        total,
      },
    ],
  };
}
