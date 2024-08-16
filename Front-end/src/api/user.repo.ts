import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_URL } from "../config/axios";
import { User } from "src/types/shared";

export const userServices = createApi({
  reducerPath: "users",
  baseQuery: fetchBaseQuery({ baseUrl: API_URL }),
  tagTypes: ["users"],
  endpoints: (builder) => ({
    getUsers: builder.query<User[], void>({
      query: () => `users`,
      providesTags: ["users"],
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

export const { useCreateUserMutation } = userServices;
