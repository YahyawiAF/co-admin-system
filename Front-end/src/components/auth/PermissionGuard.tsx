import React, { ReactNode } from "react";
import { Alert, Box } from "@mui/material";
import { usePermissions } from "src/hooks/usePermissions";

interface PermissionGuardProps {
  resource: string;
  action: string;
  children: ReactNode;
  fallback?: ReactNode;
  hideOnDenied?: boolean;
}

/**
 * PermissionGuard - Protects content based on user permissions
 * 
 * @param resource - The resource to check (e.g., 'journals', 'members')
 * @param action - The action to check (e.g., 'read', 'create', 'update', 'delete')
 * @param children - Content to show if permission is granted
 * @param fallback - Content to show if permission is denied (default: alert message)
 * @param hideOnDenied - If true, hides content completely instead of showing fallback
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  resource,
  action,
  children,
  fallback,
  hideOnDenied = false,
}) => {
  const { hasPermission, isLoading } = usePermissions();

  if (isLoading) {
    return null; // or a loading spinner
  }

  const allowed = hasPermission(resource, action);

  if (allowed) {
    return <>{children}</>;
  }

  if (hideOnDenied) {
    return null;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <Box p={2}>
      <Alert severity="warning">
        You don't have permission to {action} {resource}.
      </Alert>
    </Box>
  );
};

export default PermissionGuard;

