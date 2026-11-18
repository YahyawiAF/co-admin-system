import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomInt } from 'crypto';
import { Role } from '@prisma/client';
import { PrismaService } from 'database/prisma.service';

/** No 0/O, 1/l/I: the code is read from a screen and typed on a phone */
const GATE_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const GATE_KEY_RE = /^[A-Za-z0-9_-]{6,40}$/;

/** Cookie value for a device unlocked with this code; changes when the code changes */
export function adminGateDeviceToken(key: string) {
  return createHash('sha256').update(`admin-gate:${key}`).digest('hex');
}

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  private toPublic(org: {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
    facebookUrl?: string | null;
    instagramUrl?: string | null;
    isActive?: boolean;
    activatedAt?: Date | null;
    notes?: string | null;
    createdAt?: Date;
    facilities: Array<{
      id: string;
      name: string;
      logo: string | null;
      socialNetworks?: unknown;
    }>;
    _count?: { members?: number; facilities?: number };
  }) {
    const facility = org.facilities[0] || null;
    const social =
      facility?.socialNetworks && typeof facility.socialNetworks === 'object'
        ? (facility.socialNetworks as Record<string, string>)
        : {};
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      logo: org.logo || facility?.logo || null,
      facebookUrl: org.facebookUrl || social.facebook || null,
      instagramUrl: org.instagramUrl || social.instagram || null,
      isActive: org.isActive ?? true,
      activatedAt: org.activatedAt ?? null,
      notes: org.notes ?? null,
      createdAt: org.createdAt ?? null,
      memberCount: org._count?.members ?? undefined,
      facilityCount:
        org._count?.facilities ?? org.facilities?.length ?? undefined,
      facility: facility
        ? { id: facility.id, name: facility.name, logo: facility.logo }
        : null,
    };
  }

  async list() {
    const orgs = await this.prisma.organization.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      include: {
        facilities: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            logo: true,
            socialNetworks: true,
          },
        },
      },
    });
    return orgs.map((o) => this.toPublic(o));
  }

  /** Super-admin CRM: all orgs with counts */
  async listCrm() {
    const orgs = await this.prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        facilities: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            logo: true,
            socialNetworks: true,
          },
        },
        _count: { select: { members: true, facilities: true } },
      },
    });
    return orgs.map((o) => this.toPublic(o));
  }

  async findBySlug(slug: string) {
    const org = await this.prisma.organization.findUnique({
      where: { slug },
      include: {
        facilities: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            logo: true,
            socialNetworks: true,
          },
        },
      },
    });
    if (!org) {
      throw new NotFoundException('Organisation introuvable');
    }
    if (!org.isActive) {
      throw new BadRequestException('Cette organisation est désactivée');
    }
    return this.toPublic(org);
  }

  async setActive(id: string, isActive: boolean, notes?: string | null) {
    const existing = await this.prisma.organization.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Organisation introuvable');
    const org = await this.prisma.organization.update({
      where: { id },
      data: {
        isActive,
        activatedAt: isActive ? new Date() : existing.activatedAt,
        ...(notes !== undefined ? { notes } : {}),
      },
      include: {
        facilities: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            logo: true,
            socialNetworks: true,
          },
        },
        _count: { select: { members: true, facilities: true } },
      },
    });
    return this.toPublic(org);
  }

  async create(body: {
    name: string;
    slug: string;
    logo?: string | null;
    facebookUrl?: string | null;
    instagramUrl?: string | null;
  }) {
    const slug = body.slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-|-$/g, '');
    if (!body.name?.trim() || !slug) {
      throw new BadRequestException('Nom et slug requis');
    }
    const exists = await this.prisma.organization.findUnique({
      where: { slug },
    });
    if (exists) {
      throw new BadRequestException('Ce slug est déjà utilisé');
    }
    const org = await this.prisma.organization.create({
      data: {
        name: body.name.trim(),
        slug,
        logo: body.logo || null,
        facebookUrl: body.facebookUrl || null,
        instagramUrl: body.instagramUrl || null,
        isActive: true,
        activatedAt: new Date(),
        facilities: {
          create: {
            name: body.name.trim(),
            numtel: '',
            email: '',
            adresse: '',
            nbrPlaces: 0,
            socialNetworks: {},
            places: {},
          },
        },
      },
      include: {
        facilities: {
          select: {
            id: true,
            name: true,
            logo: true,
            socialNetworks: true,
          },
        },
        _count: { select: { members: true, facilities: true } },
      },
    });
    return this.toPublic(org);
  }

  async update(
    id: string,
    body: Partial<{
      name: string;
      slug: string;
      logo: string | null;
      facebookUrl: string | null;
      instagramUrl: string | null;
    }>,
  ) {
    const existing = await this.prisma.organization.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Organisation introuvable');
    }
    let slug = body.slug;
    if (slug != null) {
      slug = slug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-|-$/g, '');
      if (!slug) throw new BadRequestException('Slug invalide');
      if (slug !== existing.slug) {
        const clash = await this.prisma.organization.findUnique({
          where: { slug },
        });
        if (clash) throw new BadRequestException('Ce slug est déjà utilisé');
      }
    }
    const org = await this.prisma.organization.update({
      where: { id },
      data: {
        ...(body.name != null ? { name: body.name.trim() } : {}),
        ...(slug != null ? { slug } : {}),
        ...(body.logo !== undefined ? { logo: body.logo } : {}),
        ...(body.facebookUrl !== undefined
          ? { facebookUrl: body.facebookUrl || null }
          : {}),
        ...(body.instagramUrl !== undefined
          ? { instagramUrl: body.instagramUrl || null }
          : {}),
      },
      include: {
        facilities: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            logo: true,
            socialNetworks: true,
          },
        },
      },
    });
    return this.toPublic(org);
  }

  private newGateKey() {
    let key = '';
    for (let i = 0; i < 10; i++) key += GATE_ALPHABET[randomInt(GATE_ALPHABET.length)];
    return key;
  }

  /** Owners only (not staff): platform admins, or an org admin of this organization */
  private async gateOrgId(
    user: { id?: string; role?: Role } | undefined,
    organizationId?: string,
  ) {
    if (!user?.id) throw new ForbiddenException('Accès refusé');
    if (user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN) {
      const id =
        organizationId ||
        (
          await this.prisma.organization.findFirst({
            orderBy: { createdAt: 'asc' },
            select: { id: true },
          })
        )?.id;
      if (!id) throw new NotFoundException('Organisation introuvable');
      return id;
    }
    const membership = await this.prisma.organizationMembership.findFirst({
      where: {
        userId: user.id,
        ...(organizationId ? { organizationId } : {}),
        role: { in: [Role.ORG_ADMIN, Role.FACILITY_ADMIN, Role.ADMIN] },
      },
      select: { organizationId: true },
    });
    if (!membership) throw new ForbiddenException('Accès refusé');
    return membership.organizationId;
  }

  async adminGate(
    user: { id?: string; role?: Role } | undefined,
    organizationIdParam?: string,
  ) {
    const organizationId = await this.gateOrgId(user, organizationIdParam);
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { adminGateEnabled: true, adminGateKey: true },
    });
    if (!org) throw new NotFoundException('Organisation introuvable');
    if (org.adminGateKey) {
      return { enabled: org.adminGateEnabled, key: org.adminGateKey };
    }
    // First visit: give a code right away so the card can show the link
    const saved = await this.prisma.organization.update({
      where: { id: organizationId },
      data: { adminGateKey: this.newGateKey() },
      select: { adminGateEnabled: true, adminGateKey: true },
    });
    return { enabled: saved.adminGateEnabled, key: saved.adminGateKey! };
  }

  async updateAdminGate(
    user: { id?: string; role?: Role } | undefined,
    organizationIdParam: string | undefined,
    body: { enabled?: boolean; key?: string; regenerate?: boolean },
  ) {
    const organizationId = await this.gateOrgId(user, organizationIdParam);
    let key: string | undefined;
    if (body.regenerate) key = this.newGateKey();
    else if (body.key != null) {
      key = body.key.trim();
      if (!GATE_KEY_RE.test(key)) {
        throw new BadRequestException(
          'Code : 6 à 40 lettres ou chiffres, sans espace',
        );
      }
      if (key.toLowerCase() === 'm') {
        throw new BadRequestException('Code réservé');
      }
    }
    if (key) {
      const clash = await this.prisma.organization.findFirst({
        where: { adminGateKey: key, NOT: { id: organizationId } },
        select: { id: true },
      });
      if (clash) throw new BadRequestException('Ce code est déjà utilisé');
    }
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...(body.enabled !== undefined ? { adminGateEnabled: !!body.enabled } : {}),
        ...(key ? { adminGateKey: key } : {}),
      },
    });
    return this.adminGate(user, organizationId);
  }

  /** Public: is admin hidden, and is this device unlocked (cookie token)? */
  async checkAdminGate(device?: string) {
    const gates = await this.prisma.organization.findMany({
      where: { adminGateKey: { not: null } },
      select: { adminGateKey: true, adminGateEnabled: true },
    });
    return {
      hidden: gates.some((g) => g.adminGateEnabled),
      // Unlocked phones work even while the switch is off
      allowed:
        !!device &&
        gates.some((g) => adminGateDeviceToken(g.adminGateKey!) === device),
    };
  }

  /** Public: the code from /<code>/admin → device token to store in the cookie */
  async verifyAdminGateKey(key?: string) {
    if (!key || !GATE_KEY_RE.test(key)) return { valid: false };
    const org = await this.prisma.organization.findFirst({
      where: { adminGateKey: key },
      select: { id: true },
    });
    return org
      ? { valid: true, device: adminGateDeviceToken(key) }
      : { valid: false };
  }
}
