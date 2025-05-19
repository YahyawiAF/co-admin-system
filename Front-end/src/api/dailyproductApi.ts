import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_URL } from "../config/axios";
import { DailyProduct, Product } from "src/types/shared";

export const dailyProductApi = createApi({
  reducerPath: "dailyProductApi",
  baseQuery: fetchBaseQuery({ baseUrl: API_URL }),
  tagTypes: ["DailyProduct"],
  endpoints: (builder) => ({
    // Get all daily products
    getDailyProducts: builder.query<DailyProduct[], void>({
      query: () => `products/daily/all`,
      transformResponse: (response: any[]) =>
        response.map((dailyProduct) => ({
          ...dailyProduct,
          quantite: Number(dailyProduct.quantite),
          createdAt: new Date(dailyProduct.createdAt).toISOString(),
          updatedAt: new Date(dailyProduct.updatedAt).toISOString(),
          product: {
            ...dailyProduct.product,
            purchasePrice: Number(dailyProduct.product.purchasePrice ?? 0),
            sellingPrice: Number(dailyProduct.product.sellingPrice ?? 0),
          },
        })),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({
                type: "DailyProduct" as const,
                id,
              })),
              { type: "DailyProduct", id: "LIST" },
            ]
          : [{ type: "DailyProduct", id: "LIST" }],
    }),

    // Get a single daily product by ID
    getDailyProductById: builder.query<DailyProduct, string>({
      query: (id) => `products/daily/${id}`,
      transformResponse: (response: any) => ({
        ...response,
        quantite: Number(response.quantite),
        createdAt: new Date(response.createdAt).toISOString(),
        updatedAt: new Date(response.updatedAt).toISOString(),
        product: {
          ...response.product,
          purchasePrice: Number(response.product.purchasePrice),
          sellingPrice: Number(response.product.sellingPrice),
        },
      }),
      providesTags: (result, error, id) => [{ type: "DailyProduct", id }],
    }),

    // Create a new daily product
    createDailyProduct: builder.mutation<
      DailyProduct,
      { productId: string; quantite: number; date?: string }
    >({
      query: (data) => ({
        url: `products/daily`,
        method: "POST",
        body: {
          productId: data.productId,
          quantite: Number(data.quantite),
          date: data.date,
        },
      }),
      invalidatesTags: [{ type: "DailyProduct", id: "LIST" }],
    }),

    // Update an existing daily product
    updateDailyProduct: builder.mutation<
      DailyProduct,
      {
        id: string;
        data: Partial<{
          productId: string;
          quantite: number;
          date: string;
        }>;
      }
    >({
      query: ({ id, data }) => ({
        url: `products/daily/${id}`,
        method: "PATCH",
        body: {
          ...data,
          quantite: data.quantite ? Number(data.quantite) : undefined,
          date: data.date,
        },
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "DailyProduct", id },
        { type: "DailyProduct", id: "LIST" },
      ],
    }),

    // Delete a daily product
    deleteDailyProduct: builder.mutation<void, string>({
      query: (id) => ({
        url: `products/daily/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, id) => [
        { type: "DailyProduct", id },
        { type: "DailyProduct", id: "LIST" },
      ],
    }),
  }),
});

// Export hooks for usage in components
export const {
  useGetDailyProductByIdQuery,
  useCreateDailyProductMutation,
  useUpdateDailyProductMutation,
  useDeleteDailyProductMutation,
  useGetDailyProductsQuery,
} = dailyProductApi;
