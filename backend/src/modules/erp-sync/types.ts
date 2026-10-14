/** Request payload shapes matching supply-chain-pro's existing REST DTOs — this project calls them, never defines them. */

export interface ErpCustomerPayload {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  notes?: string;
  sendWelcomeEmail?: boolean;
}

export interface ErpProductPayload {
  name: string;
  description?: string;
  price?: number;
  sellingPrice?: number;
  purchasePrice?: number;
  stock?: number;
  categoryId?: string;
}

export interface ErpCategoryPayload {
  name: string;
  slug: string;
  description?: string;
}

export interface ErpInvoiceItemPayload {
  productId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ErpInvoicePayload {
  customerId: string;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  tax: number;
  total: number;
  // Deliberately NOT 'paid'/amountPaid at create/update time: supply-chain-pro's own
  // invoice.service.ts auto-credits its cash drawer whenever paymentStatus is 'paid',
  // which requires an open caisse session there. The actual payment is recorded
  // separately via ErpPaymentPayload (fundSource: 'UNDECLARED'), which updates the
  // invoice's amountPaid/amountDue/paymentStatus on its own, without that side effect.
  amountPaid?: number;
  amountDue: number;
  notes?: string;
  invoiceItems: ErpInvoiceItemPayload[];
}

export interface ErpPaymentPayload {
  customerId: string;
  invoiceId?: string;
  amount: number;
  paymentMethod: 'cash' | 'bank_transfer' | 'check' | 'credit_card' | 'debit_card' | 'paypal' | 'other';
  // 'UNDECLARED' tells supply-chain-pro this money isn't moving through its own cash
  // drawer/vault/treasury — it was already handled in co-admin's own caisse. Without
  // this, a 'cash' paymentMethod defaults to CAISSE_DRAWER and requires an open
  // caisse session on the supply-chain-pro side, which has nothing to do with this sync.
  fundSource?: 'CAISSE_DRAWER' | 'CAISSE_VAULT' | 'TREASURY_ACCOUNT' | 'UNDECLARED';
  paymentDate?: string;
  reference?: string;
  notes?: string;
}

export interface ErpCreated {
  id: string;
}
