import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  private toPublic(org: {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
    facilities: Array<{ id: string; name: string; logo: string | null }>;
  }) {
    const facility = org.facilities[0] || null;
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      logo: org.logo || facility?.logo || null,
      facility: facility
        ? { id: facility.id, name: facility.name, logo: facility.logo }
        : null,
    };
  }

  async list() {
    const orgs = await this.prisma.organization.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        facilities: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true, logo: true },
        },
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
          select: { id: true, name: true, logo: true },
        },
      },
    });
    if (!org) {
      throw new NotFoundException('Organisation introuvable');
    }
    return this.toPublic(org);
  }
}
