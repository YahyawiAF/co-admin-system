// src/services/facilityApi.ts
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_URL } from "../config/axios";
import { Facility } from "src/types/shared";

export const facilityApi = createApi({
  reducerPath: "facilityApi",
  baseQuery: fetchBaseQuery({ baseUrl: API_URL }),
  tagTypes: ["Facility"],
  endpoints: (builder) => ({
    getFacilities: builder.query<Facility[], void>({
      query: () => `facilities`,
      providesTags: ["Facility"],
    }),
    getFirstFacility: builder.query<Facility, void>({
      query: () => `facilities`,
      transformResponse: (response: Facility[]) => {
        if (response.length === 0) {
          throw new Error("No facilities found");
        }
        return response[0];
      },
      providesTags: ["Facility"],
    }),
    createFacility: builder.mutation<Facility, void>({
      query: () => ({
        url: `facilities`,
        method: "POST",
      }),
      invalidatesTags: ["Facility"],
    }),
    updateFacility: builder.mutation<
      Facility,
      {
        id: string;
        data: Partial<Omit<Facility, "id" | "createdAt" | "updatedAt">>;
      }
    >({
      query: ({ id, data }) => ({
        url: `facilities/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: ["Facility"],
    }),
    deleteFacility: builder.mutation<void, string>({
      query: (id) => ({
        url: `facilities/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Facility"],
    }),
  }),
});

export const {
  useGetFacilitiesQuery,
  useGetFirstFacilityQuery,
  useCreateFacilityMutation,
  useUpdateFacilityMutation,
  useDeleteFacilityMutation,
} = facilityApi;
