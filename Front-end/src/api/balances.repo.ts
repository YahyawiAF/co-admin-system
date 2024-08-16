import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_URL } from "../config/axios";
import { Balance } from "src/types/shared";

export const balancesServerApi = createApi({
  reducerPath: "balances",
  baseQuery: fetchBaseQuery({ baseUrl: API_URL }),
  tagTypes: ["balances"],
  endpoints: (builder) => ({
    getBalances: builder.query<Balance, void>({
      query: () => `balances`,
      providesTags: ["balances"],
    }),
  }),
});

export const { useGetBalancesQuery } = balancesServerApi;
