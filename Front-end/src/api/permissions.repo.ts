import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_URL } from "../config/axios";

export interface Permission {
  id: string;
  name: string;
  description?: string;
  resource: string;
  action: string;
  createdAt: string;
  updatedAt: string;
}

export interface RolePermission {
  id: string;
  role: string;
  permissionId: string;
  permission: Permission;
  userId?: string;
  createdAt: string;
  updatedAt: string;
}

export const permissionsServices = createApi({
  reducerPath: "permissions",
  baseQuery: fetchBaseQuery({
    baseUrl: API_URL,
    prepareHeaders: (headers) => {
      const token = sessionStorage.getItem("accessToken");
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ["permissions", "rolePermissions"],
  endpoints: (builder) => ({
    getAllPermissions: builder.query<Permission[], void>({
      query: () => "permissions",
      providesTags: ["permissions"],
    }),
    getUserPermissions: builder.query<string[], string>({
      query: (userId) => `permissions/user/${userId}`,
      providesTags: ["permissions"],
    }),
    getRolePermissions: builder.query<RolePermission[], string>({
      query: (role) => `permissions/role/${role}`,
      providesTags: ["rolePermissions"],
    }),
    assignPermissionToUser: builder.mutation<
      RolePermission,
      { userId: string; permissionId: string }
    >({
      query: ({ userId, permissionId }) => ({
        url: `permissions/user/${userId}/assign`,
        method: "POST",
        body: { permissionId },
      }),
      invalidatesTags: ["permissions"],
    }),
    removePermissionFromUser: builder.mutation<
      void,
      { userId: string; permissionId: string }
    >({
      query: ({ userId, permissionId }) => ({
        url: `permissions/user/${userId}/remove`,
        method: "DELETE",
        body: { permissionId },
      }),
      invalidatesTags: ["permissions"],
    }),
    initializePermissions: builder.mutation<void, void>({
      query: () => ({
        url: "permissions/initialize",
        method: "POST",
      }),
      invalidatesTags: ["permissions", "rolePermissions"],
    }),
  }),
});

export const {
  useGetAllPermissionsQuery,
  useGetUserPermissionsQuery,
  useGetRolePermissionsQuery,
  useAssignPermissionToUserMutation,
  useRemovePermissionFromUserMutation,
  useInitializePermissionsMutation,
} = permissionsServices;
