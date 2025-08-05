import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_URL } from "../config/axios"; // Assurez-vous que cette constante contient l'URL de votre backend
import { Role, User } from "src/types/shared";

interface LoginParams {
  identifier: string; // Email ou numéro de téléphone
  password: string;
}

interface SignUpParams {
  identifier: string; // Email ou numéro de téléphone
  password: string;
  fullname: string;
  role: Role;
}

interface ForgotPasswordParams {
  identifier: string; // Email ou numéro de téléphone
}

interface ResetPasswordParams {
  token: string;
  newPassword: string;
}

interface VerifyResetCodeParams {
  phoneNumber: string;
  code: string;
}

interface ResetPasswordWithPhoneParams {
  phoneNumber: string;
  newPassword: string;
}

// Créez l'API pour l'authentification
export const authServerApi = createApi({
 reducerPath: "authApi",
  baseQuery: fetchBaseQuery({ 
    baseUrl: API_URL,
    prepareHeaders: (headers) => {
      const token = localStorage.getItem("accessToken") || sessionStorage.getItem("accessToken");
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ["Auth"],
  endpoints: (builder) => ({
    login: builder.mutation<User, LoginParams>({
      query: (credentials) => ({
        url: "auth/login",
        method: "POST",
        body: credentials,
      }),
      invalidatesTags: ["Auth"],
    }),

    signUp: builder.mutation<User, SignUpParams>({
      query: (userData) => ({
        url: "auth/signup",
        method: "POST",
        body: userData,
      }),
      invalidatesTags: ["Auth"],
    }),

    refreshTokens: builder.mutation<User, void>({
      query: () => ({
        url: "auth/refresh",
        method: "GET",
        credentials: "include",
      }),
    }),

    forgotPassword: builder.mutation<void, ForgotPasswordParams>({
      query: ({ identifier }) => ({
        url: "auth/forgot-password",
        method: "POST",
        body: { identifier },
      }),
    }),

    verifyResetCode: builder.mutation<{ token: string }, VerifyResetCodeParams>({
      query: ({ phoneNumber, code }) => ({
        url: "auth/verify-reset-code",
        method: "POST",
        body: { phoneNumber, code },
      }),
    }),

    resetPassword: builder.mutation<void, ResetPasswordParams>({
      query: ({ token, newPassword }) => ({
        url: `auth/reset-password/${token}`,
        method: "POST",
        body: { newPassword },
      }),
    }),

    resetPasswordWithPhone: builder.mutation<void, ResetPasswordWithPhoneParams>({
      query: ({ phoneNumber, newPassword }) => ({
        url: "auth/reset-password-phone",
        method: "POST",
        body: { phoneNumber, newPassword },
      }),
    }),

    logout: builder.mutation<void, void>({
      query: () => ({
        url: "auth/logout",
        method: "POST",
      }),
      invalidatesTags: ["Auth"],
    }),

    getProtectedResource: builder.query<{ message: string; userId: string }, void>({
      query: () => "auth/protected",
      providesTags: ["Auth"],
    }),
  }),
});

// Export des hooks générés
export const {
  useLoginMutation,
  useSignUpMutation,
  useRefreshTokensMutation,
  useForgotPasswordMutation,
  useVerifyResetCodeMutation,
  useResetPasswordMutation,
  useResetPasswordWithPhoneMutation,
  useLogoutMutation,
  useGetProtectedResourceQuery,
} = authServerApi;
