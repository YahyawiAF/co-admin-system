import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_URL } from "../config/axios";
import { Price } from "src/types/shared";

export const priceApi = createApi({
  reducerPath: "priceApi",
  baseQuery: fetchBaseQuery({ baseUrl: API_URL }),
  tagTypes: ["Price"],
  endpoints: (builder) => ({
    getPrices: builder.query<Price[], void>({
      query: () => `prices`,
      providesTags: ["Price"],
    }),
    getPriceById: builder.query<Price, string>({
      query: (id) => `prices/${id}`,
      providesTags: ["Price"],
    }),
    createPrice: builder.mutation<
      Price,
      Omit<Price, "id" | "createdAt" | "updatedAt" | "journals">
    >({
      query: (data) => ({
        url: `prices`,
        method: "POST",
        body: {
          name: data.name,
          price: data.price,
          timePeriod: data.timePeriod,
          type: data.type,
          category: data.category,
          durationHours: data.durationHours,
          billingUnit: data.billingUnit,
          periodDays: data.periodDays,
        },
      }),
      invalidatesTags: ["Price"],
    }),
    updatePrice: builder.mutation<
      Price,
      {
        id: string;
        data: Partial<
          Omit<Price, "id" | "createdAt" | "updatedAt" | "journals">
        >;
      }
    >({
      query: ({ id, data }) => ({
        url: `prices/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: ["Price"],
    }),
    deletePrice: builder.mutation<void, string>({
      query: (id) => ({
        url: `prices/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Price"],
    }),
    seedCollaboraHub: builder.mutation<
      { created: number; skipped: number; prices: Price[] },
      void
    >({
      query: () => ({
        url: `prices/seed/collabora-hub`,
        method: "POST",
      }),
      invalidatesTags: ["Price"],
    }),
  }),
});

export const {
  useGetPricesQuery,
  useGetPriceByIdQuery,
  useCreatePriceMutation,
  useUpdatePriceMutation,
  useDeletePriceMutation,
  useSeedCollaboraHubMutation,
} = priceApi;

export type { Price };
