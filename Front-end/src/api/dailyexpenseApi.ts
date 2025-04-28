import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_URL } from "../config/axios";
import { DailyExpense, ExpenseType, Expenses } from "src/types/shared";

export const dailyExpenseApi = createApi({
  reducerPath: "dailyExpenseApi",
  baseQuery: fetchBaseQuery({ baseUrl: API_URL }),
  tagTypes: ["DailyExpense"],
  endpoints: (builder) => ({
    getAllDailyExpenses: builder.query<DailyExpense[], void>({
      query: () => `expenses/daily/all`,
      transformResponse: (response: any[]) =>
        response.map((expense) => ({
          id: expense.id,
          expenseId: expense.expenseId,
          date: expense.date ? new Date(expense.date).toISOString() : undefined,
          Summary: expense.Summary || undefined,
          createdAt: expense.createdAt || new Date().toISOString(),
          updatedAt: expense.updatedAt || new Date().toISOString(),
          expense: expense.expense || {
            id: expense.expenseId,
            name: "Inconnu",
            description: "",
            amount: 0,
            type: "JOURNALIER" as ExpenseType,
            createdAt: expense.createdAt || new Date().toISOString(),
            updatedAt: expense.updatedAt || new Date().toISOString(),
          },
        })),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({
                type: "DailyExpense" as const,
                id,
              })),
              { type: "DailyExpense", id: "LIST" },
            ]
          : [{ type: "DailyExpense", id: "LIST" }],
    }),

    getDailyExpenseById: builder.query<DailyExpense, string>({
      query: (id) => `expenses/daily/${id}`,
      transformResponse: (response: any) => ({
        id: response.id,
        expenseId: response.expenseId,
        date: response.date ? new Date(response.date).toISOString() : undefined,
        Summary: response.Summary || undefined,
        createdAt: response.createdAt || new Date().toISOString(),
        updatedAt: response.updatedAt || new Date().toISOString(),
        expense: response.expense || {
          id: response.expenseId,
          name: "Inconnu",
          description: "",
          amount: 0,
          type: "JOURNALIER" as ExpenseType,
          createdAt: response.createdAt || new Date().toISOString(),
          updatedAt: response.updatedAt || new Date().toISOString(),
        },
      }),
      providesTags: (result, error, id) => [{ type: "DailyExpense", id }],
    }),

    createDailyExpense: builder.mutation<
      DailyExpense,
      { expenseId: string; date?: string; Summary?: string }
    >({
      query: (data) => ({
        url: `expenses/daily`,
        method: "POST",
        body: {
          expenseId: data.expenseId,
          date: data.date ? new Date(data.date).toISOString() : undefined,
          Summary: data.Summary || undefined,
        },
      }),
      transformResponse: (response: any) => ({
        id: response.id,
        expenseId: response.expenseId,
        date: response.date ? new Date(response.date).toISOString() : undefined,
        Summary: response.Summary || undefined,
        createdAt: response.createdAt || new Date().toISOString(),
        updatedAt: response.updatedAt || new Date().toISOString(),
        expense: response.expense || {
          id: response.expenseId,
          name: "Inconnu",
          description: "",
          amount: 0,
          type: "JOURNALIER" as ExpenseType,
          createdAt: response.createdAt || new Date().toISOString(),
          updatedAt: response.updatedAt || new Date().toISOString(),
        },
      }),
      invalidatesTags: [{ type: "DailyExpense", id: "LIST" }],
    }),

    updateDailyExpense: builder.mutation<
      DailyExpense,
      {
        id: string;
        data: { expenseId?: string; date?: string; Summary?: string };
      }
    >({
      query: ({ id, data }) => ({
        url: `expenses/daily/${id}`,
        method: "PATCH",
        body: {
          expenseId: data.expenseId,
          date: data.date ? new Date(data.date).toISOString() : undefined,
          Summary: data.Summary || undefined,
        },
      }),
      transformResponse: (response: any) => ({
        id: response.id,
        expenseId: response.expenseId,
        date: response.date ? new Date(response.date).toISOString() : undefined,
        Summary: response.Summary || undefined,
        createdAt: response.createdAt || new Date().toISOString(),
        updatedAt: response.updatedAt || new Date().toISOString(),
        expense: response.expense || {
          id: response.expenseId,
          name: "Inconnu",
          description: "",
          amount: 0,
          type: "JOURNALIER" as ExpenseType,
          createdAt: response.createdAt || new Date().toISOString(),
          updatedAt: response.updatedAt || new Date().toISOString(),
        },
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "DailyExpense", id },
        { type: "DailyExpense", id: "LIST" },
      ],
    }),

    deleteDailyExpense: builder.mutation<void, string>({
      query: (id) => ({
        url: `expenses/daily/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, id) => [
        { type: "DailyExpense", id },
        { type: "DailyExpense", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useGetAllDailyExpensesQuery,
  useGetDailyExpenseByIdQuery,
  useCreateDailyExpenseMutation,
  useUpdateDailyExpenseMutation,
  useDeleteDailyExpenseMutation,
} = dailyExpenseApi;