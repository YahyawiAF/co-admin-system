import { Journal } from '@prisma/client';
import { ErpInvoicePayload } from '../types';

export function journalToInvoice(
  journal: Journal,
  externalCustomerId: string,
  externalProductId: string | null,
): ErpInvoicePayload {
  const total = journal.payedAmount;
  const amountPaid = journal.paidAmount ?? 0;
  const issueDate = journal.registredTime.toISOString();
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
        name: journal.serviceName || 'Visite coworking',
        quantity: 1,
        unitPrice: total,
        total,
      },
    ],
  };
}
