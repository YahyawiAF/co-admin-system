# 🚀 Permissions System - Quick Start Guide

## What's Been Fixed & Added

### ✅ Fixed Issues
1. **Toggle switches now work** - Properly updates backend and UI
2. **Optimistic updates** - UI responds immediately, reverts on error
3. **Better error handling** - Clear messages if something fails
4. **Role validation** - Explains if user needs SUPER_ADMIN access

### ✅ New Features
1. **usePermissions Hook** - Check permissions anywhere in your app
2. **PermissionGuard Component** - Protect UI sections automatically
3. **PermissionButton Components** - Auto-disable buttons without permission
4. **Complete Examples** - Copy-paste ready code for common scenarios

---

## 🎯 3-Minute Setup

### Step 1: Initialize Permissions (One-Time)

You need to create the default permissions in your database. **Run this once:**

```bash
# Option A: Via API call (Postman, curl, etc.)
POST http://your-backend-url/permissions/initialize
Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN
```

```bash
# Option B: From your backend terminal
# Navigate to your backend folder and create a script:
node script/initialize-permissions.mjs
```

### Step 2: Test Permission Management

1. Go to `/dashboard/users`
2. Click the **blue Security icon** 🔒 next to any user
3. Toggle any permission on/off
4. Should see green success message
5. Check console if you see errors

### Step 3: Use Permissions in Your Pages

Pick the method that fits your use case:

#### Method A: Quick - Use PermissionGuard

```tsx
import { PermissionGuard } from "src/components/auth/PermissionGuard";

<PermissionGuard resource="journals" action="read">
  <YourComponent />
</PermissionGuard>
```

#### Method B: For Buttons - Use PermissionButton

```tsx
import { PermissionButton } from "src/components/auth/PermissionButton";

<PermissionButton resource="journals" action="create">
  Create Entry
</PermissionButton>
```

#### Method C: Custom Logic - Use Hook

```tsx
import { usePermissions } from "src/hooks/usePermissions";

const { canRead, canCreate, canUpdate, canDelete } = usePermissions();

if (canCreate("journals")) {
  // Show create button
}
```

---

## 📝 Copy-Paste Examples

### Protect a Full Page

```tsx
import { usePermissions } from "src/hooks/usePermissions";

const JournalPage = () => {
  const { canRead, isLoading } = usePermissions();

  if (isLoading) return <div>Loading...</div>;
  
  if (!canRead("journals")) {
    return <div>You don't have access to journals</div>;
  }

  return <div>Journal content here...</div>;
};
```

### Protect a Create Button

```tsx
import { PermissionButton } from "src/components/auth/PermissionButton";
import { Add } from "@mui/icons-material";

<PermissionButton
  resource="members"
  action="create"
  variant="contained"
  startIcon={<Add />}
  onClick={handleCreate}
>
  Add Member
</PermissionButton>
```

### Protect Table Action Buttons

```tsx
import { PermissionIconButton } from "src/components/auth/PermissionButton";
import { Edit, Delete } from "@mui/icons-material";

<TableCell>
  <PermissionIconButton
    resource="journals"
    action="update"
    tooltip="Edit"
    onClick={() => handleEdit(row)}
  >
    <Edit />
  </PermissionIconButton>

  <PermissionIconButton
    resource="journals"
    action="delete"
    tooltip="Delete"
    onClick={() => handleDelete(row)}
  >
    <Delete />
  </PermissionIconButton>
</TableCell>
```

### Hide Section Completely if No Permission

```tsx
import { PermissionGuard } from "src/components/auth/PermissionGuard";

<PermissionGuard resource="statistics" action="read" hideOnDenied>
  <StatisticsSection />
</PermissionGuard>
```

---

## 🗺️ Resource Names Reference

Use these exact resource names in your permission checks:

| Resource | Page/Feature |
|----------|-------------|
| `journals` | Daily journal entries |
| `abonnements` | Subscriptions |
| `members` | Members management |
| `facilities` | Reservations/Bookings |
| `products` | Products inventory |
| `expenses` | Expenses tracking |
| `reclamations` | Complaints/Issues |
| `statistics` | Statistics dashboard |
| `users` | User management |
| `settings` | System settings |

### Actions

- `read` - View/see the data
- `create` - Add new items
- `update` - Edit existing items
- `delete` - Remove items

---

## 🐛 Troubleshooting

### Q: Toggle not switching?

**A:** Check these in order:

1. Are you logged in as SUPER_ADMIN? (Only SUPER_ADMIN can assign permissions)
2. Check browser console for errors
3. Check network tab - is the API call successful?
4. Did you initialize permissions? (Step 1 above)

### Q: Permissions not working in frontend?

**A:** Debug checklist:

```tsx
// Add this to your component to debug:
const { permissions, isLoading } = usePermissions();
console.log("Permissions:", permissions);
console.log("Loading:", isLoading);

// Check if user ID is correct:
const userStr = sessionStorage.getItem("user");
console.log("Current user:", JSON.parse(userStr));
```

### Q: Getting 403 Forbidden errors?

**A:** Only SUPER_ADMIN can manage permissions. Make sure:
- You're logged in as SUPER_ADMIN
- Your session token is valid
- The user in the database has role = "SUPER_ADMIN"

### Q: Permission changes not reflecting?

**A:** Try:
1. Close the permissions dialog and reopen it
2. Refresh the page
3. Clear sessionStorage and log in again
4. Check the database directly to verify the permission was saved

---

## 📚 Full Documentation

For complete details, see:
- **PERMISSIONS_IMPLEMENTATION_GUIDE.md** - Complete guide with all patterns
- **PERMISSIONS_FEATURE.md** - Feature overview and architecture
- **Front-end/src/examples/PermissionUsageExamples.tsx** - Live code examples

---

## 🎓 Real-World Example

Here's a complete mini-page with permissions:

```tsx
import React from "react";
import { Box, Typography, Button, Table, TableBody, TableCell, TableRow } from "@mui/material";
import { Edit, Delete, Add } from "@mui/icons-material";
import { PermissionGuard } from "src/components/auth/PermissionGuard";
import { PermissionButton, PermissionIconButton } from "src/components/auth/PermissionButton";
import { usePermissions } from "src/hooks/usePermissions";

const ProductsPage = () => {
  const { canRead, isLoading } = usePermissions();
  const products = []; // Your data here

  if (isLoading) return <Box>Loading permissions...</Box>;
  
  if (!canRead("products")) {
    return <Box p={4}>You don't have access to products.</Box>;
  }

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" mb={3}>
        <Typography variant="h4">Products</Typography>
        
        <PermissionButton
          resource="products"
          action="create"
          variant="contained"
          startIcon={<Add />}
        >
          Add Product
        </PermissionButton>
      </Box>

      {/* Table */}
      <Table>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id}>
              <TableCell>{product.name}</TableCell>
              <TableCell>{product.price}</TableCell>
              <TableCell>
                <PermissionIconButton
                  resource="products"
                  action="update"
                  tooltip="Edit Product"
                >
                  <Edit />
                </PermissionIconButton>

                <PermissionGuard resource="products" action="delete" hideOnDenied>
                  <Button color="error" size="small">
                    <Delete />
                  </Button>
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

## ✅ Checklist for Adding Permissions to a Page

- [ ] Import the necessary components/hooks
- [ ] Add page-level permission check (if entire page needs protection)
- [ ] Wrap sections with `<PermissionGuard>` as needed
- [ ] Replace regular buttons with `<PermissionButton>` or `<PermissionIconButton>`
- [ ] Test with a user that DOESN'T have the permission
- [ ] Test with a user that DOES have the permission
- [ ] Verify backend also validates the permission

---

## 🎉 You're Done!

Your permission system is now:
- ✅ Managing user permissions via UI
- ✅ Protecting frontend features
- ✅ Connected to backend validation
- ✅ Ready for production

**Need help?** Check the full guides or the examples folder!

