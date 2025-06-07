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
  Journal = "Journal",
  Membership = "Membership",
}
export enum PriceType {
  journal = "journal",
  abonnement = "abonnement",
}
export interface TimeInterval {
  start: string;
  end: string;
}

export interface User {
  [key: string]: any;
  id: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  email: string;
  img?: string;
  fullname?: string | null;
  password?: string | null;
  refreshToken?: string | null;
  accessToken: string;
  role: Role;
  resetPasswordToken: string;
  phoneNumber: string;
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
  name: string;
  price: number;
  timePeriod: TimeInterval;
  createdAt: Date | null;
  updatedAt: Date | null;
  type: PriceType;
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
  price?: Price | null;
  expenses?: Expenses[];
  expenseIds?: string[];
}

export interface Abonnement {
  id: string;
  isPayed: boolean;
  registredDate: Date;
  leaveDate?: Date | null;
  stayedPeriode?: string | null;
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
export interface Expenses {
  id: string;
  name: string;
  description?: string;
  amount: number;
  type: ExpenseType;
  createdAt: string;
  updatedAt: string;
}
export interface DailyExpense {
  id: string;
  expenseId: string;
  date?: string;
  Summary?: string;
  createdAt: string;
  updatedAt: string;
  expense: Expenses;
}
export interface Product {
  id: string;
  name: string;
  description?: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  img?: string;
  createdAt: string;
  updatedAt: string;
}
export interface DailyProduct {
  id: string;
  productId: string;
  quantite: number;
  createdAt: string;
  date?: string;
  updatedAt: string;
  product: Product;
}
export interface Facility {
  id: string;
  name: string;
  numtel: string;
  email: string;
  adresse: string;
  logo?: string | null;
  nbrPlaces: number;
  socialNetworks: Record<string, string>;
  places: Record<string, unknown>;
  createdAt: string | Date;
  updatedAt: string | Date;
}
export interface SeatBooking {
  id: string;
  eventKey: string;
  seatId: string;
  isBooked: boolean;
  bookedAt?: string;
  memberId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookSeatsPayload {
  eventKey: string;
  seats: string[];
  memberId: string;
}

export interface BookingResponse {
  id: string;
  eventKey: string;
  seatId: string;
  memberId: string | null;
  isBooked: boolean;
  bookedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  success: boolean;
}

export enum ExpenseType {
  MENSUEL = "MENSUEL",
  JOURNALIER = "JOURNALIER",
}
