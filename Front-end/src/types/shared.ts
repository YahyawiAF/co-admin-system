export type Balance = {
  credit_limit: number;
  outstanding: number;
  payment_date: string;
  company_id: string;
};

export type TransactionRes = {
  company_id: string;
  transactions: Array<Transactions>;
};

export type Transactions = {
  [key: string]: any;
  transactionId: string;
  bookingDate: string;
  valueDate: string;
  transactionAmount: {
    amount: string;
    currency: string;
  };
  creditorName: string;
  creditorAccount: {
    iban: string;
    currency: string;
  };
  debtorName: string;
  debtorAccount: {
    iban: string;
    currency: string;
  };
  cardNo: string;
  department: string;
  avatar: string;
  remittanceInformationUnstructured: string;
  bankTransactionCode: string;
  proprietaryBankTransactionCode: string;
  internalTransactionId: string;
  status: string;
  id: string;
};

export type Expense = {
  day: string;
  value: number;
};

export type ExpensesRes = {
  company_id: string;
  expenses: Expense[];
};

export type User = {
  [key: string]: any;
  id: string;
  fullName: string;
  plan: string;
  price: number;
  inscriptionDate?: string | null;
  createdOn: Date;
  email: string;
  birthdate?: string | null;
  starting?: string;
  payed: any;
};

export type Journal = {
  [key: string]: any;
  id: string;
  isPayed: boolean;
  registredTime: Date;
  leaveTime: Date | null;
  payedAmount: number;
  userId: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export interface Card {
  [key: string]: any;
  id: string;
  isPhysical: boolean;
  expiry: string;
  lockCard: null | any; // Assuming lockCard can be null or any other type
  name: string;
  cardNumberHidden: string;
  limits: {
    type: string;
    total: number;
  };
  address: string;
  comment: string;
  status?: string;
}

export interface CardRes {
  company_id: string;
  cards: Card[];
}

export type StatusCard = "approved" | "pending approval" | "unapproved";

export interface Filters {
  query?: string | undefined;
  date?: string | undefined;
  myTransaction?: boolean | undefined;
}
