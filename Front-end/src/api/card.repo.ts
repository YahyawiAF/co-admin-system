import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_URL } from "../config/axios";
import { Card } from "src/types/shared";

export const cardServerApi = createApi({
  reducerPath: "card",
  baseQuery: fetchBaseQuery({ baseUrl: API_URL }),
  tagTypes: ["card"],
  endpoints: (builder) => ({
    getCard: builder.query<Card[], void>({
      query: () => `cards`,
      providesTags: ["card"],
    }),
    createCard: builder.mutation<Card, Card>({
      query: (data: Card) => ({
        url: `cards`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["card"],
    }),
    updateCard: builder.mutation<Card, Card>({
      query: (data) => ({
        url: `cards/${data.id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["card"],
    }),
    deleteCard: builder.mutation<Card, string>({
      query: (id) => ({
        url: `cards/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["card"],
    }),
  }),
});

export const {
  useGetCardQuery,
  useCreateCardMutation,
  useDeleteCardMutation,
  useUpdateCardMutation,
} = cardServerApi;
