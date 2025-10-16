import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Paper,
  Switch,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  Divider,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import {
  useGetUserPermissionsQuery,
  useGetAllPermissionsQuery,
  useAssignPermissionToUserMutation,
  useRemovePermissionFromUserMutation,
  Permission,
} from "src/api/permissions.repo";
import { User } from "src/types/shared";

const PermissionSection = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  marginBottom: theme.spacing(2),
}));

const PermissionRow = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: theme.spacing(1.5, 0),
  borderBottom: `1px solid ${theme.palette.divider}`,
  "&:last-child": {
    borderBottom: "none",
  },
}));

interface UserPermissionsDialogProps {
  open: boolean;
  user: User | null;
  onClose: () => void;
}

// Define resource groups with their display names and actions
const RESOURCE_GROUPS = {
  journal: {
    label: "Journal",
    description: "Access to journal/daily entries page",
    resource: "journals",
    actions: ["read", "create", "update", "delete"],
  },
  subscription: {
    label: "Subscription (Abonnement)",
    description: "Access to subscription management",
    resource: "abonnements",
    actions: ["read", "create", "update", "delete"],
  },
  membership: {
    label: "Membership",
    description: "Access to members management",
    resource: "members",
    actions: ["read", "create", "update", "delete"],
  },
  reservation: {
    label: "Reservation",
    description: "Access to reservations overview",
    resource: "facilities",
    actions: ["read", "update"],
  },
  products: {
    label: "Products",
    description: "Access to products management",
    resource: "products",
    actions: ["read", "create", "update", "delete"],
  },
  expenses: {
    label: "Expenses",
    description: "Access to expenses management",
    resource: "expenses",
    actions: ["read", "create", "update", "delete"],
  },
  reclamations: {
    label: "Reclamations",
    description: "Access to reclamations/complaints",
    resource: "reclamations",
    actions: ["read", "create", "update", "delete"],
  },
  statistics: {
    label: "Statistics & Overview",
    description: "Access to statistics dashboard",
    resource: "statistics",
    actions: ["read"],
  },
  users: {
    label: "Users Management",
    description: "Access to user management",
    resource: "users",
    actions: ["read", "create", "update", "delete"],
  },
  settings: {
    label: "Settings",
    description: "Access to system settings",
    resource: "settings",
    actions: ["read", "update"],
  },
};

const ACTION_LABELS: Record<string, string> = {
  read: "View/Read",
  create: "Create/Add",
  update: "Edit/Update",
  delete: "Delete/Remove",
};

const UserPermissionsDialog: React.FC<UserPermissionsDialogProps> = ({
  open,
  user,
  onClose,
}) => {
  const [localPermissions, setLocalPermissions] = useState<Set<string>>(
    new Set()
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: userPermissions, isLoading: loadingUserPerms } =
    useGetUserPermissionsQuery(user?.id || "", {
      skip: !user?.id,
    });

  const { data: allPermissions, isLoading: loadingAllPerms } =
    useGetAllPermissionsQuery();

  const [assignPermission, { isLoading: assigning }] =
    useAssignPermissionToUserMutation();
  const [removePermission, { isLoading: removing }] =
    useRemovePermissionFromUserMutation();

  useEffect(() => {
    if (userPermissions) {
      setLocalPermissions(new Set(userPermissions));
    }
  }, [userPermissions]);

  const getPermissionId = (resource: string, action: string): string | null => {
    if (!allPermissions) return null;
    const permission = allPermissions.find(
      (p: Permission) => p.resource === resource && p.action === action
    );
    return permission?.id || null;
  };

  const hasPermission = (resource: string, action: string): boolean => {
    const permissionName = `${resource}:${action}`;
    return localPermissions.has(permissionName);
  };

  const handleTogglePermission = async (resource: string, action: string) => {
    if (!user) return;

    const permissionName = `${resource}:${action}`;
    const permissionId = getPermissionId(resource, action);

    if (!permissionId) {
      setError("Permission not found in system");
      return;
    }

    setError(null);
    setSuccess(null);

    const currentlyHasPermission = localPermissions.has(permissionName);

    // Optimistically update UI
    if (currentlyHasPermission) {
      setLocalPermissions((prev) => {
        const newSet = new Set(prev);
        newSet.delete(permissionName);
        return newSet;
      });
    } else {
      setLocalPermissions((prev) => new Set(prev).add(permissionName));
    }

    try {
      if (currentlyHasPermission) {
        // Remove permission
        await removePermission({
          userId: user.id,
          permissionId,
        }).unwrap();
        setSuccess(`Permission removed: ${ACTION_LABELS[action]} ${resource}`);
      } else {
        // Assign permission
        await assignPermission({
          userId: user.id,
          permissionId,
        }).unwrap();
        setSuccess(`Permission granted: ${ACTION_LABELS[action]} ${resource}`);
      }
    } catch (err: any) {
      // Revert on error
      if (currentlyHasPermission) {
        setLocalPermissions((prev) => new Set(prev).add(permissionName));
      } else {
        setLocalPermissions((prev) => {
          const newSet = new Set(prev);
          newSet.delete(permissionName);
          return newSet;
        });
      }
      setError(
        err?.data?.message ||
          err?.message ||
          "Failed to update permission. You may need SUPER_ADMIN role."
      );
      console.error("Permission update error:", err);
    }
  };

  const handleClose = () => {
    setError(null);
    setSuccess(null);
    onClose();
  };

  if (!user) return null;

  const isLoading = loadingUserPerms || loadingAllPerms;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: "70vh", maxHeight: "90vh" },
      }}
    >
      <DialogTitle>
        <Box>
          <Typography variant="h5" component="div">
            Manage Permissions
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            User: <strong>{user.fullname || user.email}</strong>
          </Typography>
          <Chip
            label={`Role: ${user.role.replace("_", " ")}`}
            size="small"
            color="primary"
            sx={{ mt: 1 }}
          />
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert
            severity="success"
            sx={{ mb: 2 }}
            onClose={() => setSuccess(null)}
          >
            {success}
          </Alert>
        )}

        {isLoading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : (
          <Box>
            <Alert severity="info" sx={{ mb: 3 }}>
              Toggle permissions below to control what{" "}
              {user.fullname || "this user"} can access and do. These are in
              addition to their role-based permissions.
            </Alert>

            {Object.entries(RESOURCE_GROUPS).map(([key, group]) => (
              <PermissionSection key={key} elevation={1}>
                <Box mb={2}>
                  <Typography variant="h6" color="primary">
                    {group.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {group.description}
                  </Typography>
                </Box>

                <Divider sx={{ mb: 2 }} />

                <Grid container spacing={1}>
                  {group.actions.map((action) => {
                    const permitted = hasPermission(group.resource, action);
                    const isUpdating = assigning || removing;

                    return (
                      <Grid item xs={12} sm={6} key={action}>
                        <PermissionRow>
                          <Box>
                            <Typography variant="body2" fontWeight={500}>
                              {ACTION_LABELS[action] || action}
                            </Typography>
                          </Box>
                          <Switch
                            checked={permitted}
                            onChange={() =>
                              handleTogglePermission(group.resource, action)
                            }
                            disabled={isUpdating}
                            color="primary"
                          />
                        </PermissionRow>
                      </Grid>
                    );
                  })}
                </Grid>
              </PermissionSection>
            ))}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UserPermissionsDialog;
