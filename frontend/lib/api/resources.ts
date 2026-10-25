import { http } from "./httpClient";
import { withOrgQuery, getAdminOrganizationId } from "@/lib/admin-org";
import type { PricingRules, PricingTier } from "@/lib/session-pricing";
import type {
  StaffActionRow,
  StaffMember,
  StaffPermissions,
  AdvisorCategory,
  AdvisorFact,
  AdvisorLocation,
  AdvisorMissing,
  AdvisorNearbyPlace,
  AdvisorPrompt,
  AdvisorQuestion,
  AdvisorReport,
  AdvisorReportSummary,
  AdvisorSettings,
  BusinessInitiative,
  AdviceMetric,
  InitiativeNote,
  InitiativeVerdict,
  AdvisorDataIssue,
  LinkedKind,
  TargetKind,
  CampaignInput,
  CampaignSegment,
  OutreachCampaign,
  OutreachCampaignDetail,
  Promotion,
  PromotionInput,
  Journal,
  Member,
  PaginatedResponse,
  Price,
  VisitRequest,
  Facility,
  Abonnement,
  Space,
  SpaceTable,
  SpaceSeat,
  SpaceWall,
  SpaceFixture,
  OccupancyStats,
  CaisseSession,
  ProductOrder,
  DayFinanceSummary,
  SeatAssignmentInfo,
  MobileSeatSettings,
  MobileSeatMode,
  MemberInsights,
  StaffMessage,
  CoffreSummary,
  MonthFinanceSummary,
  PriceHistoryEntry,
  FinanceYearMonthRow,
  FinanceMonthDayRow,
  ServiceDemandRow,
  ProductsPerformance,
  SpaceUsageRow,
  AnalyticsClientRow,
  MemberGroup,
  SeatOccupant,
  Organization,
  SpaceEvent,
  EventAttendee,
  EventKind,
  EventStatus,
  MemberLedgerSummary,
  MemberLedgerEntry,
  LedgerKind,
  BookingRequest,
  DebtorMember,
  AwayArrivalsResponse,
  SeatHistoryDay,
  AppInstallPromo,
  PromoValueKind,
  AppInstallGlobalPromo,
  MemberAvailability,
  RegularMemberRow,
  TopPointsMember,
  WeeklyTrafficDay,
  DayTrafficCompare,
  DayTrafficResponse,
  LateBillingMode,
  PerformanceSettings,
  PerformanceOverview,
  PerformanceInsight,
  MonthlyTarget,
  AbonnementOffer,
  OutreachList,
  OutreachReason,
  OutreachChannel,
} from "@/lib/types";
import { format } from "date-fns";

export type Product = {
  id: string;
  name: string;
  description?: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  img?: string | null;
  organizationId?: string | null;
};

/** Recurring monthly charge template (loyer, internet…). */
export type Expense = {
  id: string;
  name: string;
  description?: string | null;
  amount: number;
  type: "MENSUEL" | "JOURNALIER";
  dueDay?: number | null;
};

export type SeatBooking = {
  id: string;
  eventKey: string;
  seatId: string;
  spaceId?: string;
  isBooked: boolean;
  isPermanent?: boolean;
  bookedAt?: string | null;
  memberId?: string | null;
};

export type DailyProduct = {
  id: string;
  productId: string;
  date?: string | null;
  quantite: number;
  product?: Product;
  status?: ProductOrder["status"];
  isPayed?: boolean;
  memberId?: string | null;
  externalRef?: string | null;
  journalId?: string | null;
  createdAt?: string;
  /** Price charged per unit when a promotion applied (else product.sellingPrice) */
  unitPrice?: number | null;
  promotionId?: string | null;
};

/** Price charged per unit on a café order (promotion price when one applied). */
export const orderUnitPrice = (o: {
  unitPrice?: number | null;
  product?: { sellingPrice?: number | null } | null;
}) => o.unitPrice ?? o.product?.sellingPrice ?? 0;

export type ExpenseSource = "CAISSE" | "COFFRE" | "AUTRE";

/** One spent amount: quick expense (no template) or a paid charge. */
export type DailyExpense = {
  id: string;
  expenseId?: string | null;
  date?: string | null;
  amount: number;
  label: string;
  kind: "MENSUEL" | "JOURNALIER";
  source: ExpenseSource;
  Summary?: string | null;
  createdAt: string;
  expense?: Expense | null;
};

export type ExpenseSuggestion = { label: string; lastAmount: number; count: number };

export type ExpenseMonthOverview = {
  year: number;
  month: number;
  recurring: Array<{
    id: string;
    name: string;
    description?: string | null;
    amount: number;
    dueDay?: number | null;
    dueDate?: string | null;
    status: "paid" | "late" | "soon" | "todo";
    paid: number;
    payments: DailyExpense[];
  }>;
  oneOff: DailyExpense[];
  daily: {
    total: number;
    count: number;
    byLabel: Array<{ label: string; total: number; count: number }>;
    byDay: Array<{ date: string; total: number; count: number }>;
    rows: DailyExpense[];
  };
  totals: {
    spent: number;
    daily: number;
    chargesPaid: number;
    chargesRemaining: number;
    chargesPlanned: number;
    bySource: Record<ExpenseSource, number>;
  };
};

export const journalApi = {
  list(params: {
    perPage?: number;
    page?: number;
    journalDate: Date | string;
  }) {
    const journalDate =
      typeof params.journalDate === "string"
        ? params.journalDate
        : format(params.journalDate, "yyyy-MM-dd");
    const q = new URLSearchParams({
      perPage: String(params.perPage ?? 50),
      page: String(params.page ?? 1),
      journalDate,
    });
    return http.get<PaginatedResponse<Journal>>(
      withOrgQuery(`/journal?${q}`),
    );
  },
  create(data: Partial<Journal>) {
    return http.post<Journal>("/journal", data);
  },
  update(id: string, data: Partial<Journal>) {
    return http.patch<Journal>(`/journal/${id}`, data);
  },
  remove(id: string) {
    return http.delete<void>(`/journal/${id}`);
  },
  byCheckInCode(code: string) {
    return http.get<Journal>(
      withOrgQuery(`/journal/check-in/${encodeURIComponent(code)}`),
    );
  },
  linkMember(id: string, memberId: string) {
    return http.post<Journal>(`/journal/${id}/link-member`, { memberId });
  },
  promoteMember(
    id: string,
    data: { firstName?: string; phone?: string; lastName?: string },
  ) {
    return http.post<Journal>(`/journal/${id}/promote-member`, data);
  },
};

export const membersApi = {
  list() {
    return http.get<Member[]>(withOrgQuery("/members/all"));
  },
  listPage(params: {
    page?: number;
    perPage?: number;
    search?: string;
    groupId?: string;
    status?: string;
    memberIds?: string[];
  } = {}) {
    const q = new URLSearchParams();
    q.set("page", String(params.page ?? 1));
    q.set("perPage", String(params.perPage ?? 20));
    if (params.search?.trim()) q.set("search", params.search.trim());
    if (params.groupId && params.groupId !== "all") {
      q.set("groupId", params.groupId);
    }
    if (params.status && params.status !== "all") {
      q.set("status", params.status);
    }
    if (params.memberIds?.length) {
      q.set("memberIds", params.memberIds.join(","));
    }
    return http.get<PaginatedResponse<Member>>(
      withOrgQuery(`/members?${q.toString()}`),
    );
  },
  stats() {
    return http.get<{
      total: number;
      activeAbonnements: number;
      presentNow: number;
    }>(withOrgQuery("/members/stats"));
  },
  create(data: Partial<Member> & { password?: string }) {
    return http.post<Member>("/members", {
      ...data,
      organizationId:
        data.organizationId || getAdminOrganizationId() || undefined,
    });
  },
  update(id: string, data: Partial<Member>) {
    return http.patch<Member>(`/members/${id}`, data);
  },
  remove(id: string) {
    return http.delete<void>(`/members/${id}`);
  },
  insights(id: string) {
    return http.get<MemberInsights>(`/members/${id}/insights`);
  },
  ledger(id: string) {
    return http.get<MemberLedgerSummary>(`/members/${id}/ledger`);
  },
  addLedger(
    id: string,
    data: {
      kind: LedgerKind;
      amount: number;
      note?: string;
      dueDate?: string;
      source?: string;
      journalId?: string;
      abonnementId?: string;
    }
  ) {
    return http.post<MemberLedgerEntry>(`/members/${id}/ledger`, data);
  },
  settleLedger(entryId: string, settled = true) {
    return http.patch<MemberLedgerEntry>(`/members/ledger/${entryId}/settle`, {
      settled,
    });
  },
  removeLedger(entryId: string) {
    return http.delete<void>(`/members/ledger/${entryId}`);
  },
  merge(targetId: string, sourceMemberId: string) {
    return http.post<Member>(`/members/${targetId}/merge`, { sourceMemberId });
  },
  debtors(includeSettled = false) {
    const path = includeSettled
      ? "/members/debtors?includeSettled=1"
      : "/members/debtors";
    return http.get<{ members: DebtorMember[] }>(withOrgQuery(path));
  },
};

export const groupsApi = {
  list() {
    return http.get<MemberGroup[]>(withOrgQuery("/groups"));
  },
  create(data: Partial<MemberGroup>) {
    return http.post<MemberGroup>("/groups", {
      ...data,
      organizationId: getAdminOrganizationId() || undefined,
    });
  },
  update(id: string, data: Partial<MemberGroup>) {
    return http.patch<MemberGroup>(`/groups/${id}`, data);
  },
  remove(id: string) {
    return http.delete<void>(`/groups/${id}`);
  },
  addMember(id: string, memberId: string) {
    return http.post<MemberGroup>(`/groups/${id}/members`, { memberId });
  },
  removeMember(id: string, memberId: string) {
    return http.delete<MemberGroup>(`/groups/${id}/members/${memberId}`);
  },
};

export const pricesApi = {
  list() {
    return http.get<Price[]>(withOrgQuery("/prices"));
  },
  create(data: Partial<Price>) {
    return http.post<Price>("/prices", {
      ...data,
      organizationId: getAdminOrganizationId() || undefined,
    });
  },
  update(id: string, data: Partial<Price>) {
    return http.put<Price>(`/prices/${id}`, data);
  },
  remove(id: string) {
    return http.delete<void>(`/prices/${id}`);
  },
  history(id: string) {
    return http.get<PriceHistoryEntry[]>(`/prices/${id}/history`);
  },
};

export const analyticsApi = {
  financeMonthly(year: number) {
    return http.get<{ year: number; months: FinanceYearMonthRow[] }>(
      `/analytics/finance/monthly?year=${year}`,
    );
  },
  financeMonthDays(year: number, month: number) {
    return http.get<{ year: number; month: number; days: FinanceMonthDayRow[] }>(
      `/analytics/finance/month-days?year=${year}&month=${month}`,
    );
  },
  productsPerformance(from: string, to: string) {
    return http.get<ProductsPerformance>(
      `/analytics/products/performance?from=${from}&to=${to}`,
    );
  },
  servicesDemand(from?: string, to?: string) {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    const qs = q.toString();
    return http.get<{
      from: string;
      to: string;
      services: ServiceDemandRow[];
    }>(`/analytics/services/demand${qs ? `?${qs}` : ""}`);
  },
  serviceClients(priceId: string, from?: string, to?: string) {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    const qs = q.toString();
    return http.get<{
      priceId: string;
      from: string;
      to: string;
      clients: AnalyticsClientRow[];
    }>(`/analytics/services/${priceId}/clients${qs ? `?${qs}` : ""}`);
  },
  spacesUsage(from?: string, to?: string) {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    const qs = q.toString();
    return http.get<{ from: string; to: string; spaces: SpaceUsageRow[] }>(
      `/analytics/spaces/usage${qs ? `?${qs}` : ""}`,
    );
  },
  spaceClients(spaceId: string, from?: string, to?: string) {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    const qs = q.toString();
    return http.get<{
      spaceId: string;
      from: string;
      to: string;
      clients: AnalyticsClientRow[];
    }>(`/analytics/spaces/${spaceId}/clients${qs ? `?${qs}` : ""}`);
  },
  members(opts: {
    topServiceId?: string;
    topSpaceId?: string;
    from?: string;
    to?: string;
  }) {
    const q = new URLSearchParams();
    if (opts.topServiceId) q.set("topServiceId", opts.topServiceId);
    if (opts.topSpaceId) q.set("topSpaceId", opts.topSpaceId);
    if (opts.from) q.set("from", opts.from);
    if (opts.to) q.set("to", opts.to);
    return http.get<{
      memberIds: string[];
      topServiceId?: string;
      topSpaceId?: string;
      from: string;
      to: string;
    }>(`/analytics/members?${q.toString()}`);
  },
  regulars(opts: { from?: string; to?: string; limit?: number } = {}) {
    const q = new URLSearchParams();
    if (opts.from) q.set("from", opts.from);
    if (opts.to) q.set("to", opts.to);
    if (opts.limit) q.set("limit", String(opts.limit));
    return http.get<{ from: string; to: string; regulars: RegularMemberRow[] }>(
      withOrgQuery(`/analytics/attendance/regulars?${q.toString()}`),
    );
  },
  topPoints(limit = 10) {
    return http.get<{ members: TopPointsMember[] }>(
      withOrgQuery(`/analytics/members/top-points?limit=${limit}`),
    );
  },
  trafficWeekly(opts: { from?: string; to?: string } = {}) {
    const q = new URLSearchParams();
    if (opts.from) q.set("from", opts.from);
    if (opts.to) q.set("to", opts.to);
    return http.get<{ from: string; to: string; days: WeeklyTrafficDay[] }>(
      withOrgQuery(`/analytics/traffic/weekly?${q.toString()}`),
    );
  },
  trafficDay(opts: { date: string; compare: DayTrafficCompare; count: number }) {
    const q = new URLSearchParams({
      date: opts.date,
      compare: opts.compare,
      count: String(opts.count),
    });
    return http.get<DayTrafficResponse>(
      withOrgQuery(`/analytics/traffic/day?${q.toString()}`),
    );
  },
  performanceSettings(facilityId?: string) {
    const q = facilityId ? `?facilityId=${facilityId}` : "";
    return http.get<PerformanceSettings>(`/analytics/performance/settings${q}`);
  },
  updatePerformanceSettings(
    facilityId: string | undefined,
    data: Partial<Omit<PerformanceSettings, "facilityId">>,
  ) {
    const q = facilityId ? `?facilityId=${facilityId}` : "";
    return http.patch<PerformanceSettings>(
      `/analytics/performance/settings${q}`,
      data,
    );
  },
  performanceTargets(year: number, facilityId?: string) {
    const q = new URLSearchParams({ year: String(year) });
    if (facilityId) q.set("facilityId", facilityId);
    return http.get<{ facilityId: string; year: number; targets: MonthlyTarget[] }>(
      `/analytics/performance/targets?${q.toString()}`,
    );
  },
  setPerformanceTarget(data: {
    facilityId?: string;
    year: number;
    month: number;
    revenue: number | null;
    occupancyPct?: number | null;
  }) {
    return http.put<MonthlyTarget | null>("/analytics/performance/targets", data);
  },
  performanceOverview(year: number, month: number, facilityId?: string) {
    const q = new URLSearchParams({ year: String(year), month: String(month) });
    if (facilityId) q.set("facilityId", facilityId);
    return http.get<PerformanceOverview>(
      `/analytics/performance/overview?${q.toString()}`,
    );
  },
  performanceInsights(facilityId?: string) {
    const q = facilityId ? `?facilityId=${facilityId}` : "";
    return http.get<{ generatedAt: string; insights: PerformanceInsight[] }>(
      `/analytics/performance/insights${q}`,
    );
  },
  offers(memberIds: string[]) {
    return http.get<Record<string, AbonnementOffer>>(
      `/analytics/performance/offers?memberIds=${encodeURIComponent(memberIds.join(","))}`,
    );
  },
};

export const outreachApi = {
  list() {
    return http.get<OutreachList>("/analytics/outreach");
  },
  log(data: {
    memberId: string;
    reason: OutreachReason;
    channel: OutreachChannel;
    message?: string;
  }) {
    return http.post("/analytics/outreach/log", data);
  },
  push(data: { memberId: string; reason: OutreachReason; message: string }) {
    return http.post("/analytics/outreach/push", data);
  },
  campaigns() {
    return http.get<OutreachCampaign[]>("/analytics/outreach/campaigns");
  },
  campaign(id: string) {
    return http.get<OutreachCampaignDetail>(`/analytics/outreach/campaigns/${id}`);
  },
  segments(groupId?: string | null) {
    return http.get<Record<CampaignSegment, number>>(
      `/analytics/outreach/segments${groupId ? `?groupId=${encodeURIComponent(groupId)}` : ""}`
    );
  },
  createCampaign(data: CampaignInput) {
    return http.post<OutreachCampaign>("/analytics/outreach/campaigns", data);
  },
  updateCampaign(id: string, data: { title?: string; message?: string; status?: "ACTIVE" | "DONE" }) {
    return http.patch<OutreachCampaign>(`/analytics/outreach/campaigns/${id}`, data);
  },
  deleteCampaign(id: string) {
    return http.delete(`/analytics/outreach/campaigns/${id}`);
  },
  logCampaign(id: string, data: { memberId: string; channel: OutreachChannel; message?: string }) {
    return http.post(`/analytics/outreach/campaigns/${id}/log`, data);
  },
};

export const facilityApi = {
  list() {
    return http.get<Facility[]>("/facilities");
  },
  update(id: string, data: Partial<Facility>) {
    return http.put<Facility>(`/facilities/${id}`, data);
  },
  create() {
    return http.post<Facility>("/facilities");
  },
  layout(facilityId?: string) {
    const q = facilityId ? `?facilityId=${facilityId}` : "";
    return http.get<{ facility: Facility | null; spaces: Space[] }>(
      `/facilities/layout${q}`,
    );
  },
  occupancy() {
    return http.get<OccupancyStats>("/facilities/occupancy");
  },
  clearSpaceSeats(spaceId: string, data?: { includePermanent?: boolean }) {
    return http.post<{
      spaceId: string;
      spaceName: string;
      cleared: number;
      seats: string[];
      memberIds: string[];
    }>(`/facilities/spaces/${spaceId}/clear-seats`, data || {});
  },
  awayArrivals(id: string) {
    return http.get<AwayArrivalsResponse>(`/facilities/${id}/away-arrivals`);
  },
  listPromos(facilityId: string) {
    return http.get<AppInstallPromo[]>(`/facilities/${facilityId}/promos`);
  },
  createPromo(
    facilityId: string,
    data: {
      priceId: string;
      valueKind: PromoValueKind;
      value: number;
      sortOrder?: number;
      isActive?: boolean;
    },
  ) {
    return http.post<AppInstallPromo>(
      `/facilities/${facilityId}/promos`,
      data,
    );
  },
  updatePromo(
    promoId: string,
    data: Partial<{
      priceId: string;
      valueKind: PromoValueKind;
      value: number;
      sortOrder: number;
      isActive: boolean;
    }>,
  ) {
    return http.patch<AppInstallPromo>(
      `/facilities/promos/${promoId}`,
      data,
    );
  },
  deletePromo(promoId: string) {
    return http.delete<{ ok: boolean }>(`/facilities/promos/${promoId}`);
  },
  createSpace(data: {
    facilityId: string;
    name: string;
    floorPlanUrl?: string;
    category?: string;
    categories?: string[];
  }) {
    return http.post<Space>("/facilities/spaces", data);
  },
  updateSpace(id: string, data: Partial<Space>) {
    return http.patch<Space>(`/facilities/spaces/${id}`, data);
  },
  deleteSpace(id: string) {
    return http.delete(`/facilities/spaces/${id}`);
  },
  createTable(data: {
    spaceId: string;
    name: string;
    imageUrl?: string;
    galleryUrls?: string[];
    x?: number;
    y?: number;
    seatCount?: number;
    overflowCount?: number;
  }) {
    return http.post<SpaceTable & { seats: SpaceSeat[] }>(
      "/facilities/tables",
      data,
    );
  },
  updateTable(id: string, data: Partial<SpaceTable>) {
    return http.patch<SpaceTable>(`/facilities/tables/${id}`, data);
  },
  deleteTable(id: string) {
    return http.delete(`/facilities/tables/${id}`);
  },
  createSeat(data: {
    spaceId: string;
    tableId?: string;
    label: string;
    offsetX?: number;
    offsetY?: number;
    isOverflow?: boolean;
  }) {
    return http.post<SpaceSeat>("/facilities/seats", data);
  },
  updateSeat(id: string, data: Partial<SpaceSeat>) {
    return http.patch<SpaceSeat>(`/facilities/seats/${id}`, data);
  },
  deleteSeat(id: string) {
    return http.delete(`/facilities/seats/${id}`);
  },
  createWall(data: {
    spaceId: string;
    label?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotation?: number;
  }) {
    return http.post<SpaceWall>("/facilities/walls", data);
  },
  updateWall(id: string, data: Partial<SpaceWall>) {
    return http.patch<SpaceWall>(`/facilities/walls/${id}`, data);
  },
  deleteWall(id: string) {
    return http.delete(`/facilities/walls/${id}`);
  },
  createFixture(data: {
    spaceId: string;
    kind: string;
    label?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotation?: number;
  }) {
    return http.post<SpaceFixture>("/facilities/fixtures", data);
  },
  updateFixture(id: string, data: Partial<SpaceFixture>) {
    return http.patch<SpaceFixture>(`/facilities/fixtures/${id}`, data);
  },
  deleteFixture(id: string) {
    return http.delete(`/facilities/fixtures/${id}`);
  },
};

export const caisseApi = {
  summary(date: Date | string) {
    const d = typeof date === "string" ? date : format(date, "yyyy-MM-dd");
    return http.get<DayFinanceSummary>(`/caisse/summary?date=${d}`);
  },
  open(date: Date | string, openingFloat = 0) {
    const d = typeof date === "string" ? date : format(date, "yyyy-MM-dd");
    return http.post<CaisseSession>("/caisse/open", { date: d, openingFloat });
  },
  close(
    date: Date | string,
    data: { countedClose: number; keptFloat?: number; notes?: string },
  ) {
    const d = typeof date === "string" ? date : format(date, "yyyy-MM-dd");
    return http.post<CaisseSession>("/caisse/close", { date: d, ...data });
  },
  reopen(date: string) {
    return http.post<DayFinanceSummary>("/caisse/reopen", { date });
  },
  setOpeningFloat(date: string, openingFloat: number) {
    return http.post<DayFinanceSummary>("/caisse/opening-float", {
      date,
      openingFloat,
    });
  },
  /** coffre: OUT = drawer → coffre, IN = coffre → drawer */
  addMovement(data: {
    date: string;
    type: "IN" | "OUT";
    amount: number;
    label?: string;
    coffre?: boolean;
  }) {
    return http.post<DayFinanceSummary>("/caisse/movements", data);
  },
  removeMovement(id: string) {
    return http.delete(`/caisse/movements/${id}`);
  },
  removeCoffre(id: string) {
    return http.delete<CoffreSummary>(`/caisse/coffre/${id}`);
  },
  month(year: number, month: number) {
    return http.get<MonthFinanceSummary>(
      `/caisse/month?year=${year}&month=${month}`,
    );
  },
  coffre() {
    return http.get<CoffreSummary>("/caisse/coffre");
  },
  addCoffre(data: {
    type: "IN" | "OUT";
    amount: number;
    label?: string;
    date?: string;
  }) {
    return http.post<CoffreSummary>("/caisse/coffre", data);
  },
  erpPayloadPreview(date: Date | string) {
    const d = typeof date === "string" ? date : format(date, "yyyy-MM-dd");
    return http.get(`/caisse/erp-payload-preview?date=${d}`);
  },
};

export const dailyProductsApi = {
  list() {
    return http.get<DailyProduct[]>("/products/daily/all");
  },
  create(data: { productId: string; quantite: number; date?: string }) {
    return http.post<DailyProduct>("/products/daily", data);
  },
  remove(id: string) {
    return http.delete(`/products/daily/${id}`);
  },
};

export type DailyExpenseInput = {
  amount?: number;
  label?: string;
  date?: string;
  source?: ExpenseSource;
  kind?: "MENSUEL" | "JOURNALIER";
  /** Paying a recurring charge */
  expenseId?: string;
  Summary?: string;
};

export const dailyExpensesApi = {
  list(from: string, to = from) {
    return http.get<DailyExpense[]>(`/expenses/daily?from=${from}&to=${to}`);
  },
  create(data: DailyExpenseInput) {
    return http.post<DailyExpense>("/expenses/daily", data);
  },
  update(id: string, data: DailyExpenseInput) {
    return http.patch<DailyExpense>(`/expenses/daily/${id}`, data);
  },
  remove(id: string) {
    return http.delete(`/expenses/daily/${id}`);
  },
  suggestions() {
    return http.get<ExpenseSuggestion[]>("/expenses/daily/suggestions");
  },
  month(year: number, month: number) {
    return http.get<ExpenseMonthOverview>(
      `/expenses/month?year=${year}&month=${month}`,
    );
  },
};

export const abonnementsApi = {
  list() {
    return http.get<Abonnement[] | PaginatedResponse<Abonnement>>(
      "/abonnements?perPage=1000",
    );
  },
  create(data: Partial<Abonnement>) {
    return http.post<Abonnement>("/abonnements", data);
  },
  update(id: string, data: Partial<Abonnement>) {
    return http.patch<Abonnement>(`/abonnements/${id}`, data);
  },
  remove(id: string) {
    return http.delete<void>(`/abonnements/${id}`);
  },
};

export const productsApi = {
  list() {
    return http.get<Product[]>(withOrgQuery("/products"));
  },
  create(data: Partial<Product>) {
    return http.post<Product>("/products", {
      ...data,
      organizationId:
        data.organizationId || getAdminOrganizationId() || undefined,
    });
  },
  update(id: string, data: Partial<Product>) {
    return http.patch<Product>(`/products/${id}`, data);
  },
  remove(id: string) {
    return http.delete<void>(`/products/${id}`);
  },
};

export const expensesApi = {
  list() {
    return http.get<Expense[]>("/expenses");
  },
  create(data: Partial<Expense>) {
    return http.post<Expense>("/expenses", data);
  },
  update(id: string, data: Partial<Expense>) {
    return http.patch<Expense>(`/expenses/${id}`, data);
  },
  remove(id: string) {
    return http.delete<void>(`/expenses/${id}`);
  },
};

export const opsEventsApi = {
  seatHistory(date: Date | string) {
    const d = typeof date === "string" ? date : format(date, "yyyy-MM-dd");
    return http.get<SeatHistoryDay>(`/ops-events/seat-history?date=${d}`);
  },
};

export const bookingApi = {
  list() {
    return http.get<SeatBooking[]>("/booking");
  },
  create(data: {
    eventKey: string;
    seats: string[];
    memberId: string;
    spaceId?: string;
  }) {
    return http.post<SeatBooking[]>("/booking", data);
  },
  remove(id: string) {
    return http.delete<void>(`/booking/${id}`);
  },
};

export const visitRequestsApi = {
  pending() {
    return http.get<VisitRequest[]>(
      "/mobile/admin/visit-requests?status=PENDING",
    );
  },
  arrivals() {
    return http.get<VisitRequest[]>("/mobile/admin/visit-arrivals");
  },
  acknowledgeArrivals(ids?: string[]) {
    return http.patch<{ acknowledged: number }>(
      "/mobile/admin/visit-arrivals/ack",
      ids?.length ? { ids } : {},
    );
  },
  approve(id: string, data?: { seatLabel?: string; spaceId?: string; occupyWhole?: boolean }) {
    return http.patch<{ request: VisitRequest; result: unknown }>(
      `/mobile/admin/visit-requests/${id}/approve`,
      data || {},
    );
  },
  reject(id: string) {
    return http.patch<VisitRequest>(
      `/mobile/admin/visit-requests/${id}/reject`,
    );
  },
};

export type MobileSession = Journal & {
  seat?: SeatAssignmentInfo | null;
  amountDue?: number;
  overtime?: boolean;
  remainingMs?: number | null;
  expectedLeaveTime?: string | null;
  /** Scan while a session is already running: the existing one is returned. */
  alreadyOpen?: boolean;
  /** Checked out < 59 min ago: the same visit was reopened. */
  resumed?: boolean;
};

export type PricingContextResponse = {
  rules: PricingRules;
  /** Default (JOURNEE) ladder used by AUTO sessions */
  ladder: PricingTier[];
  /** All day pack tiers, any category */
  allTiers: PricingTier[];
};

/** Light abonnement reference (ended / upcoming) on the status payload. */
export type MobileSubscriptionRef = {
  id: string;
  priceId: string;
  name: string;
  registredDate: string;
  leaveDate: string | null;
};

/** Tarif fields used by `TarifIcon` (history rows). */
export type MobileTarifVisual = Pick<
  Price,
  "category" | "categories" | "type" | "billingUnit" | "durationHours" | "periodDays"
>;

export type MobileVisitHistoryItem = {
  id: string;
  date: string;
  registredTime?: string;
  leaveTime?: string | null;
  durationMs?: number;
  durationLabel: string;
  payedAmount: number;
  isPayed: boolean;
  isOpen: boolean;
  priceId?: string | null;
  priceName: string | null;
  price?: MobileTarifVisual | null;
};

export type MobileSubscriptionHistoryItem = {
  id: string;
  priceId: string;
  name: string;
  kind: "HOURS_POOL" | "SEMI_DAY" | "FULL_DAY" | string | null;
  registredDate: string;
  leaveDate: string | null;
  isPayed: boolean;
  payedAmount: number;
  amountDue: number;
  hoursQuota: number | null;
  hoursUsed: number;
  reservedSeatLabel: string | null;
  price: MobileTarifVisual | null;
};

export type MobileStatusResponse = {
  session: MobileSession | null;
  subscription: Abonnement | null;
  hasActiveSubscription: boolean;
  /** Most recent ended abonnement (only when none is active). */
  lastSubscription?: MobileSubscriptionRef | null;
  /** Next abonnement that has not started yet (only when none is active). */
  upcomingSubscription?: MobileSubscriptionRef | null;
  canChooseForfait?: boolean;
  mustScanToEnter?: boolean;
  dailyCreditRemainingHours?: number | null;
  pendingRequest: VisitRequest | null;
  hasOpenSession: boolean;
  seat?: SeatAssignmentInfo | null;
  seatSettings?: MobileSeatSettings;
  member?: Member | null;
};

export const mobileApi = {
  quickCheckIn(data: {
    priceId: string;
    memberId?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    anonymous?: boolean;
    guestName?: string;
    spaceId?: string;
    tableId?: string;
    reserveKind?: "open" | "salle" | "all" | "none";
    hours?: number;
    seatLabel?: string;
    seatLabels?: string[];
    groupVisitId?: string;
  }) {
    return http.post("/mobile/admin/quick-checkin", data);
  },
  clearSpaceToForfait(data: {
    spaceId: string;
    priceId: string;
    includePermanent?: boolean;
    convert?: boolean;
  }) {
    return http.post<{
      spaceId: string;
      spaceName: string;
      cleared: number;
      seats: string[];
      memberIds: string[];
      converted: { memberId: string; ok: boolean; error?: string }[];
    }>("/mobile/admin/clear-space-to-forfait", data);
  },
  bookSpace(data: {
    memberId: string;
    spaceId?: string;
    tableId?: string;
    kind?: "open" | "salle" | "all";
  }) {
    return http.post("/mobile/admin/book-space", data);
  },
  moveSeat(data: {
    memberId?: string;
    fromSeatLabel?: string;
    toSeatLabel: string;
    fromSpaceId?: string;
    toSpaceId?: string;
  }) {
    return http.post("/mobile/admin/move-seat", data);
  },
  checkout(id: string, opts?: { leaveAt?: string; isPayed?: boolean }) {
    return http.patch<{
      id: string;
      payedAmount?: number;
      pointsAwarded?: number;
      newTrophies?: string[];
      memberPoints?: number;
    }>(`/mobile/session/${id}/checkout`, opts ?? {});
  },
  startAutoSession(memberId: string) {
    return http.post<MobileSession>(
      "/mobile/session/start-auto",
      { memberId },
      { skipAuth: true },
    );
  },
  /** Reception: any pack on any open session. */
  fixSessionTariff(id: string, priceId: string) {
    return http.patch<MobileSession>(`/mobile/session/${id}/fix-tariff`, {
      priceId,
      byAdmin: true,
    });
  },
  /** Member: packs still covering the elapsed time, unpaid session only. */
  fixMySessionTariff(id: string, priceId: string, memberId: string) {
    return http.patch<MobileSession>(`/mobile/session/${id}/fix-tariff`, {
      priceId,
      memberId,
    });
  },
  getPricingContext(opts?: { orgSlug?: string; organizationId?: string | null }) {
    const params = new URLSearchParams();
    if (opts?.orgSlug) params.set("org", opts.orgSlug);
    if (opts?.organizationId) params.set("organizationId", opts.organizationId);
    const q = params.toString() ? `?${params}` : "";
    return http.get<PricingContextResponse>(`/mobile/pricing-context${q}`, {
      skipAuth: true,
    });
  },
  setPayment(id: string, isPayed: boolean, billing?: LateBillingMode) {
    return http.patch<{
      id: string;
      pointsAwarded?: number;
      newTrophies?: string[];
      memberPoints?: number;
    }>(`/mobile/session/${id}/payment`, { isPayed, billing });
  },
  register(data: {
    phone: string;
    password?: string;
    firstName?: string;
    requirePassword: boolean;
  }) {
    return http.post<{ member: Member; accessToken: string }>(
      "/mobile/auth/register",
      data,
      { skipAuth: true },
    );
  },
  quickRegister(data: {
    orgSlug: string;
    firstName: string;
    lastName: string;
    phone: string;
  }) {
    return http.post<{ member: Member; accessToken: string }>(
      "/mobile/auth/quick-register",
      data,
      { skipAuth: true },
    );
  },
  login(data: { phone: string; password?: string; orgSlug?: string }) {
    return http.post<{ member: Member; accessToken: string }>(
      "/mobile/auth/login",
      data,
      { skipAuth: true },
    );
  },
  pinLogin(data: { phone: string; pin: string; orgSlug: string }) {
    return http.post<{ member: Member; accessToken: string }>(
      "/mobile/auth/pin-login",
      data,
      { skipAuth: true },
    );
  },
  setPin(data: { memberId: string; pin: string }) {
    return http.post<{ member: Member; accessToken: string }>(
      "/mobile/auth/set-pin",
      data,
      { skipAuth: true },
    );
  },
  consumeMagicLogin(data: {
    token?: string;
    shortCode?: string;
    phone?: string;
    orgSlug?: string;
  }) {
    return http.post<{
      member: Member;
      accessToken: string;
      needsPin?: boolean;
    }>("/mobile/auth/magic-consume", data, { skipAuth: true });
  },
  createMemberLoginToken(memberId: string) {
    return http.post<{
      token: string;
      shortCode: string;
      expiresAt: string;
      member: Member;
    }>(`/mobile/admin/members/${memberId}/login-token`, {});
  },
  status(memberId: string) {
    return http.get<MobileStatusResponse>(`/mobile/status/${memberId}`, {
      skipAuth: true,
    });
  },
  seatSettings(org?: string) {
    const q = org ? `?org=${encodeURIComponent(org)}` : "";
    return http.get<MobileSeatSettings>(`/mobile/seat-settings${q}`, {
      skipAuth: true,
    });
  },
  floorPlan(org?: string, memberId?: string) {
    const q = new URLSearchParams();
    if (org) q.set("org", org);
    if (memberId) q.set("memberId", memberId);
    const qs = q.toString() ? `?${q}` : "";
    return http.get<{
      facility: {
        id: string;
        name: string;
        mobileSeatMode: MobileSeatMode;
        receptionAway: boolean;
        appInstallGlobalPromo?: AppInstallGlobalPromo | null;
        appInstallPromos?: AppInstallPromo[];
        appInstallPromoEligible?: boolean;
      } | null;
      spaces: Space[];
      bookings: SeatBooking[];
      seatSettings: MobileSeatSettings;
    }>(`/mobile/floor-plan${qs}`, { skipAuth: true });
  },
  claimSeat(memberId: string, seatLabel: string, spaceId?: string, org?: string) {
    return http.post<{ seat: SeatAssignmentInfo | null }>(
      "/mobile/session/claim-seat",
      { memberId, seatLabel, spaceId, orgSlug: org },
      { skipAuth: true },
    );
  },
  tarifs(orgSlug?: string) {
    const q = orgSlug ? `?org=${encodeURIComponent(orgSlug)}` : "";
    return http.get<Price[]>(`/mobile/tarifs${q}`, { skipAuth: true });
  },
  createVisitRequest(data: {
    memberId: string;
    priceId: string;
    type: "DAY" | "SUBSCRIPTION";
    seatLabel?: string;
    spaceId?: string;
    occupyWhole?: boolean;
  }) {
    return http.post<
      VisitRequest & {
        autoApproved?: boolean;
        mobileSeatMode?: MobileSeatMode;
        receptionAway?: boolean;
      }
    >("/mobile/visit-request", data, {
      skipAuth: true,
    });
  },
  cancelVisitRequest(id: string, memberId: string) {
    return http.patch<VisitRequest>(
      `/mobile/visit-request/${id}/cancel`,
      { memberId },
      { skipAuth: true },
    );
  },
  getVisitRequest(id: string) {
    return http.get<VisitRequest>(`/mobile/visit-request/${id}`, {
      skipAuth: true,
    });
  },
  history(memberId: string) {
    return http.get<MobileVisitHistoryItem[]>(`/mobile/history/${memberId}`, {
      skipAuth: true,
    });
  },
  subscriptions(memberId: string) {
    return http.get<MobileSubscriptionHistoryItem[]>(
      `/mobile/subscriptions/${memberId}`,
      { skipAuth: true },
    );
  },
  updateProfile(data: {
    memberId: string;
    firstName?: string;
    lastName?: string;
    functionality?: string;
    bio?: string;
    avatarUrl?: string;
    skills?: string[];
    services?: string[];
    linkedinUrl?: string | null;
    openToCollaboration?: boolean;
    showInDirectory?: boolean;
    availability?: MemberAvailability | null;
    lookingFor?: string[];
    todayFocus?: string | null;
    shareAttendance?: boolean;
  }) {
    return http.patch<
      Member & {
        pointsAwarded?: number;
        points?: number;
        newTrophies?: string[];
        profileRewards?: { details: boolean; avatar: boolean };
      }
    >("/mobile/profile", data, { skipAuth: true });
  },
  community(memberId?: string) {
    const q = memberId ? `?memberId=${memberId}` : "";
    return http.get<Member[]>(`/mobile/community${q}`, { skipAuth: true });
  },
  communityFeed(memberId: string) {
    return http.get<import("@/lib/types").CommunityFeed>(
      `/mobile/community/feed?memberId=${encodeURIComponent(memberId)}`,
      { skipAuth: true },
    );
  },
  communityMember(id: string, viewerId?: string) {
    const q = viewerId ? `?viewerId=${encodeURIComponent(viewerId)}` : "";
    return http.get<{
      member: Member;
      events: Array<{
        id: string;
        title: string;
        kind: string;
        startAt: string;
        endAt: string;
        location?: string | null;
        coverImage?: string | null;
        registrationStatus: string;
      }>;
      trophies: Array<
        import("@/lib/points-catalog").TrophyDef & {
          unlocked: boolean;
          unlockedAt: string | null;
        }
      >;
      attendance: {
        streak: number;
        level: import("@/lib/points-catalog").MemberLevel;
        shared: boolean;
      } | null;
    }>(`/mobile/community/member/${id}${q}`, { skipAuth: true });
  },
  myEvents(memberId: string) {
    return http.get<
      Array<{
        id: string;
        title: string;
        kind: string;
        startAt: string;
        endAt: string;
        location?: string | null;
        coverImage?: string | null;
        status: string;
        registrationStatus: string;
      }>
    >(`/mobile/events/mine/${memberId}`, { skipAuth: true });
  },
  products(orgSlug?: string) {
    const q = orgSlug ? `?org=${encodeURIComponent(orgSlug)}` : "";
    return http.get<
      Array<{
        id: string;
        name: string;
        description?: string | null;
        sellingPrice: number;
        stock: number;
        img?: string | null;
      }>
    >(`/mobile/products${q}`, { skipAuth: true });
  },
  order(data: { memberId: string; productId: string; quantity?: number }) {
    return http.post<ProductOrder>("/mobile/order", data, { skipAuth: true });
  },
  updateOrder(id: string, data: { memberId: string; quantity: number }) {
    return http.patch<ProductOrder>(`/mobile/order/${id}`, data, {
      skipAuth: true,
    });
  },
  cancelOrder(id: string, memberId: string) {
    return http.patch<ProductOrder>(
      `/mobile/order/${id}/cancel`,
      { memberId },
      { skipAuth: true },
    );
  },
  orders(memberId: string) {
    return http.get<ProductOrder[]>(`/mobile/orders/${memberId}`, {
      skipAuth: true,
    });
  },
  pendingOrders() {
    return http.get<ProductOrder[]>("/mobile/admin/orders/pending");
  },
  /** Reception adds a product to a member's tab (confirmed immediately). */
  adminCreateOrder(data: {
    /** Omit for an anonymous order (anonymous visit via journalId, or counter sale). */
    memberId?: string | null;
    productId: string;
    quantity?: number;
    isPayed?: boolean;
    journalId?: string | null;
  }) {
    return http.post<ProductOrder>("/mobile/admin/orders", data);
  },
  adminOrders(date?: string) {
    const q = date ? `?date=${date}` : "";
    return http.get<ProductOrder[]>(`/mobile/admin/orders${q}`);
  },
  confirmOrder(id: string) {
    return http.patch<ProductOrder>(`/mobile/admin/orders/${id}/confirm`, {});
  },
  rejectOrder(id: string) {
    return http.patch<ProductOrder>(`/mobile/admin/orders/${id}/reject`, {});
  },
  /** 0 cancels the line and restocks. */
  setOrderQuantity(id: string, quantity: number) {
    return http.patch<ProductOrder>(`/mobile/admin/orders/${id}/quantity`, {
      quantity,
    });
  },
  payOrder(id: string, isPayed: boolean) {
    return http.patch<ProductOrder>(`/mobile/admin/orders/${id}/pay`, {
      isPayed,
    });
  },
  /** `date` is a local yyyy-MM-dd day (defaults to today on the server). */
  payMemberDayOrders(
    memberId: string | null,
    isPayed: boolean,
    date?: string,
    journalId?: string | null,
  ) {
    return http.patch<ProductOrder[]>("/mobile/admin/orders/pay-member-day", {
      memberId,
      isPayed,
      date,
      anonymous: !memberId,
      journalId: memberId ? undefined : journalId ?? null,
    });
  },
  visitorDay(memberId: string) {
    return http.get<{
      seat: SeatAssignmentInfo | null;
      subscription: Abonnement | null;
      session: Journal | null;
      orders: ProductOrder[];
      totals: {
        pack: number;
        products: number;
        productsUnpaid: number;
        grand: number;
      };
    }>(`/mobile/admin/visitor-day/${memberId}`);
  },
  scanIn(memberId: string) {
    return http.post<MobileSession>(
      "/mobile/session/scan-in",
      { memberId },
      { skipAuth: true },
    );
  },
  /** Profile QR ("Mon QR"): signed payload for reception's scanner. */
  memberQr(memberId: string) {
    return http.get<{
      payload: string;
      expiresAt: string;
      checkInCode: string | null;
    }>(`/mobile/qr/${memberId}`, { skipAuth: true });
  },
  getPoints(memberId: string, isPwa: boolean) {
    return http.get<import("@/lib/points-catalog").MemberPointsSnapshot>(
      `/mobile/points/${memberId}?pwa=${isPwa ? "1" : "0"}`,
      { skipAuth: true },
    );
  },
  awardPoints(data: {
    memberId: string;
    event: import("@/lib/points-catalog").PointEvent;
    isPwa: boolean;
  }) {
    return http.post<import("@/lib/points-catalog").AwardPointsResult>(
      "/mobile/points/award",
      data,
      { skipAuth: true },
    );
  },
  claimPoints(memberId: string, isPwa: boolean) {
    return http.post<import("@/lib/points-catalog").ClaimPointsResult>(
      "/mobile/points/claim",
      { memberId, isPwa },
      { skipAuth: true },
    );
  },
  adjustPoints(data: { memberId: string; delta: number; note?: string }) {
    return http.post<{
      delta: number;
      points: number;
      message: string;
    }>("/mobile/admin/points/adjust", data);
  },
  redeemVisitPoints(data: { journalId: string; points: number }) {
    return http.post<{
      journalId: string;
      pointsApplied: number;
      dtCovered: number;
      fullyCovered: boolean;
      isPayed: boolean;
      remainingDue: number;
      memberPoints: number;
    }>("/mobile/admin/points/redeem-visit", data);
  },
  inbox(memberId: string) {
    return http.get<
      Array<{
        peer: Member;
        lastMessage: string;
        lastAt: string;
        unreadHint: boolean;
      }>
    >(`/mobile/messages/${memberId}`, { skipAuth: true });
  },
  thread(memberId: string, peerId: string) {
    return http.get<
      Array<{
        id: string;
        fromMemberId: string;
        toMemberId: string;
        text: string;
        createdAt: string;
      }>
    >(`/mobile/messages/${memberId}/thread/${peerId}`, { skipAuth: true });
  },
  sendMessage(data: {
    fromMemberId: string;
    toMemberId: string;
    text: string;
  }) {
    return http.post("/mobile/messages", data, { skipAuth: true });
  },
  sendStaffMessage(data: {
    memberId: string;
    text: string;
    fromUserId?: string;
  }) {
    return http.post<StaffMessage>("/mobile/admin/staff-message", data);
  },
  sendVisitorStaffMessage(data: { memberId: string; text: string }) {
    return http.post<StaffMessage>("/mobile/staff-message", data, {
      skipAuth: true,
    });
  },
  staffMessages(memberId: string, unreadOnly = false) {
    return http.get<StaffMessage[]>(
      `/mobile/staff-messages/${memberId}${unreadOnly ? "?unread=1" : ""}`,
      { skipAuth: true },
    );
  },
  staffInbox() {
    return http.get<StaffMessage[]>("/mobile/admin/staff-inbox");
  },
  markStaffThreadRead(memberId: string, as: "member" | "staff" = "member") {
    return http.patch<{ ok: boolean }>(
      `/mobile/staff-thread/${memberId}/read`,
      { as },
      { skipAuth: as === "member" },
    );
  },
  markStaffMessageRead(id: string) {
    return http.patch<StaffMessage>(
      `/mobile/staff-messages/${id}/read`,
      {},
      { skipAuth: true },
    );
  },
  lookupPhone(phone: string, orgSlug: string) {
    return http.post<{ exists: boolean; hasPin: boolean; firstName?: string | null }>(
      "/mobile/auth/lookup-phone",
      { phone, orgSlug },
      { skipAuth: true },
    );
  },
  createBookingRequest(data: {
    memberId: string;
    kind: "ROOM" | "SEAT";
    spaceId?: string;
    seatLabel?: string;
    seatSpaceId?: string;
    date: string;
    startTime: string;
    endTime: string;
    note?: string;
  }) {
    return http.post<BookingRequest>("/mobile/booking-request", data, {
      skipAuth: true,
    });
  },
  reviewPrompt(memberId: string) {
    return http.get<{ show: boolean; url: string | null; visits: number }>(
      `/mobile/review/${memberId}`,
      { skipAuth: true },
    );
  },
  markReview(memberId: string, action: "click" | "dismiss") {
    return http.post<{ ok: boolean }>(`/mobile/review/${memberId}/${action}`, {}, {
      skipAuth: true,
    });
  },
  referral(memberId: string) {
    return http.get<{
      code: string;
      invited: number;
      rewarded: number;
      pointsEach: number;
      referred: boolean;
    }>(`/mobile/referral/${memberId}`, { skipAuth: true });
  },
  claimReferral(memberId: string, code: string) {
    return http.post<{ ok: boolean; already: boolean; sponsorFirstName?: string | null }>(
      "/mobile/referral/claim",
      { memberId, code },
      { skipAuth: true },
    );
  },
  publicBookingRequest(data: {
    orgSlug: string;
    firstName: string;
    lastName?: string;
    phone: string;
    kind: "ROOM" | "SEAT";
    spaceId?: string;
    seatLabel?: string;
    seatSpaceId?: string;
    date: string;
    startTime: string;
    endTime: string;
    note?: string;
  }) {
    return http.post<{
      booking: BookingRequest;
      member: Member;
      accessToken: string;
    }>("/mobile/public/booking-request", data, { skipAuth: true });
  },
  myBookingRequests(memberId: string) {
    return http.get<BookingRequest[]>(`/mobile/booking-request/${memberId}`, {
      skipAuth: true,
    });
  },
  cancelBookingRequest(id: string, memberId: string) {
    return http.patch<BookingRequest>(
      `/mobile/booking-request/${id}/cancel`,
      { memberId },
      { skipAuth: true },
    );
  },
};

export const bookingRequestsApi = {
  list(status?: "PENDING" | "APPROVED" | "REJECTED") {
    const q = status ? `?status=${status}` : "";
    return http.get<BookingRequest[]>(`/mobile/admin/booking-requests${q}`);
  },
  pending() {
    return http.get<BookingRequest[]>(
      "/mobile/admin/booking-requests?status=PENDING"
    );
  },
  approve(id: string) {
    return http.patch<BookingRequest>(
      `/mobile/admin/booking-requests/${id}/approve`,
      {}
    );
  },
  reject(id: string) {
    return http.patch<BookingRequest>(
      `/mobile/admin/booking-requests/${id}/reject`,
      {}
    );
  },
};

export const organizationsApi = {
  list() {
    return http.get<Organization[]>("/organizations", { skipAuth: true });
  },
  listCrm() {
    return http.get<Organization[]>("/organizations/crm");
  },
  bySlug(slug: string) {
    return http.get<Organization>(
      `/organizations/${encodeURIComponent(slug)}`,
      { skipAuth: true },
    );
  },
  create(data: {
    name: string;
    slug: string;
    logo?: string | null;
    facebookUrl?: string | null;
    instagramUrl?: string | null;
  }) {
    return http.post<Organization>("/organizations", data);
  },
  update(
    id: string,
    data: Partial<{
      name: string;
      slug: string;
      logo: string | null;
      facebookUrl: string | null;
      instagramUrl: string | null;
    }>,
  ) {
    return http.patch<Organization>(`/organizations/${id}`, data);
  },
  setActivation(
    id: string,
    data: { isActive: boolean; notes?: string | null },
  ) {
    return http.patch<Organization>(
      `/organizations/${id}/activation`,
      data,
    );
  },
};

export const eventsApi = {
  adminList() {
    return http.get<SpaceEvent[]>("/admin/events");
  },
  adminGet(id: string) {
    return http.get<
      SpaceEvent & {
        feedback: {
          count: number;
          average: number | null;
          comments: Array<{
            memberId: string;
            name: string;
            rating: number | null;
            comment: string | null;
            at: string | null;
          }>;
        };
        registrations: Array<{
          id: string;
          status: string;
          attendanceCode: string;
          checkedInAt?: string | null;
          createdAt: string;
          feedbackRating?: number | null;
          feedbackComment?: string | null;
          member: Member;
        }>;
      }
    >(`/admin/events/${id}`);
  },
  create(data: {
    title: string;
    description?: string;
    kind?: EventKind;
    location?: string;
    startAt: string;
    endAt: string;
    capacity?: number | null;
    status?: EventStatus;
    coverImage?: string;
  }) {
    return http.post<SpaceEvent>("/events", data);
  },
  update(
    id: string,
    data: {
      title?: string;
      description?: string;
      kind?: EventKind;
      location?: string;
      startAt?: string;
      endAt?: string;
      capacity?: number | null;
      status?: EventStatus;
      coverImage?: string;
    },
  ) {
    return http.patch<SpaceEvent>(`/events/${id}`, data);
  },
  cancel(id: string) {
    return http.patch<SpaceEvent>(`/events/${id}/cancel`, {});
  },
  markAttendance(id: string, code: string) {
    return http.patch(`/admin/events/${id}/attendance`, { code });
  },
  list(org: string, when: "upcoming" | "past" = "upcoming") {
    return http.get<SpaceEvent[]>(
      `/mobile/events?org=${encodeURIComponent(org)}&when=${when}`,
      { skipAuth: true },
    );
  },
  get(id: string, memberId?: string) {
    const q = memberId ? `?memberId=${memberId}` : "";
    return http.get<SpaceEvent>(`/mobile/events/${id}${q}`, {
      skipAuth: true,
    });
  },
  register(id: string, memberId: string) {
    return http.post(
      `/mobile/events/${id}/register`,
      { memberId },
      {
        skipAuth: true,
      },
    );
  },
  unregister(id: string, memberId: string) {
    return http.delete(`/mobile/events/${id}/register?memberId=${memberId}`, {
      skipAuth: true,
    });
  },
  attendees(id: string, memberId?: string) {
    const q = memberId ? `?memberId=${memberId}` : "";
    return http.get<{
      total: number;
      hiddenCount: number;
      attendees: EventAttendee[];
    }>(`/mobile/events/${id}/attendees${q}`, { skipAuth: true });
  },
  feedback(
    id: string,
    data: { memberId: string; rating: number; comment?: string },
  ) {
    return http.post(`/mobile/events/${id}/feedback`, data, {
      skipAuth: true,
    });
  },
};

export const advisorApi = {
  settings() {
    return http.get<AdvisorSettings>("/advisor/settings");
  },
  saveSettings(data: { businessContext: string }) {
    return http.patch<AdvisorSettings>("/advisor/settings", data);
  },
  reports() {
    return http.get<AdvisorReportSummary[]>("/advisor/reports");
  },
  report(id: string) {
    return http.get<AdvisorReport>(`/advisor/reports/${id}`);
  },
  generate(days: number) {
    return http.post<AdvisorReportSummary>("/advisor/reports", { days });
  },
  prompt(days: number) {
    return http.get<AdvisorPrompt>(`/advisor/prompt?days=${days}`);
  },
  importReport(days: number, result: string) {
    return http.post<AdvisorReportSummary>("/advisor/reports/import", { days, result });
  },
  dataCheck() {
    return http.get<AdvisorDataIssue[]>("/advisor/data-check");
  },
  initiatives() {
    return http.get<BusinessInitiative[]>("/advisor/initiatives");
  },
  createInitiative(data: {
    title: string;
    description?: string;
    category: AdvisorCategory;
    startDate: string;
    sourceReportId?: string;
    recommendationTitle?: string;
    metric?: AdviceMetric;
    targetPct?: number | null;
    cost?: number | null;
    targetKind?: TargetKind;
    targetDays?: number[];
    targetFromHour?: number | null;
    targetToHour?: number | null;
    targetSegment?: string | null;
    linkedKind?: LinkedKind | null;
    linkedId?: string | null;
  }) {
    return http.post<BusinessInitiative>("/advisor/initiatives", data);
  },
  updateInitiative(
    id: string,
    data: Partial<{
      title: string;
      description: string | null;
      endDate: string | null;
      metric: AdviceMetric | null;
      targetPct: number | null;
      cost: number | null;
      ownerVerdict: InitiativeVerdict | null;
      notes: InitiativeNote[];
    }>,
  ) {
    return http.patch<BusinessInitiative>(`/advisor/initiatives/${id}`, data);
  },
  deleteInitiative(id: string) {
    return http.delete(`/advisor/initiatives/${id}`);
  },
  missing() {
    return http.get<AdvisorMissing>("/advisor/missing");
  },
  location() {
    return http.get<AdvisorLocation>("/advisor/location");
  },
  setLocation(data: { input?: string; latitude?: number | null; longitude?: number | null }) {
    return http.patch<AdvisorLocation>("/advisor/location", data);
  },
  nearby(radius = 700) {
    return http.get<AdvisorNearbyPlace[]>(`/advisor/nearby?radius=${radius}`);
  },
  facts() {
    return http.get<AdvisorFact[]>("/advisor/facts");
  },
  createFact(data: Partial<Omit<AdvisorFact, "id">>) {
    return http.post<AdvisorFact>("/advisor/facts", data);
  },
  updateFact(id: string, data: Partial<Omit<AdvisorFact, "id" | "kind">>) {
    return http.patch<AdvisorFact>(`/advisor/facts/${id}`, data);
  },
  deleteFact(id: string) {
    return http.delete(`/advisor/facts/${id}`);
  },
  seedHolidays() {
    return http.post<{ added: number }>("/advisor/facts/holidays", {});
  },
  questions() {
    return http.get<AdvisorQuestion[]>("/advisor/questions");
  },
  answerQuestion(id: string, data: { answer?: string | null; status?: "DISMISSED" }) {
    return http.patch<AdvisorQuestion>(`/advisor/questions/${id}`, data);
  },
};

export const promotionsApi = {
  list() {
    return http.get<Promotion[]>("/promotions");
  },
  create(data: PromotionInput) {
    return http.post<Promotion>("/promotions", data);
  },
  update(id: string, data: PromotionInput) {
    return http.patch<Promotion>(`/promotions/${id}`, data);
  },
  remove(id: string) {
    return http.delete(`/promotions/${id}`);
  },
  /** Member app: live offers for this member */
  forMember(orgSlug: string, memberId?: string | null) {
    const q = new URLSearchParams({ orgSlug });
    if (memberId) q.set("memberId", memberId);
    return http.get<Promotion[]>(`/mobile/promotions?${q}`, { skipAuth: true });
  },
  track(id: string, kind: "view" | "click") {
    return http.post(`/mobile/promotions/${id}/track`, { kind }, { skipAuth: true });
  },
};

export const staffApi = {
  me() {
    return http.get<{
      isStaff: boolean;
      role: string;
      organizations: Array<{ organizationId: string; permissions: StaffPermissions }>;
    }>("/staff/me");
  },
  list() {
    return http.get<StaffMember[]>(withOrgQuery("/staff"));
  },
  create(data: {
    fullname: string;
    identifier: string;
    password: string;
    permissions: StaffPermissions;
  }) {
    return http.post<StaffMember>("/staff", {
      ...data,
      organizationId: getAdminOrganizationId(),
    });
  },
  update(
    id: string,
    data: Partial<{
      fullname: string;
      password: string;
      isActive: boolean;
      permissions: StaffPermissions;
    }>
  ) {
    return http.patch<StaffMember>(`/staff/${id}`, {
      ...data,
      organizationId: getAdminOrganizationId(),
    });
  },
  remove(id: string) {
    return http.delete<{ ok: boolean }>(withOrgQuery(`/staff/${id}`));
  },
  actions(params: { status?: string; userId?: string; module?: string; page?: number }) {
    const q = new URLSearchParams();
    if (params.status) q.set("status", params.status);
    if (params.userId) q.set("userId", params.userId);
    if (params.module) q.set("module", params.module);
    q.set("page", String(params.page || 1));
    q.set("perPage", "50");
    return http.get<{ total: number; page: number; perPage: number; data: StaffActionRow[] }>(
      withOrgQuery(`/staff/actions?${q.toString()}`)
    );
  },
  summary() {
    return http.get<{ pending: number; hidden: number }>(withOrgQuery("/staff/actions/summary"));
  },
  review(id: string, decision: "confirm" | "revert", note?: string) {
    return http.patch(`/staff/actions/${id}/${decision}`, { note });
  },
  confirmMany(ids?: string[]) {
    return http.post<{ confirmed: number; errors: string[] }>("/staff/actions/confirm-all", {
      organizationId: getAdminOrganizationId(),
      ids,
    });
  },
};
