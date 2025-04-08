import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_URL } from "../config/axios";  // Assurez-vous que cette constante contient l'URL de votre backend
import { User } from "src/types/shared";

interface LoginParams {
  identifier: string; // Peut être email ou numéro de téléphone
  password: string;
}

interface SignUpParams {
  identifier: string; // Peut être email ou numéro de téléphone
  password: string;
  fullname: string;
}

// Créez l'API pour l'authentification
export const authServerApi = createApi({
  reducerPath: "authApi",
  baseQuery: fetchBaseQuery({ baseUrl: API_URL }),
  tagTypes: ["authApi"],
  endpoints: (builder) => ({
    // Endpoint de login modifié
    login: builder.mutation<User, LoginParams>({
      query: ({ identifier, password }) => ({
        url: "auth/login",
        method: "POST",
        body: { identifier, password }, // Utilisez identifier au lieu de email
      }),
      invalidatesTags: ["authApi"],
    }),

    // Endpoint d'inscription modifié
    signUp: builder.mutation<User, SignUpParams>({
      query: ({ identifier, password, fullname }) => ({
        url: "auth/signup",
        method: "POST",
        body: { identifier, password, fullname }, // Utilisez identifier au lieu de email
      }),
      invalidatesTags: ["authApi"],
    }),

    // Endpoint pour rafraîchir les tokens
    refreshTokens: builder.mutation<User, string>({
      query: (refreshToken) => ({
        url: "auth/refresh",
        method: "GET",
        headers: {
          Authorization: `Bearer ${refreshToken}`,
        },
      }),
      invalidatesTags: ["authApi"],
    }),

    // Endpoint pour la demande de réinitialisation de mot de passe
    forgotPassword: builder.mutation<void, { email: string }>({
      query: ({ email }) => ({
        url: "auth/forgot-password",
        method: "POST",
        body: { email },
      }),
    }),
getProtectedResource: builder.query<{ message: string; userId: string }, void>({
  query: () => ({
    url: "auth/protected",
    method: "GET",
    headers: {
      Authorization: `Bearer ${localStorage.getItem('accessToken')}`, // Récupérez le token depuis le localStorage
    },
  }),
}),
// Endpoint pour la déconnexion
logout: builder.mutation<void, void>({
  query: () => ({
    url: "auth/logout",
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionStorage.getItem('accessToken')}`, // Récupérez le token depuis le localStorage
    },
  }),
}),

    // Endpoint pour la réinitialisation du mot de passe
    resetPassword: builder.mutation<void, { token: string; newPassword: string }>({
      query: ({ token, newPassword }) => ({
        url: `auth/reset-password/${token}`, // Le token est maintenant dans le chemin
        method: "POST",
        body: { newPassword }, // Le nouveau mot de passe est dans le corps
      }),
    }),
  }),
});

// Exportez les hooks générés
export const {
  useLoginMutation,
  useSignUpMutation,
  useRefreshTokensMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useGetProtectedResourceQuery, // Nouveau hook pour la ressource protégée
  useLogoutMutation, // Nouveau hook pour la déconnexion
} = authServerApi;