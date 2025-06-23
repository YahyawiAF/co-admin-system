import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_URL } from "../config/axios";
import { Product, Member } from "src/types/shared";

export interface DailyProduct {
  id: string;
  productId: string;
  quantite: number;
  createdAt: string;
  date?: string;
  updatedAt: string;
  product: Product;
  memberId?: string; 
  member?: Member | null; 
}

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
          quantite: Number(dailyProduct.quantite ?? 0),
          createdAt: new Date(dailyProduct.createdAt).toISOString(),
          updatedAt: new Date(dailyProduct.updatedAt).toISOString(),
          date: dailyProduct.date ? new Date(dailyProduct.date).toISOString() : undefined,
          memberId: dailyProduct.memberId ?? undefined, // Safely handle memberId
          member: dailyProduct.member
            ? {
                ...dailyProduct.member,
                credits: Number(dailyProduct.member.credits ?? 0),
                createdAt: new Date(dailyProduct.member.createdAt).toISOString(),
                updatedAt: new Date(dailyProduct.member.updatedAt).toISOString(),
                deletedAt: dailyProduct.member.deletedAt
                  ? new Date(dailyProduct.member.deletedAt).toISOString()
                  : null,
              }
            : null, // Handle null member
          product: {
            ...dailyProduct.product,
            purchasePrice: Number(dailyProduct.product.purchasePrice ?? 0),
            sellingPrice: Number(dailyProduct.product.sellingPrice ?? 0),
            createdAt: new Date(dailyProduct.product.createdAt).toISOString(),
            updatedAt: new Date(dailyProduct.product.updatedAt).toISOString(),
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
        quantite: Number(response.quantite ?? 0),
        createdAt: new Date(response.createdAt).toISOString(),
        updatedAt: new Date(response.updatedAt).toISOString(),
        date: response.date ? new Date(response.date).toISOString() : undefined,
        memberId: response.memberId ?? undefined, // Safely handle memberId
        member: response.member
          ? {
              ...response.member,
              credits: Number(response.member.credits ?? 0),
              createdAt: new Date(response.member.createdAt).toISOString(),
              updatedAt: new Date(response.member.updatedAt).toISOString(),
              deletedAt: response.member.deletedAt
                ? new Date(response.member.deletedAt).toISOString()
                : null,
            }
          : null, // Handle null member
        product: {
          ...response.product,
          purchasePrice: Number(response.product.purchasePrice ?? 0),
          sellingPrice: Number(response.product.sellingPrice ?? 0),
          createdAt: new Date(response.product.createdAt).toISOString(),
          updatedAt: new Date(response.product.updatedAt).toISOString(),
        },
      }),
      providesTags: (result, error, id) => [{ type: "DailyProduct", id }],
    }),

    // Create a new daily product
    createDailyProduct: builder.mutation<
      DailyProduct,
      { productId: string; quantite: number; date?: string; memberId?: string }
    >({
      query: (data) => ({
        url: `products/daily`,
        method: "POST",
        body: {
          productId: data.productId,
          quantite: Number(data.quantite),
          date: data.date,
          memberId: data.memberId, // Include memberId
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
          memberId: string | null; // Allow null to unset memberId
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
          memberId: data.memberId !== undefined ? data.memberId : undefined, // Handle null/undefined
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