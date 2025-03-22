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

export enum Role {
  ADMIN = "ADMIN",
  USER = "USER",
}

export enum Subscription {
  NOPSubs = "NOPSubs",
  Monthly = "Monthly",
  Weekly = "Weekly",
}
export enum PriceType {
  journal = "journal",
  abonnement = "abonnement"
}


export interface User {
  [key: string]: any;
  id: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  email: string;
  fullname?: string | null;
  password?: string | null;
  refreshToken?: string | null;
  accessToken:  string;
  role: Role;
}

export interface Member {
  [key: string]: any;
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  functionality?: string | null;
  bio?: string | null;
  credits: number;
  phone: string;
  plan: Subscription;
  journals: Journal[];
  reservations: Reservation[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  isActive: boolean;
  fullName: string | null;
  fullNameWithEmail: string | null;
}

export interface Price {
  id: string;
  name:string;
  price: number;
  timePeriod: string; 
  createdAt: Date | null;
  updatedAt: Date | null;
  type:PriceType;
  journals: Journal[];
}

export interface Journal {
  [key: string]: any;
  id: string;
  isPayed: boolean;
  registredTime: Date;
  leaveTime?: Date | null;
  payedAmount: number;
  memberID?: string | null;
  member?: Member | null;
  createdAt: Date;
  updatedAt: Date;
  isReservation: boolean;
  priceId?: string | null;
  price?: Member | null;
}

export interface Reservation {
  id: string;
  isPayed: boolean;
  registredTime: Date;
  leaveTime?: Date | null;
  payedAmount: number;
  memberID?: string | null;
  member?: Member | null;
  createdAt: Date;
  updatedAt: Date;
}
