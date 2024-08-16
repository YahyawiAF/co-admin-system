import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_URL } from "../config/axios";

export const companiersServerApi = createApi({
  reducerPath: "companies",
  baseQuery: fetchBaseQuery({ baseUrl: API_URL }),
  tagTypes: ["companies"],
  endpoints: (builder) => ({
    getCompanies: builder.query({
      query: () => `companies`,
      providesTags: ["companies"],
    }),
    createCompanies: builder.mutation({
      query: (data) => ({
        url: `companies`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["companies"],
    }),
  }),
});

export const { useGetCompaniesQuery, useCreateCompaniesMutation } =
  companiersServerApi;
