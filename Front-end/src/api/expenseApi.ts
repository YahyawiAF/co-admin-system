import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_URL } from "../config/axios";
import { Expenses, ExpenseType } from "src/types/shared";

export const expenseApi = createApi({
    reducerPath: "expenseApi",
    baseQuery: fetchBaseQuery({ baseUrl: API_URL }),
    tagTypes: ["Expense"],
    endpoints: (builder) => ({
        getExpenses: builder.query<Expenses[], void>({
            query: () => `expenses`,
            transformResponse: (response: any[]) =>
                response.map(expense => ({
                    ...expense,
                    amount: Number(expense.amount ?? 0),
                   
                })),
            providesTags: (result) =>
                result
                    ? [
                        ...result.map(({ id }) => ({ type: "Expense" as const, id })),
                        { type: "Expense", id: "LIST" },
                    ]
                    : [{ type: "Expense", id: "LIST" }],
        }),

        getExpenseById: builder.query<Expenses, string>({
            query: (id) => `expenses/${id}`,
            transformResponse: (response: any) => ({
                ...response,
                amount: Number(response.amount),
               
            }),
            providesTags: (result, error, id) => [{ type: "Expense", id }],
        }),

        createExpense: builder.mutation<
            Expenses,
            Omit<Expenses, "id" | "createdAt" | "updatedAt">
        >({
            query: (data) => ({
                url: `expenses`,
                method: "POST",
                body: {
                    ...data,
                    amount: Number(data.amount)
                }
            }),
            invalidatesTags: [{ type: "Expense", id: "LIST" }],
        }),

        updateExpense: builder.mutation<
            Expenses,
            {
                id: string;
                data: Partial<Omit<Expenses, "id" | "createdAt" | "updatedAt">>;
            }
        >({
            query: ({ id, data }) => {
                if (data.amount !== undefined && isNaN(data.amount)) {
                    throw new Error("Montant invalide");
                }
                
                return {
                    url: `expenses/${id}`,
                    method: "PATCH",
                    body: {
                        ...data,
                        amount: data.amount ? Number(data.amount.toFixed(2)) : undefined
                    }
                };
            },
            invalidatesTags: (result, error, { id }) => [{ type: "Expense", id }],
        }),

        deleteExpense: builder.mutation<void, string>({
            query: (id) => ({
                url: `expenses/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: (result, error, id) => [
                { type: "Expense", id },
                { type: "Expense", id: "LIST" },
            ],
        }),
    }),
});

// Export des hooks
export const {
    useGetExpensesQuery,
    useGetExpenseByIdQuery,
    useCreateExpenseMutation,
    useUpdateExpenseMutation,
    useDeleteExpenseMutation,
} = expenseApi;