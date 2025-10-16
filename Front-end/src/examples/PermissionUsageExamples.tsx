/**
 * PERMISSION SYSTEM USAGE EXAMPLES
 *
 * This file demonstrates how to use the permission system throughout your application.
 * Copy and adapt these examples to your specific pages and components.
 */

import React from "react";
import { Box, Button, IconButton } from "@mui/material";
import { Edit, Delete, Add, Visibility } from "@mui/icons-material";
import { PermissionGuard } from "src/components/auth/PermissionGuard";
import {
  PermissionButton,
  PermissionIconButton,
} from "src/components/auth/PermissionButton";
import { usePermissions } from "src/hooks/usePermissions";

// ============================================================================
// EXAMPLE 1: Using PermissionGuard to hide/show entire sections
// ============================================================================

export const JournalPageExample = () => {
  const { canCreate, canUpdate, canDelete, canRead } = usePermissions();

  return (
    <Box>
      {/* Only show if user can read journals */}
      <PermissionGuard resource="journals" action="read">
        <Box>
          <h2>Journal Entries</h2>
          {/* Journal list here */}
        </Box>
      </PermissionGuard>

      {/* Only show create button if user can create journals */}
      <PermissionGuard resource="journals" action="create" hideOnDenied>
        <Button variant="contained" startIcon={<Add />}>
          Create New Entry
        </Button>
      </PermissionGuard>

      {/* Show custom message if no permission */}
      <PermissionGuard
        resource="journals"
        action="delete"
        fallback={<Box>Contact admin to get delete permissions</Box>}
      >
        <Button color="error">Delete Selected</Button>
      </PermissionGuard>
    </Box>
  );
};

// ============================================================================
// EXAMPLE 2: Using PermissionButton for automatic disable/enable
// ============================================================================

export const MembershipActionsExample = () => {
  return (
    <Box display="flex" gap={2}>
      {/* Button is automatically disabled if user lacks permission */}
      <PermissionButton
        resource="members"
        action="create"
        variant="contained"
        tooltip="You need permission to create members"
      >
        Add Member
      </PermissionButton>

      <PermissionButton resource="members" action="update" variant="outlined">
        Edit Member
      </PermissionButton>

      <PermissionButton resource="members" action="delete" color="error">
        Delete Member
      </PermissionButton>
    </Box>
  );
};

// ============================================================================
// EXAMPLE 3: Using PermissionIconButton in table actions
// ============================================================================

export const TableActionsExample = ({ item }: any) => {
  return (
    <Box>
      <PermissionIconButton
        resource="journals"
        action="read"
        tooltip="View Details"
        size="small"
      >
        <Visibility />
      </PermissionIconButton>

      <PermissionIconButton
        resource="journals"
        action="update"
        tooltip="Edit Entry"
        size="small"
      >
        <Edit />
      </PermissionIconButton>

      <PermissionIconButton
        resource="journals"
        action="delete"
        tooltip="Delete Entry"
        size="small"
        color="error"
      >
        <Delete />
      </PermissionIconButton>
    </Box>
  );
};

// ============================================================================
// EXAMPLE 4: Using usePermissions hook for custom logic
// ============================================================================

export const CustomPermissionLogicExample = () => {
  const { hasPermission, canRead, canCreate, canUpdate, canDelete } =
    usePermissions();

  // Check specific permission
  if (!canRead("journals")) {
    return <Box>You don't have access to journals</Box>;
  }

  // Conditional rendering based on multiple permissions
  const canManageJournals = canCreate("journals") && canUpdate("journals");

  // Custom permission check
  const canViewStatistics = hasPermission("statistics", "read");

  return (
    <Box>
      <h2>Journal Management</h2>

      {canManageJournals && <Box>Full management access available</Box>}

      {canDelete("journals") ? (
        <Button color="error">Delete All</Button>
      ) : (
        <Box>Contact admin for delete access</Box>
      )}

      {canViewStatistics && <Box>You can see statistics dashboard</Box>}
    </Box>
  );
};

// ============================================================================
// EXAMPLE 5: Protecting form fields based on permissions
// ============================================================================

export const FormWithPermissionsExample = () => {
  const { canUpdate } = usePermissions();

  return (
    <form>
      {/* All fields read-only if user can't update */}
      <input
        type="text"
        disabled={!canUpdate("members")}
        placeholder="Member Name"
      />

      <PermissionGuard resource="members" action="update" hideOnDenied>
        <Button type="submit">Save Changes</Button>
      </PermissionGuard>

      {/* Always show cancel, but only save if has permission */}
      <Button type="button">Cancel</Button>
    </form>
  );
};

// ============================================================================
// EXAMPLE 6: Page-level permission check
// ============================================================================

export const ProtectedPageExample = () => {
  const { canRead, isLoading } = usePermissions();

  if (isLoading) {
    return <Box>Loading permissions...</Box>;
  }

  // Redirect or show error if no read access to the main resource
  if (!canRead("abonnements")) {
    return (
      <Box p={4}>
        <h2>Access Denied</h2>
        <p>You don't have permission to view subscriptions.</p>
      </Box>
    );
  }

  return (
    <Box>
      {/* Page content */}
      <h1>Subscriptions Management</h1>

      <PermissionGuard resource="abonnements" action="create" hideOnDenied>
        <Button>Create Subscription</Button>
      </PermissionGuard>

      {/* Rest of the page */}
    </Box>
  );
};

// ============================================================================
// EXAMPLE 7: Combining with Role-based protection
// ============================================================================

export const CombinedProtectionExample = () => {
  const { hasPermission } = usePermissions();

  // Get user role from session
  const userRole = (() => {
    try {
      const userStr = sessionStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        return user.role;
      }
    } catch (e) {
      return null;
    }
  })();

  const isAdmin = userRole === "SUPER_ADMIN" || userRole === "ADMIN";
  const canManageUsers = hasPermission("users", "update");

  return (
    <Box>
      {/* Only admins with specific permission can manage users */}
      {isAdmin && canManageUsers && <Box>User Management Section</Box>}

      {/* Permission-based feature, regardless of role */}
      <PermissionGuard resource="statistics" action="read">
        <Box>Statistics Dashboard</Box>
      </PermissionGuard>
    </Box>
  );
};

// ============================================================================
// RESOURCE NAMES REFERENCE
// ============================================================================

/*
Available resources:
- journals
- abonnements (subscriptions)
- members
- facilities (reservations)
- products
- expenses
- reclamations
- statistics
- users
- settings

Available actions:
- read
- create
- update
- delete

Example permission checks:
- hasPermission("journals", "read")      // Can view journals
- hasPermission("journals", "create")    // Can create journal entries
- hasPermission("members", "update")     // Can edit members
- hasPermission("products", "delete")    // Can delete products
- hasPermission("statistics", "read")    // Can view statistics
*/
