import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_URL } from "../config/axios";
import { TransactionRes } from "src/types/shared";

export const transactionsServerApi = createApi({
  reducerPath: "transactions",
  baseQuery: fetchBaseQuery({ baseUrl: API_URL }),
  tagTypes: ["transactions"],
  endpoints: (builder) => ({
    getTransactions: builder.query<TransactionRes, void>({
      query: () => `transactions`,
      providesTags: ["transactions"],
    }),
  }),
});

export const { useGetTransactionsQuery } = transactionsServerApi;
