import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_URL } from "../config/axios";
import { ExpensesRes } from "src/types/shared";

export const expensesServerApi = createApi({
  reducerPath: "expenses",
  baseQuery: fetchBaseQuery({ baseUrl: API_URL }),
  tagTypes: ["expenses"],
  endpoints: (builder) => ({
    getExpenses: builder.query<ExpensesRes, void>({
      query: () => `expenses`,
      providesTags: ["expenses"],
    }),
  }),
});

export const { useGetExpensesQuery } = expensesServerApi;
