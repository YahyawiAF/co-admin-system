import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_URL } from "../config/axios";
import { User } from "src/types/shared";

export const membersServerApi = createApi({
  reducerPath: "membersApi",
  baseQuery: fetchBaseQuery({ baseUrl: API_URL }),
  tagTypes: ["membersApi"],
  endpoints: (builder) => ({
    getMembers: builder.query<User[], void>({
      query: () => `members`,
      providesTags: ["membersApi"],
    }),
    getMembersByDate: builder.query<User[], void>({
      query: () => `members`,
      providesTags: ["membersApi"],
    }),
    createMember: builder.mutation<User, User>({
      query: (data: User) => ({
        url: `members`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["membersApi"],
    }),
    updateMember: builder.mutation<User, User>({
      query: (data) => ({
        url: `members/${data.id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["membersApi"],
    }),
    deleteMemeber: builder.mutation<User, string>({
      query: (id) => ({
        url: `members/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["membersApi"],
    }),
  }),
});

export const {
  useGetMembersQuery,
  useCreateMemberMutation,
  useUpdateMemberMutation,
  useDeleteMemeberMutation,
} = membersServerApi;
