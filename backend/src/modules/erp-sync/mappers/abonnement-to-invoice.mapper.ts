import { Abonnement } from '@prisma/client';
import { ErpInvoicePayload } from '../types';

/**
 * Builds the sale record only — amountPaid/amountDue start at the unpaid baseline.
 * Actual money collected is recorded separately via a Payment per AbonnementPayment
 * (see SyncProcessorService), which is how supply-chain-pro itself updates
 * amountPaid/amountDue/paymentStatus.
 */
export function abonnementToInvoice(
  abonnement: Abonnement,
  externalCustomerId: string,
  externalProductId: string | null,
): ErpInvoicePayload {
  // abonnement.amountDue is co-admin's "price owed after discounts" — the sale total, not a payment-status field.
  const total = abonnement.amountDue ?? abonnement.payedAmount;
  const issueDate = abonnement.registredDate.toISOString();
  return {
    customerId: externalCustomerId,
    issueDate,
    dueDate: (abonnement.leaveDate ?? abonnement.registredDate).toISOString(),
    subtotal: total,
    tax: 0,
    total,
    amountPaid: 0,
    amountDue: total,
    notes: abonnement.promoLabel || undefined,
    invoiceItems: [
      {
        productId: externalProductId ?? undefined,
        name: abonnement.serviceName || 'Abonnement coworking',
        quantity: 1,
        unitPrice: total,
        total,
      },
    ],
  };
}
