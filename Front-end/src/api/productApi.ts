import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_URL } from "../config/axios";
import { Product } from "src/types/shared";

export const productApi = createApi({
  reducerPath: "productApi",
  baseQuery: fetchBaseQuery({ baseUrl: API_URL }),
  tagTypes: ["Product"],
  endpoints: (builder) => ({
    getProducts: builder.query<Product[], void>({
      query: () => `products`,
      transformResponse: (response: any[]) =>
        response.map((product) => ({
          ...product,
          purchasePrice: Number(product.purchasePrice ?? 0),
          sellingPrice: Number(product.sellingPrice ?? 0),
        })),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Product" as const, id })),
              { type: "Product", id: "LIST" },
            ]
          : [{ type: "Product", id: "LIST" }],
    }),

    getProductById: builder.query<Product, string>({
      query: (id) => `products/${id}`,
      transformResponse: (response: any) => ({
        ...response,
        purchasePrice: Number(response.purchasePrice),
        sellingPrice: Number(response.sellingPrice),
        createdAt: new Date(response.createdAt).toISOString(),
        updatedAt: new Date(response.updatedAt).toISOString(),
      }),
      providesTags: (result, error, id) => [{ type: "Product", id }],
    }),

    createProduct: builder.mutation<
      Product,
      Omit<Product, "id" | "createdAt" | "updatedAt">
    >({
      query: (data) => ({
        url: `products`,
        method: "POST",
        body: {
          ...data,
          purchasePrice: Number(data.purchasePrice),
          sellingPrice: Number(data.sellingPrice),
        },
      }),
      invalidatesTags: [{ type: "Product", id: "LIST" }],
    }),

    updateProduct: builder.mutation<
      Product,
      {
        id: string;
        data: Partial<Omit<Product, "id" | "createdAt" | "updatedAt">>;
      }
    >({
      query: ({ id, data }) => {
        if (
          (data.purchasePrice !== undefined && isNaN(data.purchasePrice)) ||
          (data.sellingPrice !== undefined && isNaN(data.sellingPrice))
        ) {
          throw new Error("Prix invalide");
        }

        return {
          url: `products/${id}`,
          method: "PATCH",
          body: {
            ...data,
            purchasePrice: data.purchasePrice ? Number(data.purchasePrice.toFixed(2)) : undefined,
            sellingPrice: data.sellingPrice ? Number(data.sellingPrice.toFixed(2)) : undefined,
          },
        };
      },
      invalidatesTags: (result, error, { id }) => [{ type: "Product", id }],
    }),

    deleteProduct: builder.mutation<void, string>({
      query: (id) => ({
        url: `products/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, id) => [
        { type: "Product", id },
        { type: "Product", id: "LIST" },
      ],
    }),
  }),
});

// Export des hooks
export const {
  useGetProductsQuery,
  useGetProductByIdQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
} = productApi;