import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_URL } from "../config/axios";
import { Member } from "src/types/shared";

export const membersServerApi = createApi({
  reducerPath: "membersTag",
  baseQuery: fetchBaseQuery({ baseUrl: API_URL }),
  tagTypes: ["membersTag"],
  endpoints: (builder) => ({
    getMembers: builder.query<Member[], void>({
      query: () => `members/all`,
      providesTags: ["membersTag"],
    }),
    getMembersByDate: builder.query<Member[], void>({
      query: () => `members`,
      providesTags: ["membersTag"],
    }),
    createMember: builder.mutation<Member, Member>({
      query: (data: Member) => ({
        url: `members`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["membersTag"],
    }),
    updateMember: builder.mutation<Member, Member>({
      query: (data) => ({
        url: `members/${data.id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["membersTag"],
    }),
    deleteMemeber: builder.mutation<Member, string>({
      query: (id) => ({
        url: `members/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["membersTag"],
    }),
  }),
});

export const {
  useGetMembersQuery,
  useCreateMemberMutation,
  useUpdateMemberMutation,
  useDeleteMemeberMutation,
} = membersServerApi;
