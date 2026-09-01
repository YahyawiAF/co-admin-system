export enum Role {
  SUPER_ADMIN = "SUPER_ADMIN",
  ORG_ADMIN = "ORG_ADMIN",
  FACILITY_ADMIN = "FACILITY_ADMIN",
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

export enum PriceCategory {
  JOURNEE = "JOURNEE",
  ABONNEMENT = "ABONNEMENT",
  SALLE = "SALLE",
  OPEN_SPACE = "OPEN_SPACE",
}

export enum BillingUnit {
  PACK = "PACK",
  HOURLY = "HOURLY",
  PERIOD = "PERIOD",
}

export interface TimeInterval {
  start: string;
  end: string;
}

export interface User {
  id: string;
  isActive: boolean;
  email?: string | null;
  fullname?: string | null;
  accessToken: string;
  refreshToken?: string | null;
  role: Role;
  phoneNumber?: string | null;
  organizations?: Array<{
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    membershipRole: Role;
  }>;
}

export interface Member {
  id: string;
  organizationId?: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  visitorNumber?: number | null;
  plan?: Subscription | null;
  credits?: number;
  isActive?: boolean;
  passwordHash?: string | null;
  bio?: string | null;
  functionality?: string | null;
  avatarUrl?: string | null;
  isSubscribed?: boolean;
  hasPin?: boolean;
  createdAt?: string;
  updatedAt?: string;
  groupId?: string | null;
  group?: MemberGroup | null;
  discountForfait?: number | null;
  discountSalle?: number | null;
  discountOpenSpace?: number | null;
  skills?: string[];
  services?: string[];
  linkedinUrl?: string | null;
  openToCollaboration?: boolean;
  showInDirectory?: boolean;
  isPresent?: boolean;
}

export interface MemberGroup {
  id: string;
  name: string;
  maxMembers: number;
  discountForfait: number;
  discountSalle: number;
  discountOpenSpace: number;
  members?: Member[];
  createdAt?: string;
  updatedAt?: string;
}

export type SeatOccupant = {
  memberId?: string | null;
  name: string;
  seatLabel: string;
  spaceName?: string | null;
};

export interface Price {
  id: string;
  name: string;
  price: number;
  timePeriod: TimeInterval;
  type: PriceType;
  category?: PriceCategory | null;
  durationHours?: number | null;
  billingUnit?: BillingUnit | null;
  periodDays?: number | null;
  spaceId?: string | null;
  spaceName?: string | null;
  reserveSeat?: boolean;
  reserveSeatFromHour?: number | null;
  reserveSeatToHour?: number | null;
  isActive?: boolean;
}

export interface Journal {
  id: string;
  isPayed: boolean;
  registredTime: string;
  leaveTime?: string | null;
  payedAmount: number;
  memberID?: string | null;
  members?: Member | null;
  member?: Member | null;
  priceId?: string | null;
  prices?: Price | null;
  price?: Price | null;
  isReservation: boolean;
  isAnonymous?: boolean;
  guestName?: string | null;
  groupVisitId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  createdbyUserID?: string | null;
  hasOpenDebt?: boolean;
  openDebtAmount?: number;
}

export type MobileSeatMode = 'ADMIN_ASSIGN' | 'VISITOR_CHOOSE' | 'AUTO_ASSIGN';

export type MobileSeatSettings = {
  facilityId: string | null;
  mobileSeatMode: MobileSeatMode;
  receptionAway: boolean;
  receptionAwayStartedAt?: string | null;
};

export type SeatAssignmentInfo = {
  seatLabel: string;
  tableName?: string | null;
  spaceName?: string | null;
  spaceId?: string | null;
  isOverflow?: boolean;
  wifiSsid?: string | null;
  wifiPassword?: string | null;
};

export interface Abonnement {
  id: string;
  isPayed: boolean;
  registredDate: string;
  leaveDate?: string | null;
  payedAmount: number;
  memberID: string;
  members?: Member | null;
  priceId: string;
  price?: Price | null;
  isReservation: boolean;
  hoursQuota?: number | null;
  hoursUsed?: number | null;
  reservedSeatLabel?: string | null;
  reservedSeatSpaceId?: string | null;
  kind?: "HOURS_POOL" | "SEMI_DAY" | "FULL_DAY" | null;
  daysRemaining?: number | null;
  hoursRemaining?: number | null;
}

export type ProductOrderStatus = "PENDING" | "CONFIRMED" | "CANCELLED";

export interface ProductOrder {
  id: string;
  productName: string;
  quantity: number;
  amount: number;
  img?: string | null;
  status: ProductOrderStatus;
  isPayed: boolean;
  createdAt: string;
  canEdit?: boolean;
  canCancel?: boolean;
  memberId?: string | null;
  memberName?: string | null;
  visitorNumber?: number | null;
  phone?: string | null;
  avatarUrl?: string | null;
  forfaitName?: string | null;
  seat?: SeatAssignmentInfo | null;
  label?: string;
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
  mobileSeatMode?: MobileSeatMode;
  receptionAway?: boolean;
  receptionAwayStartedAt?: string | null;
  organizationId?: string | null;
  spaces?: Space[];
}

export interface SpaceSeat {
  id: string;
  spaceId: string;
  tableId?: string | null;
  label: string;
  offsetX: number;
  offsetY: number;
  isOverflow: boolean;
  isActive: boolean;
}

export interface SpaceTable {
  id: string;
  spaceId: string;
  name: string;
  imageUrl?: string | null;
  galleryUrls?: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  sortOrder: number;
  seats?: SpaceSeat[];
}

export interface SpaceWall {
  id: string;
  spaceId: string;
  label?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export type FixtureKind =
  | "ARMCHAIR"
  | "TV"
  | "TRIANGLE"
  | "CIRCLE"
  | "DOOR"
  | "TOILET"
  | "KITCHEN"
  | "ARROW"
  | "STAIRS"
  | "TEXT";

export interface SpaceFixture {
  id: string;
  spaceId: string;
  kind: FixtureKind;
  label?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface Space {
  id: string;
  facilityId: string;
  name: string;
  category?: PriceCategory | string | null;
  floorPlanUrl?: string | null;
  sortOrder: number;
  capacityNormal: number;
  wifiSsid?: string | null;
  wifiPassword?: string | null;
  openForReservation?: boolean;
  galleryUrls?: string[];
  tables?: SpaceTable[];
  seats?: SpaceSeat[];
  walls?: SpaceWall[];
  fixtures?: SpaceFixture[];
}

export interface OccupancyStats {
  normalCapacity: number;
  normalOccupied: number;
  overflowCapacity: number;
  overflowOccupied: number;
  isFull: boolean;
}

export interface CaisseMovement {
  id: string;
  sessionId: string;
  type: string;
  amount: number;
  label?: string | null;
}

export interface CaisseSession {
  id: string;
  date: string;
  openedAt: string;
  closedAt?: string | null;
  openingFloat: number;
  countedClose?: number | null;
  expectedClose?: number | null;
  difference?: number | null;
  notes?: string | null;
  externalOrgId?: string | null;
  externalRef?: string | null;
  syncedAt?: string | null;
  movements?: CaisseMovement[];
}

export interface DayFinanceSummary {
  date: string;
  session: CaisseSession | null;
  revenueJournal: number;
  revenueAbonnements: number;
  revenueProducts: number;
  expenses: number;
  movementsIn: number;
  movementsOut: number;
  openingFloat: number;
  expectedClose: number;
  net: number;
  unpaidJournal: number;
  occupancy: OccupancyStats;
  journalsCount: number;
}

export interface CoffreEntry {
  id: string;
  date: string;
  type: "IN" | "OUT" | string;
  amount: number;
  label?: string | null;
  caisseSessionId?: string | null;
  createdAt: string;
}

export interface CoffreSummary {
  balance: number;
  entries: CoffreEntry[];
}

export interface MonthFinanceSummary {
  year: number;
  month: number;
  revenueJournal: number;
  revenueAbonnements: number;
  revenueProducts: number;
  expensesDaily: number;
  expensesMonthly: number;
  expenses: number;
  net: number;
  coffreIn: number;
  coffreOut: number;
  coffreNet: number;
  daysOpen: number;
  daysClosed: number;
  countedTotal: number;
  expectedTotal: number;
  sessions: Array<{
    date: string;
    closedAt?: string | null;
    openingFloat: number;
    countedClose?: number | null;
    expectedClose?: number | null;
    difference?: number | null;
  }>;
}

export type VisitRequestType = "DAY" | "SUBSCRIPTION";
export type VisitRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface VisitRequest {
  id: string;
  memberId: string;
  priceId: string;
  type: VisitRequestType;
  status: VisitRequestStatus;
  seatLabel?: string | null;
  spaceId?: string | null;
  autoApproved?: boolean;
  createdAt: string;
  member?: Member & { phone?: string | null; visitorNumber?: number | null };
  price?: Price;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    lastPage: number;
    currentPage: number;
    perPage: number;
    prev: number | null;
    next: number | null;
  };
}

export interface StaffMessage {
  id: string;
  toMemberId?: string;
  memberId?: string;
  text: string;
  createdAt: string;
  readAt?: string | null;
  from?: string;
  direction?: "TO_MEMBER" | "TO_STAFF";
  memberName?: string | null;
  visitorNumber?: number | null;
  phone?: string | null;
  avatarUrl?: string | null;
  unread?: boolean;
}

export interface MemberInsights {
  member: Member;
  totals: {
    visits: number;
    hours: number;
    spendVisits: number;
    spendCafe: number;
    spendSubscriptions: number;
    spendTotal: number;
  };
  routine: {
    typicalDays: { weekday: number; label: string; count: number }[];
    typicalArrivalHour: number | null;
    typicalDurationMin: number | null;
    favoriteSeat: string | null;
    favoriteProduct: string | null;
    favoriteForfait: string | null;
  };
  weekly: {
    weekStart: string;
    label: string;
    visits: number;
    hours: number;
    spend: number;
  }[];
  recentVisits: {
    id: string;
    registredTime: string;
    leaveTime?: string | null;
    payedAmount: number;
    isPayed: boolean;
    forfait: string | null;
    seats?: string[];
    lastSeat?: string | null;
    lastSpace?: string | null;
    seatChanges?: {
      from: string | null;
      to: string | null;
      at: string;
      spaceName?: string | null;
    }[];
  }[];
  recentOrders: {
    id: string;
    createdAt: string;
    productName: string;
    quantity: number;
    amount: number;
    isPayed: boolean;
  }[];
  subscriptions: {
    id: string;
    name: string;
    registredDate: string;
    leaveDate?: string | null;
    payedAmount: number;
    isPayed: boolean;
  }[];
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  isActive?: boolean;
  activatedAt?: string | null;
  notes?: string | null;
  createdAt?: string | null;
  memberCount?: number;
  facilityCount?: number;
  facility?: { id: string; name: string; logo?: string | null } | null;
}

export type EventKind = "WORKSHOP" | "NETWORKING" | "OTHER";
export type EventStatus = "DRAFT" | "PUBLISHED" | "CANCELLED";
export type EventRegistrationStatus =
  | "REGISTERED"
  | "CANCELLED"
  | "ATTENDED"
  | "NO_SHOW";

export interface SpaceEvent {
  id: string;
  facilityId: string;
  title: string;
  description?: string | null;
  kind: EventKind;
  location?: string | null;
  startAt: string;
  endAt: string;
  capacity?: number | null;
  status: EventStatus;
  coverImage?: string | null;
  registeredCount?: number;
  attendedCount?: number;
  spotsLeft?: number | null;
  registration?: {
    status: EventRegistrationStatus;
    attendanceCode: string;
    checkedInAt?: string | null;
    feedbackRating?: number | null;
    feedbackComment?: string | null;
  } | null;
}

export interface EventAttendee {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  functionality?: string | null;
  skills?: string[];
  services?: string[];
  linkedinUrl?: string | null;
  openToCollaboration?: boolean;
  avatarUrl?: string | null;
  bio?: string | null;
  showInDirectory?: boolean;
}

export type LedgerKind = "CREDIT" | "ECHEANCE";

export interface MemberLedgerEntry {
  id: string;
  memberId: string;
  kind: LedgerKind;
  amount: number;
  note?: string | null;
  dueDate?: string | null;
  source?: string | null;
  journalId?: string | null;
  abonnementId?: string | null;
  settled: boolean;
  createdAt: string;
  forfaitName?: string | null;
  visitDate?: string | null;
  visitIsPayed?: boolean | null;
}

export interface MemberAccountVisit {
  id: string;
  forfait: string | null;
  amount: number;
  isPayed: boolean;
  isOpen: boolean;
  registredTime: string;
  leaveTime?: string | null;
}

export interface MemberLedgerSummary {
  entries: MemberLedgerEntry[];
  owedByMember: number;
  owedToMember: number;
  net: number;
  todayVisit?: MemberAccountVisit | null;
  unpaidVisits?: MemberAccountVisit[];
  unpaidAbos?: {
    id: string;
    name: string;
    amount: number;
    registredDate: string;
  }[];
}

export type DebtorSource = "VISIT" | "ABONNEMENT" | "LEDGER";

export interface DebtorItem {
  id: string;
  source: DebtorSource;
  amount: number;
  date: string;
  settled: boolean;
  label: string;
  journalId?: string | null;
  abonnementId?: string | null;
  ledgerId?: string | null;
  memberId: string;
  memberName: string;
  visitorNumber: number | null;
  seatLabel?: string | null;
}

export interface DebtorMember {
  memberId: string;
  firstName: string;
  lastName?: string | null;
  visitorNumber: number | null;
  owedFromVisits: number;
  owedFromAbos: number;
  owedFromLedger: number;
  net: number;
  lastUnpaidAt: string | null;
  items: DebtorItem[];
}

export interface AwayArrival {
  memberId: string | null;
  name: string;
  visitorNumber: number | null;
  forfait: string | null;
  seatLabel: string | null;
  spaceName: string | null;
  arrivedAt: string;
  journalId?: string | null;
  autoApproved: boolean;
}

export interface AwayArrivalsResponse {
  startedAt: string | null;
  receptionAway: boolean;
  arrivals: AwayArrival[];
}

export type BookingRequestKind = "ROOM" | "SEAT";

export interface BookingRequest {
  id: string;
  memberId: string;
  kind: BookingRequestKind;
  spaceId?: string | null;
  spaceName?: string | null;
  seatLabel?: string | null;
  seatSpaceId?: string | null;
  date: string;
  startAt: string;
  endAt: string;
  note?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  journalId?: string | null;
  createdAt: string;
  memberName?: string | null;
  visitorNumber?: number | null;
  phone?: string | null;
  avatarUrl?: string | null;
}
