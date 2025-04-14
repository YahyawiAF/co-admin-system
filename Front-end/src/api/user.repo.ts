// src/api/user.repo.ts
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_URL } from "../config/axios";
import { User } from "src/types/shared";

export const userServices = createApi({
  reducerPath: "users",
  baseQuery: fetchBaseQuery({
    baseUrl: API_URL,
    prepareHeaders: (headers) => {
      const token = sessionStorage.getItem('accessToken');
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ["users"],
  endpoints: (builder) => ({
    getUsers: builder.query<User[], void>({
      query: () => `users`,
      providesTags: ["users"],
    }),
    updateUser: builder.mutation<User, { id: string; data: Partial<User> }>({
      query: ({ id, data }) => ({
        url: `users/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["users"],
    }),
    changePassword: builder.mutation<User, { oldPassword: string; newPassword: string }>({
      query: (data) => ({
        url: `users/change-password`, // Chemin de ta route backend
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["users"],
    }),
    
   
    createUser: builder.mutation<User, User>({
      query: (data: User) => ({
        url: `users`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["users"],
    }),
  }),
});

export const { useCreateUserMutation, useUpdateUserMutation,useChangePasswordMutation,} = userServices;