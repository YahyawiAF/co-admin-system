# Permission System Implementation Guide

## 🎯 Overview

This guide explains how to implement and use the permission system in your application. The system is now fully functional with:

✅ **Backend API** - Permission CRUD operations  
✅ **Frontend UI** - Toggle-based permission management  
✅ **Permission Hooks** - Easy-to-use React hooks  
✅ **Guard Components** - Protect UI elements automatically  
✅ **Button Components** - Auto-disable buttons based on permissions  

---

## 🚀 Quick Start

### 1. Initialize Permissions (One-time setup)

First, you need to initialize the default permissions in your database. Run this once:

```typescript
// From your frontend admin panel or directly via API call
// POST http://your-backend-url/permissions/initialize
```

Or create a button in your admin panel:

```tsx
import { useInitializePermissionsMutation } from "src/api/permissions.repo";

const AdminSetup = () => {
  const [initialize, { isLoading }] = useInitializePermissionsMutation();

  return (
    <Button onClick={() => initialize()} disabled={isLoading}>
      Initialize Permissions
    </Button>
  );
};
```

### 2. Manage User Permissions

Go to `/dashboard/users` and click the **Security icon** (blue shield) next to any user to manage their permissions.

---

## 📚 How to Use in Your Code

### Method 1: Using PermissionGuard Component

Protect entire sections of your page:

```tsx
import { PermissionGuard } from "src/components/auth/PermissionGuard";

// Hide section if user can't read journals
<PermissionGuard resource="journals" action="read">
  <JournalTable />
</PermissionGuard>

// Hide button completely if user can't create
<PermissionGuard resource="journals" action="create" hideOnDenied>
  <Button>Create Journal</Button>
</PermissionGuard>

// Show custom message if no permission
<PermissionGuard
  resource="journals"
  action="delete"
  fallback={<Alert>Contact admin for delete access</Alert>}
>
  <Button color="error">Delete</Button>
</PermissionGuard>
```

### Method 2: Using PermissionButton Components

Auto-disable buttons based on permissions:

```tsx
import { PermissionButton, PermissionIconButton } from "src/components/auth/PermissionButton";
import { Edit, Delete } from "@mui/icons-material";

// Regular button
<PermissionButton
  resource="members"
  action="create"
  variant="contained"
  tooltip="You need permission to create members"
>
  Add Member
</PermissionButton>

// Icon button
<PermissionIconButton
  resource="journals"
  action="update"
  tooltip="Edit Entry"
  size="small"
>
  <Edit />
</PermissionIconButton>
```

### Method 3: Using usePermissions Hook

For custom logic and conditional rendering:

```tsx
import { usePermissions } from "src/hooks/usePermissions";

const MyComponent = () => {
  const { 
    hasPermission, 
    canRead, 
    canCreate, 
    canUpdate, 
    canDelete,
    isLoading 
  } = usePermissions();

  if (isLoading) return <Loader />;

  // Check specific permission
  if (!canRead("journals")) {
    return <Alert>No access to journals</Alert>;
  }

  // Multiple checks
  const canManage = canCreate("journals") && canUpdate("journals");

  // Custom permission
  const hasCustomAccess = hasPermission("statistics", "read");

  return (
    <Box>
      {canCreate("journals") && <Button>Create</Button>}
      {canUpdate("journals") && <Button>Edit</Button>}
      {canDelete("journals") && <Button>Delete</Button>}
    </Box>
  );
};
```

---

## 🔧 Implementation Examples by Page Type

### Table/List Pages (e.g., Members, Products)

```tsx
import { PermissionGuard } from "src/components/auth/PermissionGuard";
import { PermissionButton, PermissionIconButton } from "src/components/auth/PermissionButton";
import { Edit, Delete, Add } from "@mui/icons-material";

const MembersPage = () => {
  return (
    <Box>
      {/* Page header with create button */}
      <Box display="flex" justifyContent="space-between" mb={2}>
        <Typography variant="h4">Members</Typography>
        
        <PermissionButton
          resource="members"
          action="create"
          variant="contained"
          startIcon={<Add />}
          onClick={handleCreate}
        >
          Add Member
        </PermissionButton>
      </Box>

      {/* Table - only show if can read */}
      <PermissionGuard resource="members" action="read">
        <Table>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>{member.name}</TableCell>
                <TableCell>
                  {/* Edit button - disabled if no permission */}
                  <PermissionIconButton
                    resource="members"
                    action="update"
                    tooltip="Edit Member"
                    onClick={() => handleEdit(member)}
                  >
                    <Edit />
                  </PermissionIconButton>

                  {/* Delete button - hidden if no permission */}
                  <PermissionGuard 
                    resource="members" 
                    action="delete" 
                    hideOnDenied
                  >
                    <IconButton onClick={() => handleDelete(member)}>
                      <Delete />
                    </IconButton>
                  </PermissionGuard>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </PermissionGuard>
    </Box>
  );
};
```

### Form Pages (Create/Edit)

```tsx
import { usePermissions } from "src/hooks/usePermissions";
import { PermissionButton } from "src/components/auth/PermissionButton";

const JournalForm = ({ isEdit, initialData }) => {
  const { canCreate, canUpdate } = usePermissions();
  const canSubmit = isEdit ? canUpdate("journals") : canCreate("journals");

  return (
    <form onSubmit={handleSubmit}>
      <TextField 
        label="Title"
        disabled={!canSubmit}
      />
      
      <TextField 
        label="Content"
        disabled={!canSubmit}
      />

      <Box display="flex" gap={2}>
        <Button onClick={handleCancel}>Cancel</Button>
        
        <PermissionButton
          resource="journals"
          action={isEdit ? "update" : "create"}
          type="submit"
          variant="contained"
        >
          {isEdit ? "Update" : "Create"}
        </PermissionButton>
      </Box>
    </form>
  );
};
```

### Dashboard/Statistics Pages

```tsx
import { usePermissions } from "src/hooks/usePermissions";
import { PermissionGuard } from "src/components/auth/PermissionGuard";

const DashboardPage = () => {
  const { canRead, isLoading } = usePermissions();

  if (isLoading) return <Loader />;

  return (
    <Box>
      <Typography variant="h4">Dashboard</Typography>

      {/* Statistics section */}
      <PermissionGuard 
        resource="statistics" 
        action="read"
        fallback={
          <Alert severity="info">
            Contact admin to get access to statistics
          </Alert>
        }
      >
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <StatCard title="Total Members" value={memberCount} />
          </Grid>
          <Grid item xs={12} md={4}>
            <StatCard title="Revenue" value={revenue} />
          </Grid>
          <Grid item xs={12} md={4}>
            <StatCard title="Active Users" value={activeUsers} />
          </Grid>
        </Grid>
      </PermissionGuard>

      {/* Other sections with different permissions */}
      <PermissionGuard resource="journals" action="read" hideOnDenied>
        <Box mt={4}>
          <Typography variant="h5">Recent Journals</Typography>
          <RecentJournalsList />
        </Box>
      </PermissionGuard>
    </Box>
  );
};
```

---

## 📋 Available Resources and Actions

### Resources

| Resource | Description | Route/Page |
|----------|-------------|------------|
| `journals` | Daily journal entries | `/dashboard/journal` |
| `abonnements` | Subscriptions | `/dashboard/abonnement` |
| `members` | Member management | `/dashboard/members` |
| `facilities` | Reservations/bookings | `/dashboard/reservations` |
| `products` | Product inventory | `/dashboard/products` |
| `expenses` | Expense tracking | `/dashboard/expenses` |
| `reclamations` | Complaints/issues | `/dashboard/reclamations` |
| `statistics` | Statistics dashboard | `/dashboard/` |
| `users` | User management | `/dashboard/users` |
| `settings` | System settings | `/dashboard/settings` |

### Actions

| Action | Description | Use Cases |
|--------|-------------|-----------|
| `read` | View/Read access | Tables, details, dashboards |
| `create` | Create/Add new items | Create buttons, forms |
| `update` | Edit/Modify existing items | Edit buttons, forms |
| `delete` | Remove/Delete items | Delete buttons |

---

## 🔐 Permission Check Patterns

### Pattern 1: Page-level Protection

```tsx
const JournalPage = () => {
  const { canRead } = usePermissions();

  if (!canRead("journals")) {
    return <AccessDeniedPage />;
  }

  return <JournalContent />;
};
```

### Pattern 2: Feature-level Protection

```tsx
<PermissionGuard resource="journals" action="create" hideOnDenied>
  <CreateJournalButton />
</PermissionGuard>
```

### Pattern 3: Action-level Protection

```tsx
<PermissionIconButton
  resource="journals"
  action="delete"
  tooltip="Delete Entry"
  onClick={handleDelete}
>
  <Delete />
</PermissionIconButton>
```

---

## 🐛 Troubleshooting

### Toggle Not Switching?

1. **Check user role**: Only SUPER_ADMIN can assign/remove permissions
2. **Check console**: Look for error messages
3. **Verify backend**: Make sure permissions are initialized
4. **Check network**: Verify API calls are successful

```tsx
// Add this to debug
const UserPermissionsDialog = () => {
  // ... existing code
  
  const handleTogglePermission = async (resource, action) => {
    console.log("Toggling:", resource, action);
    console.log("Permission ID:", permissionId);
    console.log("User ID:", user.id);
    
    try {
      // ... toggle logic
    } catch (err) {
      console.error("Error details:", err);
    }
  };
};
```

### Permissions Not Working in Frontend?

1. **Check user is logged in**: Verify sessionStorage has user data
2. **Check user ID**: Make sure usePermissions gets correct user ID
3. **Verify API response**: Check network tab for `/permissions/user/:id`

```tsx
// Debug hook
const { permissions, isLoading } = usePermissions();
console.log("User permissions:", permissions);
console.log("Loading:", isLoading);
```

### API Errors?

Common errors and solutions:

| Error | Cause | Solution |
|-------|-------|----------|
| 403 Forbidden | User not SUPER_ADMIN | Only SUPER_ADMIN can manage permissions |
| 401 Unauthorized | No token | User needs to log in |
| 404 Not Found | Permissions not initialized | Run initialize endpoint |

---

## 🎨 UI Customization

### Custom Permission Messages

```tsx
<PermissionGuard
  resource="journals"
  action="delete"
  fallback={
    <Alert severity="warning" sx={{ my: 2 }}>
      <AlertTitle>Permission Required</AlertTitle>
      You need delete permission to access this feature. 
      Contact your administrator at admin@example.com
    </Alert>
  }
>
  <DeleteSection />
</PermissionGuard>
```

### Custom Loading States

```tsx
const MyComponent = () => {
  const { isLoading } = usePermissions();

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
        <Typography ml={2}>Loading permissions...</Typography>
      </Box>
    );
  }

  return <Content />;
};
```

---

## 📊 Best Practices

### ✅ DO

- Check permissions at page level first
- Use `hideOnDenied` for optional features
- Provide clear feedback when permission is denied
- Use PermissionButton for action buttons
- Cache permission checks (already done by the hook)

### ❌ DON'T

- Don't rely solely on frontend permission checks (backend must validate too)
- Don't show confusing UI when permission is denied
- Don't forget to handle loading states
- Don't hardcode permission checks (use the hooks/components)

---

## 🔄 Backend Integration

The frontend permission system works with your existing backend:

```typescript
// Backend validates on every request
@UseGuards(PermissionsGuard)
@RequirePermission('journals', 'create')
@Post('journals')
createJournal(@Body() data) {
  // Only executed if user has permission
}
```

The frontend components will:
1. Check permissions and disable/hide UI
2. Backend validates again on API call
3. Double layer of security

---

## 📝 Migration Checklist

To add permissions to an existing page:

- [ ] Import required components/hooks
- [ ] Wrap page content in PermissionGuard for read access
- [ ] Replace regular buttons with PermissionButton
- [ ] Add permission checks to action buttons (edit/delete)
- [ ] Test with different user roles
- [ ] Add permission checks to the backend endpoints

---

## 🎓 Complete Example

Here's a complete example of a page with full permission integration:

```tsx
import React, { useState } from "react";
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  IconButton,
} from "@mui/material";
import { Edit, Delete, Add, Visibility } from "@mui/icons-material";
import { PermissionGuard } from "src/components/auth/PermissionGuard";
import { PermissionButton, PermissionIconButton } from "src/components/auth/PermissionButton";
import { usePermissions } from "src/hooks/usePermissions";

const ProductsPage = () => {
  const { canRead, canCreate, isLoading } = usePermissions();
  const [products, setProducts] = useState([]);

  // Page-level check
  if (isLoading) return <Box>Loading...</Box>;
  
  if (!canRead("products")) {
    return (
      <Box p={4}>
        <Typography variant="h4">Access Denied</Typography>
        <Typography>You don't have permission to view products.</Typography>
      </Box>
    );
  }

  return (
    <Box p={3}>
      {/* Header with create button */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Products</Typography>
        
        <PermissionButton
          resource="products"
          action="create"
          variant="contained"
          startIcon={<Add />}
          onClick={() => console.log("Create product")}
        >
          Add Product
        </PermissionButton>
      </Box>

      {/* Products table */}
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Price</TableCell>
            <TableCell>Stock</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id}>
              <TableCell>{product.name}</TableCell>
              <TableCell>${product.price}</TableCell>
              <TableCell>{product.stock}</TableCell>
              <TableCell>
                <PermissionIconButton
                  resource="products"
                  action="read"
                  tooltip="View Details"
                  size="small"
                >
                  <Visibility />
                </PermissionIconButton>

                <PermissionIconButton
                  resource="products"
                  action="update"
                  tooltip="Edit Product"
                  size="small"
                >
                  <Edit />
                </PermissionIconButton>

                <PermissionGuard resource="products" action="delete" hideOnDenied>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => console.log("Delete", product.id)}
                  >
                    <Delete />
                  </IconButton>
                </PermissionGuard>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
};

export default ProductsPage;
```

---

## 🚀 Next Steps

1. ✅ Initialize permissions in database
2. ✅ Test permission management UI
3. 📝 Update your pages with permission checks
4. 🧪 Test with different user roles
5. 🔒 Ensure backend validates permissions too

For more examples, see: `Front-end/src/examples/PermissionUsageExamples.tsx`

