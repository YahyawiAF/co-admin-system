# Role-Based Access Control System

This document describes the comprehensive role-based access control (RBAC) system implemented for the coworking space admin system.

## Overview

The system provides granular access control with multiple user roles and permission-based authorization for different features and resources.

## User Roles

### 1. SUPER_ADMIN
- **Description**: Full system access with all permissions
- **Capabilities**:
  - Manage all users and their roles
  - Access all system features
  - Configure system settings
  - Delete any data
  - Initialize permissions system

### 2. ADMIN
- **Description**: Administrative access with most permissions
- **Capabilities**:
  - Manage users (create, read, update)
  - Full member management
  - Manage subscriptions and journals
  - Product and expense management
  - Handle complaints
  - View statistics

### 3. MANAGER
- **Description**: Management-level access for daily operations
- **Capabilities**:
  - Manage members and subscriptions
  - Create and update journals
  - Read products and expenses
  - Handle complaints
  - View statistics

### 4. STAFF
- **Description**: Staff-level access for basic operations
- **Capabilities**:
  - Read member information
  - Create and read journals
  - Read products and expenses
  - Read complaints

### 5. MEMBER
- **Description**: Basic member access
- **Capabilities**:
  - Read own subscription information
  - Read own journal entries
  - Read product information
  - Create and read own complaints

## Permission System

### Permission Structure
Each permission is defined as: `{resource}:{action}`

**Resources:**
- `users` - User management
- `members` - Member management
- `abonnements` - Subscription management
- `journals` - Daily journal entries
- `products` - Product/inventory management
- `expenses` - Expense tracking
- `facilities` - Facility management
- `reclamations` - Complaint management
- `statistics` - Analytics and reports
- `settings` - System configuration

**Actions:**
- `create` - Create new records
- `read` - View records
- `update` - Modify existing records
- `delete` - Remove records

### Permission Examples
- `users:create` - Permission to create new users
- `members:read` - Permission to view member information
- `abonnements:update` - Permission to modify subscriptions
- `statistics:read` - Permission to view analytics

## Backend Implementation

### Database Schema

#### User Model
```prisma
model User {
  id                 String    @id @default(uuid())
  role               Role      @default(MEMBER)
  // ... other fields
  rolePermissions    RolePermission[]
}
```

#### Permission Model
```prisma
model Permission {
  id          String           @id @default(uuid())
  name        String           @unique
  description String?
  resource    String
  action      String
  rolePermissions RolePermission[]
}
```

#### RolePermission Model
```prisma
model RolePermission {
  id           String     @id @default(uuid())
  role         Role
  permissionId String
  permission   Permission @relation(fields: [permissionId], references: [id])
  userId       String?
  user         User?      @relation(fields: [userId], references: [id])
}
```

### API Endpoints

#### User Management
- `GET /users` - List all users (ADMIN+)
- `GET /users/:id` - Get user by ID
- `PATCH /users/:id` - Update user
- `PATCH /users/:id/role` - Update user role (ADMIN+)
- `GET /users/role/:role` - Get users by role (ADMIN+)
- `POST /users/:id/invite` - Invite user with role (ADMIN+)
- `GET /users/roles/available` - Get available roles (ADMIN+)

#### Permission Management
- `GET /permissions` - List all permissions (ADMIN+)
- `GET /permissions/user/:userId` - Get user permissions (ADMIN+)
- `GET /permissions/role/:role` - Get role permissions (ADMIN+)
- `POST /permissions/user/:userId/assign` - Assign permission to user (SUPER_ADMIN)
- `DELETE /permissions/user/:userId/remove` - Remove permission from user (SUPER_ADMIN)
- `POST /permissions/initialize` - Initialize permissions system (SUPER_ADMIN)

### Guards and Decorators

#### Role Guard
```typescript
@Roles([Role.ADMIN, Role.SUPER_ADMIN])
@UseGuards(JwtAuthGuard, RolesGuard)
```

#### Permission Guard
```typescript
@RequirePermissions('users:create', 'members:read')
@UseGuards(JwtAuthGuard, PermissionsGuard)
```

## Frontend Implementation

### Role-Based Components

#### Protected Routes
```typescript
<RoleProtectedRoute allowedRoles={[Role.ADMIN, Role.SUPER_ADMIN]}>
  <UserManagementPage />
</RoleProtectedRoute>
```

#### Role-Based Navigation
```typescript
<RoleBasedNavigation
  items={navigationItems}
  onItemClick={handleNavigation}
/>
```

#### Role-Based Dashboard
```typescript
<RoleBasedDashboard />
```

### User Management Interface

#### Features
- View all users with role filtering
- Create new users with role assignment
- Update user roles
- Invite users with specific roles
- Role-based access to management features

#### Components
- `UserForm` - Create/edit user form
- `UserTable` - User listing with actions
- `RoleSelector` - Role selection component
- `PermissionManager` - Permission assignment interface

## Setup and Initialization

### 1. Database Migration
```bash
# Run Prisma migration to update schema
npx prisma migrate dev --name add-role-permissions
```

### 2. Initialize Permissions
```bash
# Run the permissions initialization script
node backend/script/initialize-permissions.mjs
```

### 3. Create Super Admin
The initialization script creates a default super admin user:
- Email: `admin@coworking.com`
- Role: `SUPER_ADMIN`
- **Important**: Change the default password after first login

## Usage Examples

### Backend Usage

#### Protecting an Endpoint
```typescript
@Controller('members')
export class MemberController {
  @Get()
  @Roles([Role.ADMIN, Role.MANAGER])
  @UseGuards(JwtAuthGuard, RolesGuard)
  async findAll() {
    // Only ADMIN and MANAGER can access
  }

  @Post()
  @RequirePermissions('members:create')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  async create(@Body() createMemberDto: CreateMemberDto) {
    // Only users with members:create permission can access
  }
}
```

#### Checking Permissions in Service
```typescript
@Injectable()
export class MemberService {
  constructor(private permissionsService: PermissionsService) {}

  async createMember(userId: string, data: CreateMemberDto) {
    const hasPermission = await this.permissionsService.hasPermission(
      userId,
      'members',
      'create'
    );
    
    if (!hasPermission) {
      throw new ForbiddenException('Insufficient permissions');
    }
    
    // Create member logic
  }
}
```

### Frontend Usage

#### Role-Based Component Rendering
```typescript
const Dashboard = () => {
  const { user } = useAuth();
  
  return (
    <div>
      {user?.role === Role.ADMIN && (
        <UserManagementSection />
      )}
      
      {[Role.ADMIN, Role.MANAGER].includes(user?.role) && (
        <MemberManagementSection />
      )}
      
      <MemberSection />
    </div>
  );
};
```

#### Permission-Based Actions
```typescript
const MemberActions = ({ member }) => {
  const { user } = useAuth();
  const [hasDeletePermission, setHasDeletePermission] = useState(false);
  
  useEffect(() => {
    // Check if user has delete permission
    checkPermission('members', 'delete').then(setHasDeletePermission);
  }, [user]);
  
  return (
    <div>
      <EditButton />
      {hasDeletePermission && <DeleteButton />}
    </div>
  );
};
```

## Security Considerations

### 1. Role Hierarchy
- SUPER_ADMIN has all permissions
- ADMIN has most permissions except system settings
- MANAGER has operational permissions
- STAFF has limited read/write permissions
- MEMBER has minimal permissions

### 2. Permission Validation
- All API endpoints are protected with appropriate guards
- Frontend components check permissions before rendering
- Database queries respect user permissions

### 3. Audit Trail
- Role changes are logged
- Permission assignments are tracked
- User actions are recorded with timestamps

## Best Practices

### 1. Role Assignment
- Assign the minimum required role for each user
- Regularly review and update user roles
- Use role-based groups for common permissions

### 2. Permission Management
- Grant specific permissions rather than broad roles when possible
- Regularly audit permission assignments
- Remove unused permissions

### 3. Security
- Always validate permissions on both frontend and backend
- Use HTTPS for all API communications
- Implement proper session management
- Regular security audits

## Troubleshooting

### Common Issues

#### 1. Permission Denied Errors
- Check if user has the required role
- Verify permission assignments
- Ensure guards are properly configured

#### 2. Frontend Components Not Showing
- Check role-based rendering conditions
- Verify user role in authentication context
- Check component permission requirements

#### 3. API Access Denied
- Verify JWT token is valid
- Check role and permission guards
- Ensure user has required permissions

### Debugging

#### Check User Permissions
```typescript
// Backend
const permissions = await permissionsService.getUserPermissions(userId);
console.log('User permissions:', permissions);

// Frontend
const { data: permissions } = useGetUserPermissionsQuery(userId);
console.log('User permissions:', permissions);
```

#### Verify Role Assignment
```typescript
// Check user role
const user = await prisma.user.findUnique({ where: { id: userId } });
console.log('User role:', user.role);
```

## Future Enhancements

### 1. Advanced Features
- Role inheritance
- Time-based permissions
- Location-based access control
- API rate limiting by role

### 2. Management Tools
- Role assignment workflows
- Permission request system
- Automated role provisioning
- Advanced audit reporting

### 3. Integration
- SSO integration
- LDAP/Active Directory sync
- Third-party permission providers
- Multi-tenant support

## Support

For questions or issues related to the role-based access control system:

1. Check this documentation
2. Review the code examples
3. Check the troubleshooting section
4. Contact the development team

## Changelog

### Version 1.0.0
- Initial implementation of RBAC system
- Five user roles with granular permissions
- Backend API with guards and decorators
- Frontend components with role-based rendering
- Permission initialization system
- User management interface
