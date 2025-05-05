import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_URL } from "../config/axios";
import { DailyProduct, Product } from "src/types/shared";

export const productApi = createApi({
  reducerPath: "productApi",
  baseQuery: fetchBaseQuery({ baseUrl: API_URL }),
  tagTypes: ["Product", "DailyProduct"],
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
            purchasePrice: data.purchasePrice
              ? Number(data.purchasePrice.toFixed(2))
              : undefined,
            sellingPrice: data.sellingPrice
              ? Number(data.sellingPrice.toFixed(2))
              : undefined,
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
              ...result.map(({ id }) => ({ type: "DailyProduct" as const, id })),
              { type: "DailyProduct", id: "LIST" },
            ]
          : [{ type: "DailyProduct", id: "LIST" }],
    }),
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
        updateDailyProduct: builder.mutation<
        DailyProduct,
        {
          id: string;
          data: Partial<{
            productId: string;
            quantite: number;
            date: string; // Ajoutez cette ligne
          }>;
        }
      >({
        query: ({ id, data }) => ({
          url: `products/daily/${id}`,
          method: "PATCH",
          body: {
            ...data,
            quantite: data.quantite ? Number(data.quantite) : undefined,
            date: data.date ? data.date : undefined, // Ajoutez cette ligne
          },
        }),
        invalidatesTags: (result, error, { id }) => [
          { type: "DailyProduct", id },
          { type: "DailyProduct", id: "LIST" },
        ],
      }),
  
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
}),
});


// Export des hooks
export const {
  useGetProductsQuery,
  useGetProductByIdQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
  useCreateDailyProductMutation,
  useGetDailyProductByIdQuery,
  useGetDailyProductsQuery,
  useUpdateDailyProductMutation,
  useDeleteDailyProductMutation,


} = productApi;
