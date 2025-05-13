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
    getFacilityById: builder.query<Facility, string>({
      query: (id) => `facilities/${id}`,
      providesTags: ["Facility"],
    }),
    createFacility: builder.mutation<
      Facility,
      Omit<Facility, "id" | "createdAt" | "updatedAt">
    >({
      query: (data) => ({
        url: `facilities`,
        method: "POST",
        body: {
          name: data.name,
          numtel: data.numtel,
          email: data.email,
          adresse: data.adresse,
          logo: data.logo,
          nbrPlaces: data.nbrPlaces,
          socialNetworks: data.socialNetworks,
          places: data.places,
        },
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
  useGetFacilityByIdQuery,
  useCreateFacilityMutation,
  useUpdateFacilityMutation,
  useDeleteFacilityMutation,
} = facilityApi;

export type { Facility };
