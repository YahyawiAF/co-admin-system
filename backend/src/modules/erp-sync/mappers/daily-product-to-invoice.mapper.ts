import { DailyProduct, Product } from '@prisma/client';
import { ErpInvoicePayload } from '../types';

/**
 * Builds the sale record only — amountPaid/amountDue start at the unpaid baseline.
 * Actual money collected (if dailyProduct.isPayed) is recorded separately via a
 * Payment (see SyncProcessorService), which is how supply-chain-pro itself updates
 * amountPaid/amountDue/paymentStatus.
 */
export function dailyProductToInvoice(
  dailyProduct: DailyProduct & { product: Product },
  externalCustomerId: string,
  externalProductId: string | null,
): ErpInvoicePayload {
  const unitPrice = dailyProduct.unitPrice ?? dailyProduct.product.sellingPrice;
  const total = Math.round(unitPrice * dailyProduct.quantite * 100) / 100;
  const issueDate = (dailyProduct.date ?? dailyProduct.createdAt).toISOString();
  return {
    customerId: externalCustomerId,
    issueDate,
    dueDate: issueDate,
    subtotal: total,
    tax: 0,
    total,
    amountPaid: 0,
    amountDue: total,
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
