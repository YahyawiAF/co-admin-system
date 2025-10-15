# User Permissions Management Feature

## Overview
Added comprehensive user permission management interface to control what users can access and do within the application.

## Features Implemented

### 1. **User Permissions Dialog Component**
   - Location: `Front-end/src/components/pages/dashboard/users/UserPermissionsDialog.tsx`
   - Beautiful, organized UI with Material-UI components
   - Grouped permissions by resource type
   - Toggle switches for easy permission control
   - Real-time updates to backend
   - Success/error notifications

### 2. **Resource Groups with Granular Control**

The following resources are now manageable with specific actions:

#### **Journal (Daily Entries)**
- ✓ View/Read - Can view journal entries
- ✓ Create/Add - Can create new entries
- ✓ Edit/Update - Can modify existing entries
- ✓ Delete/Remove - Can delete entries

#### **Subscription (Abonnement)**
- ✓ View/Read - Can view subscriptions
- ✓ Create/Add - Can create new subscriptions
- ✓ Edit/Update - Can modify subscriptions
- ✓ Delete/Remove - Can remove subscriptions

#### **Membership**
- ✓ View/Read - Can view members
- ✓ Create/Add - Can add new members
- ✓ Edit/Update - Can edit member details
- ✓ Delete/Remove - Can remove members

#### **Reservation**
- ✓ View/Read - Can view reservations
- ✓ Edit/Update - Can modify reservations

#### **Products**
- ✓ View/Read - Can view products
- ✓ Create/Add - Can add products
- ✓ Edit/Update - Can modify products
- ✓ Delete/Remove - Can remove products

#### **Expenses**
- ✓ View/Read - Can view expenses
- ✓ Create/Add - Can add expenses
- ✓ Edit/Update - Can modify expenses
- ✓ Delete/Remove - Can remove expenses

#### **Reclamations (Complaints)**
- ✓ View/Read - Can view reclamations
- ✓ Create/Add - Can submit reclamations
- ✓ Edit/Update - Can modify reclamations
- ✓ Delete/Remove - Can remove reclamations

#### **Statistics & Overview**
- ✓ View/Read - Can view statistics dashboard

#### **Users Management**
- ✓ View/Read - Can view users
- ✓ Create/Add - Can create users
- ✓ Edit/Update - Can edit users
- ✓ Delete/Remove - Can delete users

#### **Settings**
- ✓ View/Read - Can view settings
- ✓ Edit/Update - Can modify settings

### 3. **Integration with Users Page**
   - Added "Manage Permissions" button (Security icon) in the actions column
   - Button tooltip for better UX
   - Highlighted with primary color
   - Opens permissions dialog on click

### 4. **Backend Integration**
   - Connected to existing permissions API
   - Uses RTK Query for efficient data fetching and caching
   - Real-time permission updates
   - Automatic refetch after changes

### 5. **Redux Store Configuration**
   - Added `permissionsServices` to Redux store
   - Proper middleware configuration
   - Integrated with existing API services

## How to Use

1. **Navigate to Users Page**
   - Go to `/dashboard/users`
   - Only accessible by SUPER_ADMIN and ADMIN roles

2. **Select a User**
   - Find the user you want to manage
   - Click the blue Security icon in the Actions column

3. **Configure Permissions**
   - The permissions dialog will open
   - Toggle switches to grant or revoke permissions
   - Each toggle immediately saves to the backend
   - Green success messages confirm changes
   - Red error messages show if something went wrong

4. **Review Permissions**
   - User's current role is displayed at the top
   - Role-based permissions are automatically included
   - Custom permissions are shown with toggle states
   - Permissions are grouped by resource type for easy navigation

## Technical Details

### API Endpoints Used
- `GET /permissions` - Fetch all available permissions
- `GET /permissions/user/:userId` - Get user's permissions
- `POST /permissions/user/:userId/assign` - Grant permission to user
- `DELETE /permissions/user/:userId/remove` - Revoke permission from user

### Permission Format
Permissions follow the pattern: `resource:action`
- Example: `journals:read`, `members:create`, `statistics:read`

### User Experience Features
- Loading states while fetching data
- Inline notifications for success/error
- Disabled states during updates (prevents double-clicks)
- Clean, organized layout with sections
- Responsive design for different screen sizes
- Tooltips on action buttons
- Color-coded role chips

## Permission System Logic

1. **Role-Based Permissions**: Users inherit base permissions from their role
2. **User-Specific Permissions**: Additional permissions can be granted/revoked per user
3. **Combined Permissions**: The system merges both role-based and user-specific permissions
4. **Access Control**: Frontend and backend enforce these permissions

## Benefits

✅ **Granular Control**: Fine-tune what each user can do
✅ **Flexible**: Override role-based permissions for special cases
✅ **User-Friendly**: Simple toggle interface
✅ **Real-Time**: Instant updates
✅ **Secure**: Backend validation on all permission changes
✅ **Auditable**: All permission changes are tracked in the database

## Future Enhancements (Optional)

- Bulk permission assignment for multiple users
- Permission templates/presets
- Permission history/audit log
- Export/import permission configurations
- Permission groups for easier management

