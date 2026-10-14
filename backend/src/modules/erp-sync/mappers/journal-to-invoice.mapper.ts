import { Journal } from '@prisma/client';
import { ErpInvoicePayload } from '../types';

/**
 * Builds the sale record only — amountPaid/amountDue start at the unpaid baseline.
 * Actual money collected is recorded separately via a Payment (see SyncProcessorService),
 * which is how supply-chain-pro itself updates amountPaid/amountDue/paymentStatus.
 */
export function journalToInvoice(
  journal: Journal,
  externalCustomerId: string,
  externalProductId: string | null,
): ErpInvoicePayload {
  const total = journal.payedAmount;
  const issueDate = journal.registredTime.toISOString();
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
        name: journal.serviceName || 'Visite coworking',
        quantity: 1,
        unitPrice: total,
        total,
      },
    ],
  };
}
