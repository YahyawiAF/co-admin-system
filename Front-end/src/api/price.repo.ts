import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_URL } from "../config/axios";
import { Price } from "src/types/shared";

export const priceApi = createApi({
  reducerPath: "priceApi",
  baseQuery: fetchBaseQuery({ baseUrl: API_URL }),
  tagTypes: ["Price"],
  endpoints: (builder) => ({
    getPrices: builder.query<Price[], void>({
      query: () => `prices/all`,
      providesTags: ["Price"],
    }),
    getPriceById: builder.query<Price, string>({
      query: (id) => `prices/${id}`,
      providesTags: ["Price"],
    }),
    createPrice: builder.mutation<Price, Partial<Price>>({
      query: (data) => ({
        url: `prices/add`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Price"],
    }),
    updatePrice: builder.mutation<Price, { id: string; data: Partial<Price> }>({
      query: ({ id, data }) => ({
        url: `prices/update/${id}`,
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
  }),
});

export const {
  useGetPricesQuery,
  useGetPriceByIdQuery,
  useCreatePriceMutation,
  useUpdatePriceMutation,
  useDeletePriceMutation,
} = priceApi;
