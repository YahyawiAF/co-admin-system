import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
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

  /** Public: used by the web app on every admin page (device token from the cookie) */
  @Get('admin-gate/check')
  checkAdminGate(@Query('device') device?: string) {
    return this.organizationsService.checkAdminGate(device);
  }

  /** Public: the code from /<code>/admin */
  @Get('admin-gate/verify')
  verifyAdminGate(@Query('key') key?: string) {
    return this.organizationsService.verifyAdminGateKey(key);
  }

  @Get('admin-gate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  adminGate(
    @Req() req: { user?: { id?: string; role?: Role } },
    @Query('organizationId') organizationId?: string,
  ) {
    return this.organizationsService.adminGate(req.user, organizationId);
  }

  @Patch('admin-gate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateAdminGate(
    @Req() req: { user?: { id?: string; role?: Role } },
    @Query('organizationId') organizationId: string | undefined,
    @Body() body: { enabled?: boolean; key?: string; regenerate?: boolean },
  ) {
    return this.organizationsService.updateAdminGate(
      req.user,
      organizationId,
      body,
    );
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
