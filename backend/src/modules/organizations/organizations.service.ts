import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';

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
}
