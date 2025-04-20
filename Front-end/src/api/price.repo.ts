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
          timePeriod: data.timePeriod, // Format { start: string, end: string }
          type: data.type,
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
        body: {
          ...data,
          timePeriod: data.timePeriod, // Format { start: string, end: string }
        },
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
  }),
});

export const {
  useGetPricesQuery,
  useGetPriceByIdQuery,
  useCreatePriceMutation,
  useUpdatePriceMutation,
  useDeletePriceMutation,
} = priceApi;

export type { Price };
