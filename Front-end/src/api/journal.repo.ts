import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_URL } from "../config/axios";
import { Journal } from "src/types/shared";

export const journalServerApi = createApi({
  reducerPath: "journalApi",
  baseQuery: fetchBaseQuery({ baseUrl: API_URL }),
  tagTypes: ["journalApi"],
  endpoints: (builder) => ({
    getJournal: builder.query<Journal[], void>({
      query: () => `journal`,
      providesTags: ["journalApi"],
    }),
    getJournalByDate: builder.query<Journal[], void>({
      query: () => `journal`,
      providesTags: ["journalApi"],
    }),
    createJournal: builder.mutation<Journal, Journal>({
      query: (data: Journal) => ({
        url: `journal`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["journalApi"],
    }),
    updateJournal: builder.mutation<Journal, Journal>({
      query: (data) => ({
        url: `journal/${data.id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["journalApi"],
    }),
    deleteJournal: builder.mutation<Journal, string>({
      query: (id) => ({
        url: `journal/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["journalApi"],
    }),
  }),
});

export const {
  useGetJournalQuery,
  useCreateJournalMutation,
  useUpdateJournalMutation,
  useDeleteJournalMutation,
} = journalServerApi;
