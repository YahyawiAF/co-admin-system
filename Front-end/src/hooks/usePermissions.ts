import { useEffect, useState } from "react";
import { useGetUserPermissionsQuery } from "src/api/permissions.repo";

interface UsePermissionsReturn {
  permissions: string[];
  hasPermission: (resource: string, action: string) => boolean;
  canRead: (resource: string) => boolean;
  canCreate: (resource: string) => boolean;
  canUpdate: (resource: string) => boolean;
  canDelete: (resource: string) => boolean;
  isLoading: boolean;
  refetch: () => void;
}

export const usePermissions = (userId?: string): UsePermissionsReturn => {
  const [permissions, setPermissions] = useState<string[]>([]);

  // Get userId from session if not provided
  const currentUserId =
    userId ||
    (() => {
      try {
        const userStr = sessionStorage.getItem("user");
        if (userStr) {
          const user = JSON.parse(userStr);
          return user.id;
        }
      } catch (e) {
        console.error("Error getting user from session:", e);
      }
      return "";
    })();

  const {
    data: userPermissions,
    isLoading,
    refetch,
  } = useGetUserPermissionsQuery(currentUserId, {
    skip: !currentUserId,
  });

  useEffect(() => {
    if (userPermissions) {
      setPermissions(userPermissions);
    }
  }, [userPermissions]);

  const hasPermission = (resource: string, action: string): boolean => {
    const permissionName = `${resource}:${action}`;
    return permissions.includes(permissionName);
  };

  const canRead = (resource: string): boolean =>
    hasPermission(resource, "read");
  const canCreate = (resource: string): boolean =>
    hasPermission(resource, "create");
  const canUpdate = (resource: string): boolean =>
    hasPermission(resource, "update");
  const canDelete = (resource: string): boolean =>
    hasPermission(resource, "delete");

  return {
    permissions,
    hasPermission,
    canRead,
    canCreate,
    canUpdate,
    canDelete,
    isLoading,
    refetch,
  };
};

export default usePermissions;
