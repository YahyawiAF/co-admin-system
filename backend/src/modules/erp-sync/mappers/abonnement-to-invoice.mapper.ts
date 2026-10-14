import { Abonnement } from '@prisma/client';
import { ErpInvoicePayload } from '../types';

export function abonnementToInvoice(
  abonnement: Abonnement,
  externalCustomerId: string,
  externalProductId: string | null,
): ErpInvoicePayload {
  const total = abonnement.amountDue ?? abonnement.payedAmount;
  const amountPaid = abonnement.payedAmount;
  const issueDate = abonnement.registredDate.toISOString();
  return {
    customerId: externalCustomerId,
    issueDate,
    dueDate: (abonnement.leaveDate ?? abonnement.registredDate).toISOString(),
    subtotal: total,
    tax: 0,
    total,
    amountPaid,
    amountDue: Math.max(0, Math.round((total - amountPaid) * 100) / 100),
    paymentStatus: amountPaid >= total && total > 0 ? 'paid' : 'pending',
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
