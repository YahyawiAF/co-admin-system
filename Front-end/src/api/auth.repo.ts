import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_URL } from "../config/axios";  // Assurez-vous que cette constante contient l'URL de votre backend
import { User } from "src/types/shared";

// Définir les types des paramètres (par exemple pour le login et signup)
interface LoginParams {
  email: string;
  password: string;
}

interface SignUpParams {
  email: string;
  password: string;
  fullname: string;
}

// Créez l'API pour l'authentification
export const authServerApi = createApi({
  reducerPath: "authApi", // Un nom unique pour ce service d'authentification
  baseQuery: fetchBaseQuery({ baseUrl: API_URL }), // L'URL de base pour vos appels d'API
  tagTypes: ["authApi"],
  endpoints: (builder) => ({
    // Endpoint de login
    login: builder.mutation<User, LoginParams>({
      query: ({ email, password }) => ({
        url: "auth/login",
        method: "POST",
        body: { email, password },
      }),
      // Invalidates cache lorsque le login réussit
      invalidatesTags: ["authApi"],
    }),

    // Endpoint d'inscription
    signUp: builder.mutation<User, SignUpParams>({
      query: ({ email, password, fullname }) => ({
        url: "auth/signup",
        method: "POST",
        body: { email, password, fullname },
      }),
      invalidatesTags: ["authApi"],
    }),

    // Endpoint pour rafraîchir les tokens
    refreshTokens: builder.mutation<User, string>({
      query: (refreshToken) => ({
        url: "auth/refresh",
        method: "GET",
        headers: {
          Authorization: `Bearer ${refreshToken}`, // On envoie le token de rafraîchissement
        },
      }),
      // Invalidates cache ici si nécessaire
      invalidatesTags: ["authApi"],
    }),
  }),
});

export const {
  useLoginMutation,
  useSignUpMutation,
  useRefreshTokensMutation,
} = authServerApi;
