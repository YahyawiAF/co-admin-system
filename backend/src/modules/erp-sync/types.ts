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
  amountPaid?: number;
  amountDue: number;
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded';
  notes?: string;
  invoiceItems: ErpInvoiceItemPayload[];
}

export interface ErpPaymentPayload {
  customerId: string;
  invoiceId?: string;
  amount: number;
  paymentMethod: 'cash' | 'bank_transfer' | 'check' | 'credit_card' | 'debit_card' | 'paypal' | 'other';
  paymentDate?: string;
  reference?: string;
  notes?: string;
}

export interface ErpCreated {
  id: string;
}
