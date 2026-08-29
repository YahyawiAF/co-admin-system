import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { OrganizationsService } from './organizations.service';
import { JwtAuthGuard } from '../../../common/guards/accessToken.guard';

@Controller('organizations')
@ApiTags('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  list() {
    return this.organizationsService.list();
  }

  @Get('crm')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  listCrm(@Req() req: { user?: { role?: Role } }) {
    this.assertSuperAdmin(req.user?.role);
    return this.organizationsService.listCrm();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  create(
    @Req() req: { user?: { role?: Role } },
    @Body()
    body: {
      name: string;
      slug: string;
      logo?: string | null;
      facebookUrl?: string | null;
      instagramUrl?: string | null;
    },
  ) {
    this.assertSuperAdmin(req.user?.role);
    return this.organizationsService.create(body);
  }

  @Patch(':id/activation')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  setActive(
    @Req() req: { user?: { role?: Role } },
    @Param('id') id: string,
    @Body() body: { isActive: boolean; notes?: string | null },
  ) {
    this.assertSuperAdmin(req.user?.role);
    return this.organizationsService.setActive(
      id,
      !!body.isActive,
      body.notes,
    );
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  update(
    @Req() req: { user?: { role?: Role } },
    @Param('id') id: string,
    @Body()
    body: Partial<{
      name: string;
      slug: string;
      logo: string | null;
      facebookUrl: string | null;
      instagramUrl: string | null;
    }>,
  ) {
    const role = req.user?.role;
    if (
      role !== Role.SUPER_ADMIN &&
      role !== Role.ORG_ADMIN &&
      role !== Role.ADMIN
    ) {
      throw new ForbiddenException('Accès refusé');
    }
    return this.organizationsService.update(id, body);
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.organizationsService.findBySlug(slug);
  }

  private assertSuperAdmin(role?: Role) {
    if (role !== Role.SUPER_ADMIN && role !== Role.ADMIN) {
      throw new ForbiddenException('Super admin requis');
    }
  }
}
