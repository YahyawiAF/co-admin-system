import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_URL } from "../config/axios";
import { ReclamationStatus, Reclamation } from "src/types/shared";

// Define PaginatedResult type if not already imported
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
}

// Define DTO types for create and update operations
interface CreateReclamationDto {
  title: string;
  description: string;
  status?: ReclamationStatus;
  memberId: string;
}

interface UpdateReclamationDto {
  title?: string;
  description?: string;
  status?: ReclamationStatus;
}

export const reclamationApi = createApi({
  reducerPath: "reclamationApi",
  baseQuery: fetchBaseQuery({ baseUrl: API_URL }),
  tagTypes: ["Reclamations"],
  endpoints: (builder) => ({
    // Get all reclamations
    getAllReclamations: builder.query<Reclamation[], void>({
      query: () => `reclamations/all`,
      providesTags: ["Reclamations"],
    }),

    // Get paginated reclamations
    getReclamations: builder.query<
      PaginatedResult<Reclamation>,
      { page?: number; perPage?: number }
    >({
      query: ({ page = 1, perPage = 20 }) =>
        `reclamations?page=${page}&perPage=${perPage}`,
      providesTags: ["Reclamations"],
    }),

    // Get a single reclamation by ID
    getReclamationById: builder.query<Reclamation, string>({
      query: (id) => `reclamations/${id}`,
      providesTags: ["Reclamations"],
    }),

    // Create a reclamation
    createReclamation: builder.mutation<Reclamation, CreateReclamationDto>({
      query: (data) => ({
        url: `reclamations`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Reclamations"],
    }),

    // Update a reclamation
    updateReclamation: builder.mutation<
      Reclamation,
      { id: string; data: UpdateReclamationDto }
    >({
      query: ({ id, data }) => ({
        url: `reclamations/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["Reclamations"],
    }),

    // Delete a reclamation
    deleteReclamation: builder.mutation<Reclamation, string>({
      query: (id) => ({
        url: `reclamations/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Reclamations"],
    }),
  }),
});

export const {
  useGetAllReclamationsQuery,
  useGetReclamationsQuery,
  useGetReclamationByIdQuery,
  useCreateReclamationMutation,
  useUpdateReclamationMutation,
  useDeleteReclamationMutation,
} = reclamationApi;