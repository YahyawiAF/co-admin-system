import { http } from "./httpClient";
import { withOrgQuery, getAdminOrganizationId } from "@/lib/admin-org";
import type {
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
  MemberGroup,
  SeatOccupant,
  Organization,
  SpaceEvent,
  EventAttendee,
  EventKind,
  EventStatus,
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

export type Expense = {
  id: string;
  name: string;
  description?: string;
  amount: number;
  type: "MENSUEL" | "JOURNALIER";
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
};

export type DailyExpense = {
  id: string;
  expenseId: string;
  date?: string | null;
  Summary?: string | null;
  expense?: Expense;
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
  seedCollaboraHub() {
    return http.post<{ created: number; skipped: number; prices: Price[] }>(
      "/prices/seed/collabora-hub",
    );
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
  createSpace(data: {
    facilityId: string;
    name: string;
    floorPlanUrl?: string;
    category?: string;
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
  close(date: Date | string, countedClose: number, notes?: string) {
    const d = typeof date === "string" ? date : format(date, "yyyy-MM-dd");
    return http.post<CaisseSession>("/caisse/close", {
      date: d,
      countedClose,
      notes,
    });
  },
  addMovement(
    sessionId: string,
    data: { type: "IN" | "OUT"; amount: number; label?: string },
  ) {
    return http.post(`/caisse/${sessionId}/movements`, data);
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

export const dailyExpensesApi = {
  list() {
    return http.get<DailyExpense[]>("/expenses/daily/all");
  },
  create(data: { expenseId: string; Summary?: string; date?: string }) {
    return http.post<DailyExpense>("/expenses/daily", data);
  },
  remove(id: string) {
    return http.delete(`/expenses/daily/${id}`);
  },
};

export const abonnementsApi = {
  list() {
    return http.get<Abonnement[] | PaginatedResponse<Abonnement>>(
      "/abonnements",
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
  approve(id: string, data?: { seatLabel?: string; spaceId?: string }) {
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

export const mobileApi = {
  quickCheckIn(data: {
    priceId: string;
    memberId?: string;
    phone?: string;
    firstName?: string;
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
  checkout(id: string) {
    return http.patch(`/mobile/session/${id}/checkout`, {});
  },
  setPayment(id: string, isPayed: boolean) {
    return http.patch(`/mobile/session/${id}/payment`, { isPayed });
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
    return http.get<{
      session:
        | (Journal & {
            seat?: SeatAssignmentInfo | null;
            amountDue?: number;
            overtime?: boolean;
            remainingMs?: number | null;
          })
        | null;
      subscription: Abonnement | null;
      hasActiveSubscription: boolean;
      canChooseForfait?: boolean;
      mustScanToEnter?: boolean;
      dailyCreditRemainingHours?: number | null;
      pendingRequest: VisitRequest | null;
      hasOpenSession: boolean;
      seat?: SeatAssignmentInfo | null;
      seatSettings?: MobileSeatSettings;
      member?: Member | null;
    }>(`/mobile/status/${memberId}`, { skipAuth: true });
  },
  seatSettings(org?: string) {
    const q = org ? `?org=${encodeURIComponent(org)}` : "";
    return http.get<MobileSeatSettings>(`/mobile/seat-settings${q}`, {
      skipAuth: true,
    });
  },
  floorPlan(org?: string) {
    const q = org ? `?org=${encodeURIComponent(org)}` : "";
    return http.get<{
      facility: {
        id: string;
        name: string;
        mobileSeatMode: MobileSeatMode;
        receptionAway: boolean;
      } | null;
      spaces: Space[];
      bookings: SeatBooking[];
      seatSettings: MobileSeatSettings;
    }>(`/mobile/floor-plan${q}`, { skipAuth: true });
  },
  claimSeat(memberId: string, seatLabel: string, spaceId?: string) {
    return http.post<{ seat: SeatAssignmentInfo | null }>(
      "/mobile/session/claim-seat",
      { memberId, seatLabel, spaceId },
      { skipAuth: true },
    );
  },
  tarifs() {
    return http.get<Price[]>("/mobile/tarifs", { skipAuth: true });
  },
  createVisitRequest(data: {
    memberId: string;
    priceId: string;
    type: "DAY" | "SUBSCRIPTION";
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
    return http.get<
      Array<{
        id: string;
        date: string;
        durationLabel: string;
        payedAmount: number;
        isPayed: boolean;
        isOpen: boolean;
        priceName: string | null;
      }>
    >(`/mobile/history/${memberId}`, { skipAuth: true });
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
  }) {
    return http.patch<Member>("/mobile/profile", data, { skipAuth: true });
  },
  community(memberId?: string) {
    const q = memberId ? `?memberId=${memberId}` : "";
    return http.get<Member[]>(`/mobile/community${q}`, { skipAuth: true });
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
  payOrder(id: string, isPayed: boolean) {
    return http.patch<ProductOrder>(`/mobile/admin/orders/${id}/pay`, {
      isPayed,
    });
  },
  payMemberDayOrders(memberId: string, isPayed: boolean) {
    return http.patch<ProductOrder[]>("/mobile/admin/orders/pay-member-day", {
      memberId,
      isPayed,
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
    return http.post(
      "/mobile/session/scan-in",
      { memberId },
      { skipAuth: true },
    );
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
