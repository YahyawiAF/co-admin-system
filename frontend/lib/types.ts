export enum Role {
  SUPER_ADMIN = "SUPER_ADMIN",
  ORG_ADMIN = "ORG_ADMIN",
  FACILITY_ADMIN = "FACILITY_ADMIN",
  ADMIN = "ADMIN",
  /** Employee — access limited by per-module permissions */
  STAFF = "STAFF",
  USER = "USER",
}

export type StaffModule = "journal" | "reservations" | "impayes" | "abonnements";
/** none = cannot delete · hide = hidden for staff, admin decides · delete = real delete */
export type StaffDeleteMode = "none" | "hide" | "delete";
export type StaffModulePermission = {
  read: boolean;
  write: boolean;
  delete: StaffDeleteMode;
};
export type StaffPermissions = Record<StaffModule, StaffModulePermission>;

export interface StaffMember {
  id: string;
  fullname: string | null;
  email: string | null;
  phoneNumber: string | null;
  isActive: boolean;
  createdAt: string;
  permissions: StaffPermissions;
  pendingActions: number;
  lastActionAt: string | null;
}

export type StaffActionStatus = "PENDING" | "CONFIRMED" | "REVERTED";
export interface StaffActionRow {
  id: string;
  createdAt: string;
  userId: string;
  user: { id: string; fullname: string | null; email: string | null; phoneNumber: string | null };
  module: StaffModule;
  action: "CREATE" | "UPDATE" | "DELETE" | "HIDE";
  entityType: string;
  entityId: string | null;
  method: string;
  path: string;
  summary: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  status: StaffActionStatus;
  reviewedAt: string | null;
  reviewedBy: { id: string; fullname: string | null; email: string | null } | null;
  reviewNote: string | null;
  revertable: boolean;
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

export enum PromoValueKind {
  PERCENT = "PERCENT",
  FIXED_DT = "FIXED_DT",
}

export interface AppInstallPromo {
  id: string;
  facilityId?: string;
  priceId: string;
  valueKind: PromoValueKind;
  value: number;
  sortOrder?: number;
  isActive?: boolean;
  priceName?: string;
  priceAmount?: number;
}

export interface AppInstallGlobalPromo {
  valueKind: PromoValueKind;
  value: number;
  oneTime?: boolean;
  /** Tarif categories it applies to (empty = all) */
  scopes?: PriceCategory[];
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
    /** Present for STAFF users */
    permissions?: StaffPermissions;
  }>;
}

export interface Member {
  id: string;
  /** First visit ever is today ("Nouveau" badge). Members list only. */
  isFirstVisitToday?: boolean;
  /** Étudiant / Élève / Pro, asked in 1 tap at check-in */
  profileType?: "STUDENT" | "PUPIL" | "PRO" | null;
  heardFrom?: string | null;
  awayReason?: string | null;
  recallAt?: string | null;
  /** Members list: visit days, last visit, BACK | ONCE | AWAY | NONE */
  visitDays?: number;
  lastVisitAt?: string | null;
  returnStatus?: "BACK" | "ONCE" | "AWAY" | "NONE";
  organizationId?: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  visitorNumber?: number | null;
  plan?: Subscription | null;
  credits?: number;
  /** Gamification points credited in PWA */
  points?: number;
  /** When the member used the one-time app-install promo */
  appInstallPromoClaimedAt?: string | null;
  /** App-install promos already used (promo ids or "global"), each single-use */
  appInstallPromosUsed?: string[];
  /** First open as installed PWA */
  pwaInstalledAt?: string | null;
  /** False once the one-time install promo was used */
  appInstallPromoEligible?: boolean;
  /** True when promo can apply now (eligible + PWA installed) */
  appInstallPromoActive?: boolean;
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
  discountAbonnement?: number | null;
  discountSalle?: number | null;
  discountOpenSpace?: number | null;
  skills?: string[];
  services?: string[];
  linkedinUrl?: string | null;
  openToCollaboration?: boolean;
  showInDirectory?: boolean;
  isPresent?: boolean;
  availability?: MemberAvailability | null;
  /** "Recherche" tags */
  lookingFor?: string[];
  /** Community only: when the member arrived today (ISO) */
  presentSince?: string | null;
  /** Community only: current seat while present */
  seat?: CommunitySeat | null;
  /** "Focus du jour" — short status while on site (expires daily) */
  todayFocus?: string | null;
  /** Opt-in: streak & level visible on the public profile */
  shareAttendance?: boolean;
}

export type MemberAvailability = "OPEN_TO_CHAT" | "FOCUS";

/** "Fil du jour" note — wiped at midnight */
export type CommunityNote = {
  id: string;
  text: string;
  createdAt: string;
  isMine: boolean;
  author: Pick<
    Member,
    "id" | "firstName" | "lastName" | "avatarUrl" | "functionality"
  > & { isPresent: boolean };
};

export type CommunityFeed = { notes: CommunityNote[]; presentCount: number };

export type CommunitySeat = {
  seatLabel: string;
  spaceName: string | null;
  spaceId: string;
};

export interface MemberGroup {
  id: string;
  name: string;
  maxMembers: number;
  discountForfait: number;
  discountAbonnement: number;
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
  categories?: PriceCategory[];
  durationHours?: number | null;
  billingUnit?: BillingUnit | null;
  periodDays?: number | null;
  spaceId?: string | null;
  spaceName?: string | null;
  spaceIds?: string[];
  spaceNames?: string[];
  offerSpaces?: { spaceId: string }[];
  occupySeat?: boolean;
  occupyWhole?: boolean;
  reserveSeat?: boolean;
  reserveSeatFromHour?: number | null;
  reserveSeatToHour?: number | null;
  isActive?: boolean;
  /** Créneau (happy hour): sold only from/to these hours; to > 24 = after midnight */
  availableFromHour?: number | null;
  availableToHour?: number | null;
  /** 0 = dimanche … 6 = samedi; empty = every day */
  availableDays?: number[];
}

export interface Journal {
  id: string;
  isPayed: boolean;
  /** The member's first visit ever is on this row's day ("Nouveau" badge). */
  isFirstVisit?: boolean;
  /** Nth visit day of the member up to this row (1 = first visit) */
  visitNumber?: number;
  /** Hidden by a staff member — waiting for the admin's decision (admin only sees it) */
  hiddenAt?: string | null;
  hiddenByUserId?: string | null;
  /** Per check-in code — the visitor shows it as a QR, reception scans it */
  checkInCode?: string;
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
  serviceName?: string | null;
  listPrice?: number | null;
  pricingMode?: JournalPricingMode;
  fixedPriceId?: string | null;
  fixedServiceName?: string | null;
  fixedDurationHours?: number | null;
  fixedAmount?: number | null;
  fixedAt?: string | null;
  /** Amount actually collected (payedAmount = amount owed) */
  paidAmount?: number;
  paidAt?: string | null;
  /** Server-computed tier / overtime pricing (pack & auto visits only) */
  pricing?: SessionPricingPayload | null;
  priceBeforePromo?: number | null;
  promoDiscount?: number | null;
  promoLabel?: string | null;
  /** Amount owed at checkout, kept after a late payment re-billed `payedAmount` */
  amountAtCheckout?: number | null;
  /** Server-computed re-billing for visitors who checked out without paying */
  latePayment?: JournalLatePayment | null;
}

export interface JournalLatePayment {
  amountAtCheckout: number;
  amountIfPaidNow: number;
  /** Chosen forfait price (fixed pack / non-hourly tariff), null when the visit has none. */
  amountFixed?: number | null;
  extra: number;
  computedAt: string;
}

/** Which amount to bill when someone who left unpaid pays later. */
export type LateBillingMode = "now" | "checkout" | "fixed";

export type JournalPricingMode = "FIXED" | "AUTO";

export type SessionPricingPayload = import("@/lib/session-pricing").SessionPricingResult & {
  closed: boolean;
  fixedPriceId: string | null;
  fixedServiceName: string | null;
  fixedDurationHours: number | null;
  fixedAmount: number | null;
  fixedAt: string | null;
  paidAmount: number;
  balanceDue: number;
  discountPercent: number;
  rules: import("@/lib/session-pricing").PricingRules;
};

export type MobileSeatMode = 'ADMIN_ASSIGN' | 'VISITOR_CHOOSE' | 'AUTO_ASSIGN';

/** Visitor reservation rules (admin « Réservations »). Fee is paid at reception on the day. */
export type ReservationRules = {
  fee: number;
  feePerPlace: boolean;
  maxDaysAhead: number;
  maxPlaces: number;
  autoApprove: boolean;
};

export type MobileSeatSettings = {
  facilityId: string | null;
  mobileSeatMode: MobileSeatMode;
  receptionAway: boolean;
  receptionAwayStartedAt?: string | null;
  reservation?: ReservationRules;
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
  /** When the abonnement was paid — revenue is counted on this day */
  paidAt?: string | null;
  registredDate: string;
  leaveDate?: string | null;
  paymentRemindAt?: string | null;
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
  priceBeforePromo?: number | null;
  promoDiscount?: number | null;
  promoLabel?: string | null;
  /** Member / group abonnement discount applied at sale time (%) */
  discountPercent?: number | null;
  /** Price owed after discounts (payedAmount = collected so far) */
  amountDue?: number | null;
  /** Each amount collected (advance, remainder…) — revenue is counted on its paidAt */
  payments?: { id: string; amount: number; paidAt: string }[];
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
  /** Visitor reservations: fee (DT), once or per place, paid at reception */
  reservationFee?: number;
  reservationFeePerPlace?: boolean;
  reservationMaxDaysAhead?: number;
  reservationMaxPlaces?: number;
  reservationAutoApprove?: boolean;
  appInstallGlobalPromoActive?: boolean;
  appInstallGlobalPromoKind?: PromoValueKind | null;
  appInstallGlobalPromoValue?: number | null;
  /** Tarif categories the global promo applies to (empty = all) */
  appInstallGlobalPromoScopes?: PriceCategory[];
  sessionWarnBeforeMin?: number;
  autoTierGraceMin?: number;
  fixedGraceMin?: number;
  overtimeSurchargeDt?: number;
  overtimeNextTierMin?: number;
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
  /** Shown to visitors next to the table photo */
  description?: string | null;
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
  categories?: (PriceCategory | string)[];
  floorPlanUrl?: string | null;
  sortOrder: number;
  capacityNormal: number;
  wifiSsid?: string | null;
  wifiPassword?: string | null;
  openForReservation?: boolean;
  reserveMode?: "SEAT" | "WHOLE" | "BOTH" | null;
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
  createdAt?: string;
  /** Set when the movement is a transfer with the coffre */
  coffreEntry?: { id: string } | null;
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
  keptFloat?: number | null;
  externalOrgId?: string | null;
  externalRef?: string | null;
  syncedAt?: string | null;
  movements?: CaisseMovement[];
}

export interface DayFinanceSummary {
  date: string;
  dateKey: string;
  session: CaisseSession | null;
  revenue: number;
  revenueJournal: number;
  revenueAbonnements: number;
  revenueProducts: number;
  counts: { paidVisits: number; abonnementPayments: number; products: number };
  /** All expenses of the day */
  expenses: number;
  /** Paid with drawer cash (counted in the expected cash) */
  expensesCash: number;
  /** Paid from the coffre / bank */
  expensesOther: number;
  /** Opening float proposed when the day has no session yet */
  suggestedFloat?: number | null;
  /** Earlier days still not closed (yyyy-MM-dd, newest first) */
  unclosedDays: string[];
  movementsIn: number;
  movementsOut: number;
  openingFloat: number;
  expectedClose: number;
  /** Expected amount frozen when the caisse was closed (null while open). */
  closedExpected?: number | null;
  /** expectedClose − closedExpected: changes made after closing. */
  driftSinceClose?: number | null;
  net: number;
  unpaidJournal: number;
  occupancy: OccupancyStats;
  journalsCount: number;
  dailyExpenses?: Array<{
    id: string;
    expenseId?: string | null;
    date?: string | null;
    amount: number;
    label: string;
    kind: "MENSUEL" | "JOURNALIER";
    source: "CAISSE" | "COFFRE" | "AUTRE";
    Summary?: string | null;
    createdAt: string;
  }>;
  dailyProducts?: Array<{
    id: string;
    productId: string;
    quantite: number;
    status?: string;
    product?: { name: string; sellingPrice: number };
  }>;
}

export interface CoffreEntry {
  id: string;
  date: string;
  type: "IN" | "OUT" | string;
  amount: number;
  label?: string | null;
  caisseSessionId?: string | null;
  createdAt: string;
  dateKey: string;
  /** CLOTURE = caisse closing, DEPENSE = expense paid from the coffre, CAISSE = drawer transfer */
  kind: "CLOTURE" | "DEPENSE" | "CAISSE" | "MANUEL";
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
    dateKey: string;
    closedAt?: string | null;
    openingFloat: number;
    countedClose?: number | null;
    expectedClose?: number | null;
    difference?: number | null;
    keptFloat?: number | null;
    notes?: string | null;
  }>;
}

export interface PriceHistoryEntry {
  id: string;
  priceId: string;
  organizationId?: string | null;
  name: string;
  price: number;
  type: string;
  categories: string[];
  billingUnit?: string | null;
  durationHours?: number | null;
  periodDays?: number | null;
  spaceId?: string | null;
  isActive: boolean;
  changedAt: string;
  changedByUserId?: string | null;
  reason?: string | null;
}

export interface FinanceYearMonthRow {
  year: number;
  month: number;
  revenueJournal: number;
  revenueAbonnements: number;
  revenueProducts: number;
  expenses: number;
  net: number;
}

export interface FinanceMonthDayRow {
  date: string;
  /** Non-reservation journal entries that day */
  visits: number;
  revenueJournal: number;
  revenueAbonnements: number;
  revenueProducts: number;
  expenses: number;
  net: number;
}

export interface ServiceDemandRow {
  priceId: string | null;
  name: string;
  journalCount: number;
  abonnementCount: number;
  count: number;
  revenueJournal: number;
  revenueAbonnements: number;
  revenue: number;
  uniqueClients: number;
}

export interface ProductPerformanceRow {
  productId: string;
  name: string;
  quantity: number;
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number | null;
  unitMargin: number;
  stock: number | null;
}

export interface ProductsPerformance {
  from: string;
  to: string;
  totals: {
    revenue: number;
    cost: number;
    margin: number;
    marginPct: number | null;
    quantity: number;
    attachRate: number | null;
    avgBasket: number | null;
    visits: number;
  };
  products: ProductPerformanceRow[];
  dormant: Array<{ productId: string; name: string; stock: number }>;
  revenueByHour: Array<{ hour: number; revenue: number }>;
  tips: string[];
}

export interface SpaceUsageRow {
  spaceId: string | null;
  name: string;
  visitCount: number;
  subscriptionCount: number;
  count: number;
  hours: number;
  uniqueClients: number;
}

export interface AnalyticsClientRow {
  memberId: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  count?: number;
  visitCount?: number;
  journalCount?: number;
  abonnementCount?: number;
  revenue?: number;
  hours?: number;
}

export interface AnalyticsMemberRef {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  visitorNumber?: number | null;
  phone?: string | null;
  avatarUrl?: string | null;
  points?: number;
}

export interface RegularMemberRow {
  member: AnalyticsMemberRef;
  visitDays: number;
  visits: number;
  totalHours: number;
  daysPerWeek: number;
  avgArrivalHour: number;
  lastVisit: string;
  /** 0 = dimanche … 6 = samedi, most frequent first */
  usualWeekdays: number[];
}

export interface TopPointsMember extends AnalyticsMemberRef {
  points: number;
  sessions: number;
  level: { id: string; name: string; sessions: number };
}

export interface WeeklyTrafficDay {
  /** 0 = dimanche … 6 = samedi */
  weekday: number;
  occurrences: number;
  avgVisits: number;
  peakHour: number;
  peakArrivals: number;
  peakPresentHour: number;
  peakPresent: number;
  hours: { hour: number; avgArrivals: number; avgPresent: number }[];
}

export interface DayTrafficTotals {
  visits: number;
  uniqueVisitors: number;
  /** revenueVisits + revenueAbonnements */
  revenue: number;
  revenueVisits: number;
  revenueAbonnements: number;
  abonnementsPaid: number;
  avgDurationMin: number;
  leftUnpaid: number;
  peakHour: number;
  peakPresent: number;
}

export interface DayTrafficSeries {
  date: string;
  weekday: number;
  arrivals: number[];
  present: number[];
  totals: DayTrafficTotals;
}

export type DayTrafficCompare = "weekday" | "previous";

export interface DayTrafficResponse {
  date: string;
  compare: DayTrafficCompare;
  count: number;
  target: DayTrafficSeries;
  comparisons: DayTrafficSeries[];
  average: {
    arrivals: number[];
    present: number[];
    totals: Omit<DayTrafficTotals, "peakHour">;
  };
}

export interface PerformanceSettings {
  facilityId: string;
  openHour: number;
  /** > 24 = after midnight (25 = 1h) */
  closeHour: number;
  alwaysOpen: boolean;
  regularVisitsPerWeek: number;
  inactiveAlertDays: number;
  googleReviewUrl: string | null;
  reviewAfterVisits: number;
  referralPoints: number;
}

export interface PerformanceWeekday {
  weekday: number;
  occurrences: number;
  avgRevenue: number;
  avgVisits: number;
  occupancyPct: number | null;
}

export interface PerformancePeriodMetrics {
  revenue: number;
  revenueJournal: number;
  revenueAbonnements: number;
  revenueProducts: number;
  expenses: number;
  net: number;
  marginPct: number | null;
  recurringSharePct: number | null;
  days: number;
  revenuePerDay: number;
  revenuePerSeatDay: number | null;
  visits: number;
  uniqueVisitors: number;
  avgVisitsPerDay: number;
  avgDurationMin: number | null;
  avgTicket: number | null;
  seatHoursUsed: number;
  capacityHours: number;
  occupancyPct: number | null;
  weekdays: PerformanceWeekday[];
}

export interface PerformanceOverview {
  settings: PerformanceSettings;
  seats: number;
  period: {
    year: number;
    month: number;
    from: string;
    to: string;
    daysInMonth: number;
    elapsedDays: number;
    remainingDays: number;
    isCurrent: boolean;
    isFuture: boolean;
    comparedTo: { from: string; to: string; likeForLike: boolean };
  };
  current: PerformancePeriodMetrics | null;
  previous: PerformancePeriodMetrics;
  deltas: {
    revenue: number | null;
    net: number | null;
    visits: number | null;
    occupancyPct: number | null;
    revenuePerSeatDay: number | null;
    recurringSharePct: number | null;
    avgTicket: number | null;
    marginPct: number | null;
  } | null;
  projected: number | null;
  target: {
    revenue: number;
    occupancyPct: number | null;
    inherited: boolean;
    fromMonth: { year: number; month: number } | null;
    progressPct: number;
    expectedPct: number;
    expectedByNow: number;
    gap: number;
    remaining: number;
    neededPerDay: number | null;
    projectedPct: number | null;
  } | null;
  breakEven: BreakEven;
  bestWeekday: number | null;
  worstWeekday: number | null;
  week: {
    revenue: number;
    visits: number;
    occupancyPct: number | null;
    revenueDelta: number | null;
    visitsDelta: number | null;
    bestWeekday: number | null;
  };
}

export interface BreakEven {
  hasCharges: boolean;
  /** Monthly charges (paid + still to pay). */
  fixed: number;
  fixedRemaining: number;
  /** Small daily expenses projected to month end. */
  dailyProjected: number;
  total: number;
  covered: number;
  coveredPct: number | null;
  remaining: number;
  reached: boolean;
  neededPerDay: number | null;
  visitsPerDay: number | null;
  projectedProfit: number | null;
}

export interface AbonnementOffer {
  memberId: string;
  visitDays: number;
  spend: number;
  spanDays: number;
  typicalHours: number;
  plan: {
    id: string;
    name: string;
    price: number;
    periodDays: number;
    durationHours: number | null;
  };
  projectedSpend: number;
  savings: number;
  strength: "save" | "close";
  /** "4 visites en 12 jours · 36,8 DT payés en passes" */
  observed: string;
  headline: string;
}

/** Client who already paid part of an abonnement in passes: pay the rest. */
export interface TopUpOffer {
  memberId: string;
  plan: {
    id: string;
    name: string;
    price: number;
    periodDays: number;
    durationHours: number | null;
  };
  paid: number;
  remaining: number;
  paidPct: number;
  visitDays: number;
  /** yyyy-MM-dd */
  firstVisit: string;
  headline: string;
}

export type OutreachReason =
  | "ABO_EXPIRING"
  | "ABO_ENDED"
  | "UNPAID"
  | "RECALL"
  | "INACTIVE"
  | "NEW_NOT_BACK"
  | "TOP_UP"
  | "CONVERT"
  | "REVIEW";
export type OutreachChannel = "WHATSAPP" | "PUSH" | "CALL" | "SKIP";

export interface OutreachItem {
  memberId: string;
  name: string;
  firstName: string;
  phone: string | null;
  whatsapp: string | null;
  hasPush: boolean;
  reason: OutreachReason;
  title: string;
  detail: string;
  value: number;
  owed: number;
  message: string;
  offer?: AbonnementOffer;
  topUp?: TopUpOffer;
  lastContact: { at: string; channel: OutreachChannel; reason: OutreachReason } | null;
  snoozed: boolean;
  profileType?: "STUDENT" | "PUPIL" | "PRO" | null;
  /** Why the member stopped coming (1 click in Relances) */
  awayReason?: AwayReason | null;
  recallAt?: string | null;
}

export type AwayReason = "STUDY_HOME" | "PRICE" | "DISTANCE" | "NOISE" | "HOURS" | "OTHER";

export interface OutreachResults {
  contacted: number;
  won: number;
  revenue: number;
  byReason: Partial<Record<OutreachReason, { contacted: number; won: number; revenue: number }>>;
}

export interface OutreachList {
  generatedAt: string;
  pushEnabled: boolean;
  todo: OutreachItem[];
  contacted: OutreachItem[];
  results: OutreachResults;
  /** Answers to "pourquoi tu ne viens plus ?" (90 days) */
  awayReasons?: Partial<Record<AwayReason, number>>;
}

export type InsightSeverity =
  | "critical"
  | "warning"
  | "opportunity"
  | "info"
  | "success";

export interface PerformanceInsight {
  id: string;
  severity: InsightSeverity;
  title: string;
  detail: string;
  cta?: { label: string; href?: string; action?: "target" };
  items?: Array<{ label: string; detail?: string; href?: string }>;
}

export interface MonthlyTarget {
  id: string;
  facilityId: string;
  year: number;
  month: number;
  revenue: number;
  occupancyPct: number | null;
}

export type VisitRequestType = "DAY" | "SUBSCRIPTION";
export type VisitRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface VisitRequest {
  id: string;
  memberId: string;
  /** Arrivals list: the member's first visit ever is today. */
  isFirstVisit?: boolean;
  priceId: string;
  type: VisitRequestType;
  status: VisitRequestStatus;
  seatLabel?: string | null;
  spaceId?: string | null;
  occupyWhole?: boolean;
  autoApproved?: boolean;
  receptionAckedAt?: string | null;
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

export type EventKind = "WORKSHOP" | "NETWORKING" | "OTHER" | "LEARNING";
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
  /** Price of a place in DT; null = free */
  price?: number | null;
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

export type LastSeatUsed = {
  seatId: string;
  spaceId?: string | null;
  spaceName?: string | null;
};

export type SeatStay = {
  seatId: string;
  spaceId?: string | null;
  spaceName?: string | null;
  memberId?: string | null;
  memberName: string;
  journalId?: string | null;
  from: string;
  to: string | null;
};

export type SeatHistoryDay = {
  lastByJournalId: Record<string, LastSeatUsed>;
  lastByMemberId: Record<string, LastSeatUsed>;
  stays: SeatStay[];
};

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
  catalogPrice?: number | null;
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
    catalogPrice?: number;
    payedAmount?: number;
    remaining?: number;
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
  paymentRemindAt?: string | null;
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
  /** All places of the request (seatLabel = first one) */
  seatLabels?: string[];
  places?: number;
  /** Reservation fee (DT), paid at reception on the day */
  fee?: number;
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
  /** Day list only: accepted seats already marked as taken on the plan */
  seatsHeld?: boolean;
  /** Cancelled by the visitor or reception (status stays REJECTED) */
  cancelledAt?: string | null;
  cancelledBy?: "member" | "staff" | null;
  /** Fee kept as debt when an accepted booking was cancelled */
  cancelFee?: number | null;
  /** That fee has been collected since */
  feePaid?: boolean;
}

/** Cancellation fees a member still owes (visitor app). */
export interface OpenBookingFees {
  total: number;
  items: { id: string; amount: number; note: string | null; createdAt: string }[];
}

// ---- Conseiller IA ----
export type AdvisorCategory =
  | "NEW_REVENUE"
  | "PROMO"
  | "PRICING"
  | "CAFE"
  | "RETENTION"
  | "OPERATIONS";

export interface AdvisorRecommendation {
  category: AdvisorCategory;
  priority: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  title: string;
  evidence: string;
  actions: string[];
  expectedImpact: string;
  measure: string;
  /** Figure the app measures before / after (older reports: absent) */
  metric?: AdviceMetric;
  /** Expected change of that figure (% or points for rate figures) */
  targetPct?: number;
  /** Who it aims at; 0/0 hours = all day */
  target?: { kind: TargetKind; days: number[]; fromHour: number; toHour: number };
  /** Clients to contact and the ready-to-send message (segment NONE = no relance) */
  outreach?: { segment: CampaignSegment | "NONE"; message: string };
}

export interface AdvisorResult {
  summary: string;
  highlights: Array<{ trend: "up" | "down" | "flat"; title: string; detail: string }>;
  recommendations: AdvisorRecommendation[];
  initiativeReviews: Array<{
    initiativeId: string;
    verdict: "working" | "not_working" | "too_early" | "not_tested";
    detail: string;
    /** The planned step not done, or the funnel stage that blocks */
    brokenStep?: string;
  }>;
  questions: string[];
}

export type AdvisorReportStatus = "PENDING" | "DONE" | "FAILED";

export interface AdvisorReportSummary {
  id: string;
  status: AdvisorReportStatus;
  trigger: "MANUAL" | "WEEKLY" | "IMPORT";
  periodFrom: string;
  periodTo: string;
  createdAt: string;
  error: string | null;
  headline?: string | null;
}

export interface AdvisorReport extends AdvisorReportSummary {
  result: AdvisorResult | null;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface AdvisorPrompt {
  model: string;
  system: string;
  user: string;
  schema: unknown;
  /** system + schema + data in one text, ready to paste into claude.ai */
  chat: string;
  snapshot: unknown;
}

export interface AdvisorSettings {
  facilityId: string;
  businessContext: string;
  enabled: boolean;
  model: string;
}

export interface InitiativeMetrics {
  from: string;
  to: string;
  visitsPerDay: number;
  revenuePerDay: number;
  revenueVisits: number;
  revenueSubscriptions: number;
  revenueCafe: number;
  cafeMargin: number;
  cafeAttachRatePct: number | null;
  avgStayHours: number | null;
  avgOccupancyPct: number | null;
  newMembers: number;
}

export type AdviceMetric =
  | "revenuePerDay"
  | "visitsPerDay"
  | "revenueCafe"
  | "cafeAttachRatePct"
  | "avgStayHours"
  | "newMembers"
  | "revenueSubscriptions"
  | "avgOccupancyPct";

export type InitiativeVerdict = "WORKING" | "MIXED" | "NOT_WORKING";

export type TargetKind = "ALL" | "SLOT" | "LIST";
export type LinkedKind = "PRICE" | "PRODUCT" | "PROMOTION" | "EVENT";

export type InitiativeObjective = "TICKETS" | "SUBSCRIBERS" | "CAFE" | "QUIET_HOURS" | "OTHER";
export type InitiativeChannel =
  | "INSTAGRAM_POST"
  | "INSTAGRAM_STORY"
  | "WHATSAPP"
  | "APP"
  | "PARTNER"
  | "WALK_IN";

export interface InitiativeStep {
  text: string;
  done: boolean;
  doneAt?: string | null;
}

export type FunnelStageKey = "seen" | "opened" | "registered" | "paid" | "came" | "contacted" | "won";

export interface FunnelStage {
  key: FunnelStageKey;
  label: string;
  source: string;
  value: number | null;
  rate: number | null;
  pending?: boolean;
}

export type DiagnosisStatus = "NOT_TESTED" | "MISSING_DATA" | "TOO_EARLY" | "BOTTLENECK" | "ON_TRACK";

export interface InitiativeDiagnosis {
  status: DiagnosisStatus;
  stage: FunnelStageKey | null;
  brokenStep: string | null;
  title: string;
  known: string[];
  unproven: string[];
  next: string;
}

export interface InitiativeShareLink {
  id: string;
  code: string;
  channel: InitiativeChannel;
  opens: number;
}

export interface AdvisorDataIssue {
  key: string;
  severity: "blocking" | "warning";
  title: string;
  detail: string;
  fixLabel: string;
  fixHref: string;
  blocks: AdvisorCategory[];
}

export type InitiativeStatus =
  | "too_early"
  | "goal_reached"
  | "below_goal"
  | "no_effect"
  | "up"
  | "down";

export interface InitiativeNote {
  date: string;
  text: string;
}

export interface BusinessInitiative {
  id: string;
  title: string;
  /** What the owner actually did */
  description: string | null;
  category: AdvisorCategory;
  startDate: string;
  endDate: string | null;
  daysSinceStart: number;
  windowDays: number;
  recommendationTitle: string | null;
  metric: AdviceMetric | null;
  targetPct: number | null;
  cost: number | null;
  ownerVerdict: InitiativeVerdict | null;
  notes: InitiativeNote[];
  campaign: {
    id: string;
    title: string;
    total: number;
    contacted: number;
    won: number;
    revenue: number;
  } | null;
  target: {
    kind: TargetKind;
    days: number[];
    fromHour: number | null;
    toHour: number | null;
    segment: string | null;
    members: number;
    label: string;
  };
  linked: { kind: LinkedKind; id: string } | null;
  objective: InitiativeObjective | null;
  hypothesis: string | null;
  channels: InitiativeChannel[];
  steps: InitiativeStep[];
  manualFunnel: Array<{ date: string; channel: string | null; reach: number }>;
  /** Sum of the reach typed from Instagram; null = never typed */
  reach: number | null;
  links: InitiativeShareLink[];
  funnel: FunnelStage[] | null;
  diagnosis: InitiativeDiagnosis;
  /** Stopped, or measured over the full window */
  finished: boolean;
  result: {
    metric: AdviceMetric;
    /** "pts" for rate figures (effect in points), "%" otherwise */
    unit: "pts" | "%";
    mode: "global" | "slot" | "list";
    per: string;
    targetLabel: string;
    comparisonLabel: string | null;
    before: number | null;
    after: number | null;
    comparison: { before: number | null; after: number | null } | null;
    targetMove: number | null;
    comparisonMove: number | null;
    /** Target move − comparison move */
    effect: number | null;
    changePct: number | null;
    targetPct: number | null;
    sale: {
      kind: LinkedKind;
      label: string;
      count: number;
      revenue: number;
      margin: number;
      discount: number;
    } | null;
    gainSource: "sale" | "campaign" | "target" | "global";
    gain: number;
    cost: number;
    netGain: number;
    daysMeasured: number;
    daysLeft: number;
    visitsCompared: number;
    status: InitiativeStatus;
    disturbances: string[];
  } | null;
  impact: {
    comparedDays: number;
    before: InitiativeMetrics;
    after: InitiativeMetrics;
    changePct: {
      visitsPerDay: number | null;
      revenuePerDay: number | null;
      revenueCafe: number | null;
      avgStayHours: number | null;
    };
    extraRevenue: number;
  } | null;
}

export type AdvisorFactKind = "HOLIDAY" | "PERIOD" | "LOCAL_EVENT" | "NEIGHBOR" | "AUDIENCE";

export interface AdvisorFact {
  id: string;
  kind: AdvisorFactKind;
  title: string;
  detail: string | null;
  tag: string | null;
  startDate: string | null;
  endDate: string | null;
  distanceM: number | null;
  memberGroupId: string | null;
  source: "MANUAL" | "PRESET" | "OSM";
  confirmed: boolean;
  externalId: string | null;
}

export interface AdvisorMissingItem {
  key: string;
  section: "location" | "calendar" | "neighbors" | "audiences" | "charges" | "context" | "questions";
  title: string;
  detail: string;
  action?:
    | { type: "seed-holidays" }
    | { type: "confirm"; factId: string; startDate: string; endDate: string | null }
    | { type: "link"; href: string };
}

export interface AdvisorMissing {
  items: AdvisorMissingItem[];
  completed: number;
  total: number;
}

export interface AdvisorLocation {
  facilityId: string;
  latitude: number | null;
  longitude: number | null;
  address: string;
}

export interface AdvisorNearbyPlace {
  externalId: string;
  name: string;
  tag: string;
  kind: string;
  distanceM: number;
  added: boolean;
}

export interface AdvisorQuestion {
  id: string;
  question: string;
  answer: string | null;
  status: "OPEN" | "ANSWERED" | "DISMISSED";
  createdAt: string;
}

// ---- Promotions (golden card) ----
export type PromotionTarget = "PRODUCT" | "PRICE" | "BUNDLE" | "OTHER";

export interface Promotion {
  id: string;
  title: string;
  description: string | null;
  target: PromotionTarget;
  /** PRODUCT: discounted product · BUNDLE: the gift offered with the pass */
  productId: string | null;
  /** PRICE / BUNDLE: one tarif… */
  priceId: string | null;
  /** …or every tarif of this category */
  priceCategory: PriceCategory | null;
  /** PRICE / BUNDLE: every tarif id covered */
  priceIds?: string[];
  /** Tarif name when the promo targets one tarif */
  priceName?: string | null;
  /** BUNDLE: the gift · PRICE: the tarif · PRODUCT: the product */
  itemName: string | null;
  itemImg: string | null;
  valueKind: "PERCENT" | "FIXED_DT";
  value: number;
  label: string;
  priceBefore: number | null;
  priceAfter: number | null;
  startsAt: string;
  endsAt: string | null;
  daysOfWeek: number[];
  fromHour: number | null;
  toHour: number | null;
  audience: "ALL" | "IN_SESSION" | "FIRST_VISIT";
  /** Only members who installed the app */
  requiresApp?: boolean;
  maxUsesPerMember: number | null;
  maxUses: number | null;
  style: "GOLD" | "VIOLET" | "GREEN";
  isActive: boolean;
  liveNow: boolean;
  liveUntil: string | null;
  stats?: {
    views: number;
    clicks: number;
    uses: number;
    members: number;
    revenue: number;
    discount: number;
    /** BUNDLE: offers answered / yes / gift ordered */
    offered?: number;
    accepted?: number;
    redeemed?: number;
  };
}

/** Gift-with-pass voucher of a visit */
export interface PromotionVoucher {
  id: string;
  promotionId: string;
  journalId: string;
  productId: string;
  status: "ACCEPTED" | "USED";
  title: string;
  label: string;
  productName: string | null;
  productImg: string | null;
  priceBefore: number | null;
  priceAfter: number | null;
  usedAt: string | null;
}

export type PromotionInput = Partial<
  Pick<
    Promotion,
    | "title"
    | "description"
    | "target"
    | "productId"
    | "priceId"
    | "priceCategory"
    | "valueKind"
    | "value"
    | "startsAt"
    | "endsAt"
    | "daysOfWeek"
    | "fromHour"
    | "toHour"
    | "audience"
    | "requiresApp"
    | "maxUsesPerMember"
    | "maxUses"
    | "style"
    | "isActive"
  >
>;

// ---- Relance campaigns ----
export type CampaignSegment =
  | "ABO_EXPIRING"
  | "ABO_ENDED"
  | "INACTIVE"
  | "TOP_UP"
  | "CONVERT"
  | "UNPAID"
  | "RECENT_30"
  | "ALL"
  | "GROUP";
export type CampaignGoal = "VISIT" | "SUBSCRIPTION" | "ANY";

export interface OutreachCampaign {
  id: string;
  title: string;
  message: string;
  segment: CampaignSegment;
  memberGroupId: string | null;
  memberIds: string[];
  goal: CampaignGoal;
  status: "ACTIVE" | "DONE";
  sourceReportId: string | null;
  recommendationTitle: string | null;
  initiativeId: string | null;
  createdAt: string;
  progress: { total: number; contacted: number; skipped: number; won: number; revenue: number };
}

export interface CampaignTarget {
  memberId: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  hasPush: boolean;
  message: string;
  contactedAt: string | null;
  channel: OutreachChannel | null;
  won: boolean;
  revenue: number;
}

export interface OutreachCampaignDetail extends OutreachCampaign {
  pushEnabled: boolean;
  targets: CampaignTarget[];
}

export interface CampaignInput {
  title: string;
  message: string;
  segment: CampaignSegment;
  memberGroupId?: string | null;
  goal: CampaignGoal;
  sourceReportId?: string | null;
  recommendationTitle?: string | null;
  trackAsInitiative?: boolean;
  category?: AdvisorCategory;
}

/** Member profile asked in 1 tap at check-in. */
export type MemberProfileType = "STUDENT" | "PUPIL" | "PRO";
export type HeardFrom = "INSTAGRAM" | "FRIEND" | "SCHOOL" | "WALK_BY" | "OTHER";

export type OnboardingStatus = {
  firstVisit: boolean;
  visitDays: number;
  hasApp: boolean;
  askProfile: boolean;
  askSource: boolean;
  profileType: MemberProfileType | null;
};

/** One line of « Mes offres » in the member app. */
export type MemberOffer = {
  id: string;
  kind: "PERSONAL" | "GROUP" | "APP" | "PROMO";
  label: string;
  title: string;
  detail: string;
  daysOfWeek?: number[];
  fromHour?: number | null;
  toHour?: number | null;
  endsAt?: string | null;
  firstVisitOnly?: boolean;
  status: "ACTIVE" | "LIVE" | "LATER" | "TO_USE" | "NEEDS_APP" | "USED";
  style: "VIOLET" | "GOLD" | "GREEN";
};

/** Finance → Nouveaux */
export type NewcomersOverview = {
  kpis: {
    thisMonth: number;
    prevMonthSamePoint: number;
    prevMonth: number;
    thisWeek: number;
    returnPct: number | null;
    returnBase: number;
    appDay1Pct: number | null;
    notBack: number;
  };
  cohorts: {
    weekStart: string;
    count: number;
    back: number;
    pct: number | null;
    early: boolean;
    avgVisitDays: number | null;
    appDay1: number;
    total: number;
  }[];
  daily: { day: string; count: number }[];
  factors: {
    title: string;
    answered: number;
    rows: { label: string; count: number; back: number; pct: number | null }[];
  }[];
};

/** Finance → Nouveaux list row */
export type NewcomerRow = {
  memberId: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  first: string;
  firstService: string | null;
  stayHours: number | null;
  visitDays: number;
  last: string;
  status: "NOT_BACK" | "NEW" | "BACK";
  hasApp: boolean;
  profileType: "STUDENT" | "PUPIL" | "PRO" | null;
  heardFrom: string | null;
  awayReason: AwayReason | null;
  recallAt: string | null;
  lastContact: { at: string; channel: string } | null;
  message: string;
};

export type NewcomersListResponse = {
  rows: NewcomerRow[];
  counts: { ALL: number; NOT_BACK: number; NEW: number; BACK: number };
  meta: { currentPage: number; lastPage: number; perPage: number; total: number };
};
