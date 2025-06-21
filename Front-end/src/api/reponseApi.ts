import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_URL } from '../config/axios'; // Use the same API_URL as reclamationApi
import { PaginatedResult } from './reclamationApi';
import { ResponseEntity } from 'src/types/shared';

export interface CreateResponseDto {
  content: string;
  reclamationId: string;
}

export const responseApi = createApi({
  reducerPath: 'responseApi',
  baseQuery: fetchBaseQuery({
    baseUrl: API_URL, // Use the same base URL as reclamationApi
    prepareHeaders: (headers) => {
      const token = sessionStorage.getItem('accessToken');
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Response'],
  endpoints: (builder) => ({
    getResponses: builder.query<ResponseEntity[], void>({
      query: () => 'responses', // Align with backend's GET /responses
      providesTags: ['Response'],
    }),
    getPaginatedResponses: builder.query<
      PaginatedResult<ResponseEntity>,
      { page?: number; perPage?: number; reclamationId?: string }
    >({
      query: ({ page = 1, perPage = 20, reclamationId }) =>
        `responses?page=${page}&perPage=${perPage}${
          reclamationId ? `&reclamationId=${reclamationId}` : ''
        }`,
      providesTags: ['Response'],
    }),
    getResponseById: builder.query<ResponseEntity, string>({
      query: (id) => `responses/${id}`,
      providesTags: ['Response'],
    }),
    getResponsesByClaimsId: builder.query<ResponseEntity[], string>({
      query: (reclamationId) => `responses/reclamation/${reclamationId}`,
      providesTags: ['Response'],
    }),
    createResponse: builder.mutation<ResponseEntity, CreateResponseDto>({
      query: (data) => ({
        url: 'responses',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Response'],
    }),
  }),
});

export const {
  useGetResponsesQuery,
  useGetPaginatedResponsesQuery,
  useGetResponseByIdQuery,
  useGetResponsesByClaimsIdQuery,
  useCreateResponseMutation,
} = responseApi;