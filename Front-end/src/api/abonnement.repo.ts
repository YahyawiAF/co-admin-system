import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_URL } from "../config/axios";
import { Abonnement } from "src/types/shared";
import { PaginatedResponse } from "src/types/apiTypes";

interface AbonnementParams {
  perPage?: number;
  page?: number;
  search?: string;
}

export const abonnementApi = createApi({
  reducerPath: "abonnementApi",
  baseQuery: fetchBaseQuery({ 
    baseUrl: API_URL,
    // Ajoutez ici les headers si nécessaire (comme le token d'authentification)
    // prepareHeaders: (headers) => {
    //   const token = localStorage.getItem('token');
    //   if (token) {
    //     headers.set('Authorization', `Bearer ${token}`);
    //   }
    //   return headers;
    // }
  }),
  tagTypes: ["Abonnement"],
  endpoints: (builder) => ({
    getAbonnements: builder.query<PaginatedResponse<Abonnement>, AbonnementParams>({
      query: ({ perPage = 20, page, search }) => {
        const params = new URLSearchParams();
        if (page) params.append('page', page.toString());
        params.append('perPage', perPage.toString());
        if (search) params.append('search', search);
        
        return `abonnements?${params.toString()}`;
      },
      providesTags: ["Abonnement"],
    }),
    
    getAllAbonnements: builder.query<Abonnement[], void>({
      query: () => 'abonnements/all',
      providesTags: ["Abonnement"],
    }),
    
    getAbonnementById: builder.query<Abonnement, string>({
      query: (id) => `abonnements/${id}`,
      providesTags: (result, error, id) => [{ type: "Abonnement", id }],
    }),
    
    createAbonnement: builder.mutation<Abonnement, Abonnement>({
      query: (data) => ({
        url: 'abonnements',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ["Abonnement"],
    }),
    
    updateAbonnement: builder.mutation<Abonnement, {id: string, data: Abonnement}>({
      query: ({id, data}) => ({
        url: `abonnements/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (result, error, {id}) => [
        { type: "Abonnement", id },
        { type: "Abonnement" }
      ],
    }),
    
    deleteAbonnement: builder.mutation<void, string>({
      query: (id) => ({
        url: `abonnements/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ["Abonnement"],
    }),
  }),
});

// Export hooks for usage in functional components
export const {
  useGetAbonnementsQuery,
  useGetAllAbonnementsQuery,
  useGetAbonnementByIdQuery,
  useCreateAbonnementMutation,
  useUpdateAbonnementMutation,
  useDeleteAbonnementMutation,
} = abonnementApi;