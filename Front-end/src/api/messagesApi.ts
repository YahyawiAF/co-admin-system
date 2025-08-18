import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_URL } from "../config/axios";
import { Message } from "src/types/shared";

export const messagesApi = createApi({
  reducerPath: "messagesApi",
  baseQuery: fetchBaseQuery({ 
    baseUrl: API_URL,
    prepareHeaders: (headers) => {
      const token = sessionStorage.getItem('accessToken');
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      headers.set('Content-Type', 'application/json');
      return headers;
    }
  }),
  tagTypes: ["Message"],
  endpoints: (builder) => ({
    getMessages: builder.query<Message[], void>({
      query: () => `messages`,
      providesTags: ["Message"],
      transformResponse: (response: Message[]) => {
        return response.sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      }
    }),
    sendMessage: builder.mutation<Message, {content?: string; senderId: string; imageBase64?: string}>({
  query: (body) => ({
    url: `messages`,
    method: "POST",
    body: JSON.stringify(body), // Ajoutez JSON.stringify()
    headers: {
      'Content-Type': 'application/json' // Assurez-vous que ce header est présent
    }
  }),
  invalidatesTags: ["Message"],
}),
  }),
});

export const { 
  useGetMessagesQuery, 
  useSendMessageMutation,
  useLazyGetMessagesQuery 
} = messagesApi;