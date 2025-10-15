import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  // Define default permissions for each role
  private readonly defaultRolePermissions = {
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

  async initializePermissions() {
    // Create all permissions
    const allPermissions = new Set<string>();
    Object.values(this.defaultRolePermissions).forEach(permissions => {
      permissions.forEach(perm => {
        allPermissions.add(`${perm.resource}:${perm.action}`);
      });
    });

    for (const permissionName of allPermissions) {
      const [resource, action] = permissionName.split(':');
      await this.prisma.permission.upsert({
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

    // Assign default permissions to roles
    for (const [role, permissions] of Object.entries(this.defaultRolePermissions)) {
      for (const permission of permissions) {
        const permissionName = `${permission.resource}:${permission.action}`;
        const permissionRecord = await this.prisma.permission.findUnique({
          where: { name: permissionName },
        });

        if (permissionRecord) {
          await this.prisma.rolePermission.upsert({
            where: {
              role_permissionId_userId: {
                role: role as Role,
                permissionId: permissionRecord.id,
                userId: null,
              },
            },
            update: {},
            create: {
              role: role as Role,
              permissionId: permissionRecord.id,
            },
          });
        }
      }
    }
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!user) {
      return [];
    }

    // Get role-based permissions
    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: {
        role: user.role,
        userId: null, // Global role permissions
      },
      include: {
        permission: true,
      },
    });

    // Get user-specific permissions
    const userSpecificPermissions = user.rolePermissions.map(rp => rp.permission.name);

    // Combine role and user-specific permissions
    const allPermissions = [
      ...rolePermissions.map(rp => rp.permission.name),
      ...userSpecificPermissions,
    ];

    return [...new Set(allPermissions)]; // Remove duplicates
  }

  async hasPermission(userId: string, resource: string, action: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    const requiredPermission = `${resource}:${action}`;
    return permissions.includes(requiredPermission);
  }

  async assignPermissionToUser(userId: string, permissionId: string) {
    return this.prisma.rolePermission.create({
      data: {
        userId,
        permissionId,
        role: Role.MEMBER, // This will be overridden by user-specific permission
      },
    });
  }

  async removePermissionFromUser(userId: string, permissionId: string) {
    return this.prisma.rolePermission.deleteMany({
      where: {
        userId,
        permissionId,
      },
    });
  }

  async getAllPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [
        { resource: 'asc' },
        { action: 'asc' },
      ],
    });
  }

  async getRolePermissions(role: Role) {
    return this.prisma.rolePermission.findMany({
      where: {
        role,
        userId: null, // Only global role permissions
      },
      include: {
        permission: true,
      },
    });
  }
}
