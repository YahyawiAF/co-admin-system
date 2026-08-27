import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_URL } from "../config/axios";
import { Abonnement, Journal, Member, Price } from "src/types/shared";

export type MobileMember = Pick<
  Member,
  "id" | "phone" | "firstName" | "lastName" | "plan" | "isActive"
> & {
  visitorNumber?: number | null;
  isSubscribed?: boolean;
};

export type EnrichedSession = Journal & {
  expectedLeaveTime?: string | null;
  remainingMs?: number | null;
  overtime?: boolean;
  amountDue?: number;
  coveredBySubscription?: boolean;
  prices?: Price | null;
};

export type VisitRequestType = "DAY" | "SUBSCRIPTION";
export type VisitRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export type VisitRequest = {
  id: string;
  memberId: string;
  priceId: string;
  type: VisitRequestType;
  status: VisitRequestStatus;
  createdAt: string;
  visitorNumber?: number | null;
  member?: MobileMember & { phone?: string | null; visitorNumber?: number | null };
  price?: Price;
};

export const mobileApi = createApi({
  reducerPath: "mobileApi",
  baseQuery: fetchBaseQuery({ baseUrl: API_URL }),
  tagTypes: ["MobileStatus", "MobileTarifs", "VisitRequests", "VisitHistory"],
  endpoints: (builder) => ({
    mobileRegister: builder.mutation<
      { member: MobileMember; accessToken: string },
      {
        phone: string;
        password?: string;
        firstName?: string;
        requirePassword: boolean;
      }
    >({
      query: (body) => ({
        url: "mobile/auth/register",
        method: "POST",
        body,
      }),
    }),
    mobileLogin: builder.mutation<
      { member: MobileMember; accessToken: string },
      { phone: string; password?: string }
    >({
      query: (body) => ({
        url: "mobile/auth/login",
        method: "POST",
        body,
      }),
    }),
    getMobileTarifs: builder.query<Price[], void>({
      query: () => "mobile/tarifs",
      providesTags: ["MobileTarifs"],
    }),
    getMobileStatus: builder.query<
      {
        session: EnrichedSession | null;
        subscription: Abonnement | null;
        hasActiveSubscription: boolean;
        hasOpenSession?: boolean;
        pendingRequest?: VisitRequest | null;
      },
      string
    >({
      query: (memberId) => `mobile/status/${memberId}`,
      providesTags: ["MobileStatus"],
    }),
    resumeByPhone: builder.query<
      {
        member: MobileMember;
        accessToken: string;
        session: EnrichedSession | null;
        subscription: Abonnement | null;
        hasActiveSubscription: boolean;
      },
      string
    >({
      query: (phone) => `mobile/resume?phone=${encodeURIComponent(phone)}`,
    }),
    startDaySession: builder.mutation<
      EnrichedSession,
      { memberId: string; priceId: string }
    >({
      query: (body) => ({
        url: "mobile/session/start",
        method: "POST",
        body,
      }),
      invalidatesTags: ["MobileStatus"],
    }),
    checkoutSession: builder.mutation<
      Journal,
      { id: string; isPayed?: boolean }
    >({
      query: ({ id, isPayed }) => ({
        url: `mobile/session/${id}/checkout`,
        method: "PATCH",
        body: isPayed === undefined ? {} : { isPayed },
      }),
      invalidatesTags: ["MobileStatus", "VisitHistory"],
    }),
    setSessionPayment: builder.mutation<
      Journal,
      { id: string; isPayed: boolean }
    >({
      query: ({ id, isPayed }) => ({
        url: `mobile/session/${id}/payment`,
        method: "PATCH",
        body: { isPayed },
      }),
      invalidatesTags: ["MobileStatus", "VisitHistory"],
    }),
    getVisitHistory: builder.query<
      Array<{
        id: string;
        date: string;
        registredTime: string;
        leaveTime: string | null;
        durationMs: number;
        durationLabel: string;
        payedAmount: number;
        isPayed: boolean;
        isOpen: boolean;
        priceName: string | null;
      }>,
      string
    >({
      query: (memberId) => `mobile/history/${memberId}`,
      providesTags: ["VisitHistory"],
    }),
    startSubscription: builder.mutation<
      Abonnement,
      { memberId: string; priceId: string; isPayed?: boolean }
    >({
      query: (body) => ({
        url: "mobile/subscription/start",
        method: "POST",
        body,
      }),
      invalidatesTags: ["MobileStatus"],
    }),
    quickCheckIn: builder.mutation<
      EnrichedSession,
      {
        memberId?: string;
        priceId: string;
        phone?: string;
        firstName?: string;
      }
    >({
      query: (body) => ({
        url: "mobile/admin/quick-checkin",
        method: "POST",
        body,
      }),
      invalidatesTags: ["MobileStatus"],
    }),
    createVisitRequest: builder.mutation<
      VisitRequest,
      { memberId: string; priceId: string; type: VisitRequestType }
    >({
      query: (body) => ({
        url: "mobile/visit-request",
        method: "POST",
        body,
      }),
      invalidatesTags: ["VisitRequests", "MobileStatus"],
    }),
    getVisitRequest: builder.query<VisitRequest, string>({
      query: (id) => `mobile/visit-request/${id}`,
    }),
    getPendingVisitRequests: builder.query<VisitRequest[], void>({
      query: () => "mobile/admin/visit-requests?status=PENDING",
      providesTags: ["VisitRequests"],
    }),
    approveVisitRequest: builder.mutation<
      { request: VisitRequest; result: unknown },
      string
    >({
      query: (id) => ({
        url: `mobile/admin/visit-requests/${id}/approve`,
        method: "PATCH",
      }),
      invalidatesTags: ["VisitRequests", "MobileStatus"],
    }),
    rejectVisitRequest: builder.mutation<VisitRequest, string>({
      query: (id) => ({
        url: `mobile/admin/visit-requests/${id}/reject`,
        method: "PATCH",
      }),
      invalidatesTags: ["VisitRequests", "MobileStatus"],
    }),
    cancelVisitRequest: builder.mutation<
      VisitRequest,
      { id: string; memberId: string }
    >({
      query: ({ id, memberId }) => ({
        url: `mobile/visit-request/${id}/cancel`,
        method: "PATCH",
        body: { memberId },
      }),
      invalidatesTags: ["VisitRequests", "MobileStatus"],
    }),
  }),
});

export const {
  useMobileRegisterMutation,
  useMobileLoginMutation,
  useGetMobileTarifsQuery,
  useGetMobileStatusQuery,
  useLazyResumeByPhoneQuery,
  useStartDaySessionMutation,
  useCheckoutSessionMutation,
  useSetSessionPaymentMutation,
  useStartSubscriptionMutation,
  useQuickCheckInMutation,
  useCreateVisitRequestMutation,
  useGetVisitRequestQuery,
  useGetPendingVisitRequestsQuery,
  useApproveVisitRequestMutation,
  useRejectVisitRequestMutation,
  useCancelVisitRequestMutation,
  useGetVisitHistoryQuery,
} = mobileApi;
