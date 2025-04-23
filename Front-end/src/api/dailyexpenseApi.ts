// src/services/dailyExpenseApi.ts
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_URL } from "../config/axios";
import { ExpenseType } from "src/types/shared";

export interface DailyExpense {
    id: string;
    expenseId: string;
    date: string;
    expense?: {
        id: string;
        name: string;
        description?: string;
        amount: number;
        type: ExpenseType;
        createdAt: string;
        updatedAt: string;
    };
}

export const dailyExpenseApi = createApi({
    reducerPath: "dailyExpenseApi",
    baseQuery: fetchBaseQuery({ baseUrl: API_URL }),
    tagTypes: ["DailyExpense"],
    endpoints: (builder) => ({
        getAllDailyExpenses: builder.query<DailyExpense[], void>({
            query: () => `expenses/daily/all`,
            transformResponse: (response: any[]) =>
                response.map((expense) => ({
                    ...expense,
                    date: new Date(expense.date).toISOString(),
                })),
            providesTags: (result) =>
                result
                    ? [
                        ...result.map(({ id }) => ({ type: "DailyExpense" as const, id })),
                        { type: "DailyExpense", id: "LIST" },
                    ]
                    : [{ type: "DailyExpense", id: "LIST" }],
        }),

        getDailyExpenseById: builder.query<DailyExpense, string>({
            query: (id) => `expenses/daily/${id}`,
            transformResponse: (response: any) => ({
                ...response,
                date: new Date(response.date).toISOString(),
            }),
            providesTags: (result, error, id) => [{ type: "DailyExpense", id }],
        }),

        createDailyExpense: builder.mutation<
            DailyExpense,
            { expenseId: string; date?: string }
        >({
            query: (data) => ({
                url: `expenses/daily`,
                method: "POST",
                body: {
                    expenseId: data.expenseId,
                    date: data.date ? new Date(data.date).toISOString() : undefined,
                },
            }),
            invalidatesTags: [{ type: "DailyExpense", id: "LIST" }],
        }),

        updateDailyExpense: builder.mutation<
            DailyExpense,
            {
                id: string;
                data: { expenseId?: string; date?: string };
            }
        >({
            query: ({ id, data }) => ({
                url: `expenses/daily/${id}`,
                method: "PATCH",
                body: {
                    expenseId: data.expenseId,
                    date: data.date ? new Date(data.date).toISOString() : undefined,
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

// Export des hooks
export const {
    useGetAllDailyExpensesQuery,
    useGetDailyExpenseByIdQuery,
    useCreateDailyExpenseMutation,
    useUpdateDailyExpenseMutation,
    useDeleteDailyExpenseMutation,
} = dailyExpenseApi;