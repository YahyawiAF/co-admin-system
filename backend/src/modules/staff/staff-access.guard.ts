import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { PrismaService } from 'database/prisma.service';
import { RequestContext } from 'common/request-context';
import { authorize, normalizePath, normalizePermissions, StaffPermissions } from './permissions';

type CachedStaff = {
  at: number;
  user: { id: string; role: Role; isActive: boolean; deletedAt: Date | null; accessToken: string | null };
  memberships: Array<{ organizationId: string; permissions: StaffPermissions }>;
};

const CACHE_MS = 5_000;

/**
 * Global guard. Requests from anyone other than a STAFF user pass through
 * unchanged; STAFF requests are checked against their per-module permissions
 * for the organization they are working in.
 */
@Injectable()
export class StaffAccessGuard implements CanActivate {
  private cache = new Map<string, CachedStaff>();

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /** Drop cached permissions after the admin changes them. */
  invalidate(userId: string) {
    this.cache.delete(userId);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest();
    const [type, token] = String(req.headers?.authorization || '').split(' ');
    if (type !== 'Bearer' || !token) return true;

    let payload: { userId?: string; role?: string };
    try {
      payload = this.jwt.verify(token, { secret: process.env.JWT_ACCESS_SECRET });
    } catch {
      return true; // not an admin access token (refresh token, visitor token…)
    }
    if (!payload?.userId) return true;

    const staff = await this.load(payload.userId);
    if (!staff || staff.user.role !== Role.STAFF) return true;

    if (!staff.user.isActive || staff.user.deletedAt || staff.user.accessToken !== token) {
      throw new UnauthorizedException('Session expirée ou compte désactivé');
    }

    const requestedOrg =
      (typeof req.query?.organizationId === 'string' && req.query.organizationId) ||
      (typeof req.headers?.['x-organization-id'] === 'string' && req.headers['x-organization-id']) ||
      null;
    const membership = requestedOrg
      ? staff.memberships.find((m) => m.organizationId === requestedOrg)
      : staff.memberships[0];
    if (!membership) {
      throw new ForbiddenException("Vous n'avez pas accès à cette organisation");
    }

    const path = normalizePath(req.originalUrl || req.url);
    const hint = typeof req.headers?.['x-app-module'] === 'string' ? req.headers['x-app-module'] : null;
    const decision = authorize(membership.permissions, req.method, path, hint);
    if (decision.allowed === false) throw new ForbiddenException(decision.reason);

    const store = RequestContext.get();
    const info = {
      isStaff: true,
      userId: staff.user.id,
      organizationId: membership.organizationId,
      module: decision.module,
      deleteMode: decision.deleteMode,
      path,
    };
    if (store) Object.assign(store, info);
    req.staff = info;
    return true;
  }

  private async load(userId: string): Promise<CachedStaff | null> {
    const hit = this.cache.get(userId);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        isActive: true,
        deletedAt: true,
        accessToken: true,
        organizationMemberships: {
          select: { organizationId: true, permissions: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!user) return null;
    const entry: CachedStaff = {
      at: Date.now(),
      user,
      memberships: user.organizationMemberships.map((m) => ({
        organizationId: m.organizationId,
        permissions: normalizePermissions(m.permissions),
      })),
    };
    this.cache.set(userId, entry);
    return entry;
  }
}
