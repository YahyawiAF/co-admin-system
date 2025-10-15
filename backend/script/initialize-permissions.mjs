import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

// Define default permissions for each role
const defaultRolePermissions = {
  [Role.SUPER_ADMIN]: [
    { resource: 'users', action: 'create' },
    { resource: 'users', action: 'read' },
    { resource: 'users', action: 'update' },
    { resource: 'users', action: 'delete' },
    { resource: 'members', action: 'create' },
    { resource: 'members', action: 'read' },
    { resource: 'members', action: 'update' },
    { resource: 'members', action: 'delete' },
    { resource: 'abonnements', action: 'create' },
    { resource: 'abonnements', action: 'read' },
    { resource: 'abonnements', action: 'update' },
    { resource: 'abonnements', action: 'delete' },
    { resource: 'journals', action: 'create' },
    { resource: 'journals', action: 'read' },
    { resource: 'journals', action: 'update' },
    { resource: 'journals', action: 'delete' },
    { resource: 'products', action: 'create' },
    { resource: 'products', action: 'read' },
    { resource: 'products', action: 'update' },
    { resource: 'products', action: 'delete' },
    { resource: 'expenses', action: 'create' },
    { resource: 'expenses', action: 'read' },
    { resource: 'expenses', action: 'update' },
    { resource: 'expenses', action: 'delete' },
    { resource: 'facilities', action: 'create' },
    { resource: 'facilities', action: 'read' },
    { resource: 'facilities', action: 'update' },
    { resource: 'facilities', action: 'delete' },
    { resource: 'reclamations', action: 'create' },
    { resource: 'reclamations', action: 'read' },
    { resource: 'reclamations', action: 'update' },
    { resource: 'reclamations', action: 'delete' },
    { resource: 'statistics', action: 'read' },
    { resource: 'settings', action: 'read' },
    { resource: 'settings', action: 'update' },
  ],
  [Role.ADMIN]: [
    { resource: 'users', action: 'create' },
    { resource: 'users', action: 'read' },
    { resource: 'users', action: 'update' },
    { resource: 'members', action: 'create' },
    { resource: 'members', action: 'read' },
    { resource: 'members', action: 'update' },
    { resource: 'members', action: 'delete' },
    { resource: 'abonnements', action: 'create' },
    { resource: 'abonnements', action: 'read' },
    { resource: 'abonnements', action: 'update' },
    { resource: 'abonnements', action: 'delete' },
    { resource: 'journals', action: 'create' },
    { resource: 'journals', action: 'read' },
    { resource: 'journals', action: 'update' },
    { resource: 'journals', action: 'delete' },
    { resource: 'products', action: 'create' },
    { resource: 'products', action: 'read' },
    { resource: 'products', action: 'update' },
    { resource: 'products', action: 'delete' },
    { resource: 'expenses', action: 'create' },
    { resource: 'expenses', action: 'read' },
    { resource: 'expenses', action: 'update' },
    { resource: 'expenses', action: 'delete' },
    { resource: 'facilities', action: 'read' },
    { resource: 'facilities', action: 'update' },
    { resource: 'reclamations', action: 'create' },
    { resource: 'reclamations', action: 'read' },
    { resource: 'reclamations', action: 'update' },
    { resource: 'reclamations', action: 'delete' },
    { resource: 'statistics', action: 'read' },
    { resource: 'settings', action: 'read' },
  ],
  [Role.MANAGER]: [
    { resource: 'members', action: 'create' },
    { resource: 'members', action: 'read' },
    { resource: 'members', action: 'update' },
    { resource: 'abonnements', action: 'create' },
    { resource: 'abonnements', action: 'read' },
    { resource: 'abonnements', action: 'update' },
    { resource: 'journals', action: 'create' },
    { resource: 'journals', action: 'read' },
    { resource: 'journals', action: 'update' },
    { resource: 'products', action: 'read' },
    { resource: 'products', action: 'update' },
    { resource: 'expenses', action: 'read' },
    { resource: 'expenses', action: 'update' },
    { resource: 'facilities', action: 'read' },
    { resource: 'reclamations', action: 'read' },
    { resource: 'reclamations', action: 'update' },
    { resource: 'statistics', action: 'read' },
  ],
  [Role.STAFF]: [
    { resource: 'members', action: 'read' },
    { resource: 'abonnements', action: 'read' },
    { resource: 'journals', action: 'create' },
    { resource: 'journals', action: 'read' },
    { resource: 'products', action: 'read' },
    { resource: 'expenses', action: 'read' },
    { resource: 'reclamations', action: 'read' },
  ],
  [Role.MEMBER]: [
    { resource: 'abonnements', action: 'read' },
    { resource: 'journals', action: 'read' },
    { resource: 'products', action: 'read' },
    { resource: 'reclamations', action: 'create' },
    { resource: 'reclamations', action: 'read' },
  ],
};

async function initializePermissions() {
  try {
    console.log('Starting permissions initialization...');

    // Create all permissions
    const allPermissions = new Set();
    Object.values(defaultRolePermissions).forEach(permissions => {
      permissions.forEach(perm => {
        allPermissions.add(`${perm.resource}:${perm.action}`);
      });
    });

    console.log(`Creating ${allPermissions.size} permissions...`);

    for (const permissionName of allPermissions) {
      const [resource, action] = permissionName.split(':');
      await prisma.permission.upsert({
        where: { name: permissionName },
        update: {},
        create: {
          name: permissionName,
          resource,
          action,
          description: `${action} ${resource}`,
        },
      });
    }

    console.log('Permissions created successfully');

    // Assign default permissions to roles
    for (const [role, permissions] of Object.entries(defaultRolePermissions)) {
      console.log(`Assigning permissions to role: ${role}`);
      
      for (const permission of permissions) {
        const permissionName = `${permission.resource}:${permission.action}`;
        const permissionRecord = await prisma.permission.findUnique({
          where: { name: permissionName },
        });

        if (permissionRecord) {
          await prisma.rolePermission.upsert({
            where: {
              role_permissionId_userId: {
                role: role,
                permissionId: permissionRecord.id,
                userId: null,
              },
            },
            update: {},
            create: {
              role: role,
              permissionId: permissionRecord.id,
            },
          });
        }
      }
    }

    console.log('Role permissions assigned successfully');

    // Create a super admin user if none exists
    const superAdminExists = await prisma.user.findFirst({
      where: { role: Role.SUPER_ADMIN },
    });

    if (!superAdminExists) {
      console.log('Creating default super admin user...');
      await prisma.user.create({
        data: {
          email: 'admin@coworking.com',
          fullname: 'Super Administrator',
          role: Role.SUPER_ADMIN,
          isActive: true,
          // Note: In production, you should set a proper password
          password: '$2b$10$example.hash.here', // This should be a proper bcrypt hash
        },
      });
      console.log('Default super admin user created');
    }

    console.log('Permissions initialization completed successfully!');
  } catch (error) {
    console.error('Error initializing permissions:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the initialization
initializePermissions()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
