import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from 'common/guards/accessToken.guard';
import { Actor, StaffService } from './staff.service';

type AuthedRequest = { user?: { userId?: string; sub?: string; role?: Role } };

function actorOf(req: AuthedRequest): Actor {
  return { userId: (req.user?.userId || req.user?.sub) as string, role: req.user?.role as Role };
}

@Controller('staff')
@ApiTags('staff')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  /** Current user's staff status and permissions (used by the admin UI). */
  @Get('me')
  me(@Req() req: AuthedRequest) {
    return this.staff.me(actorOf(req).userId);
  }

  @Get()
  async list(@Req() req: AuthedRequest, @Query('organizationId') organizationId: string) {
    await this.staff.assertOrgAdmin(actorOf(req), organizationId);
    return this.staff.list(organizationId);
  }

  @Post()
  async create(
    @Req() req: AuthedRequest,
    @Body()
    body: {
      organizationId: string;
      fullname: string;
      identifier: string;
      password: string;
      permissions?: unknown;
    },
  ) {
    await this.staff.assertOrgAdmin(actorOf(req), body.organizationId);
    return this.staff.create(body);
  }

  @Get('actions')
  async actions(
    @Req() req: AuthedRequest,
    @Query('organizationId') organizationId: string,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
    @Query('module') module?: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    await this.staff.assertOrgAdmin(actorOf(req), organizationId);
    return this.staff.listActions({
      organizationId,
      status,
      userId,
      module,
      page: Number(page) || 1,
      perPage: Number(perPage) || 50,
    });
  }

  @Get('actions/summary')
  async summary(@Req() req: AuthedRequest, @Query('organizationId') organizationId: string) {
    await this.staff.assertOrgAdmin(actorOf(req), organizationId);
    return this.staff.summary(organizationId);
  }

  @Post('actions/confirm-all')
  async confirmAll(
    @Req() req: AuthedRequest,
    @Body() body: { organizationId: string; ids?: string[] },
  ) {
    await this.staff.assertOrgAdmin(actorOf(req), body.organizationId);
    return this.staff.confirmMany(body.organizationId, actorOf(req).userId, body.ids);
  }

  @Patch('actions/:id/:decision')
  async review(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('decision') decision: string,
    @Body() body: { note?: string },
  ) {
    const action = await this.staff.getAction(id);
    await this.staff.assertOrgAdmin(actorOf(req), action.organizationId);
    return this.staff.review(
      id,
      decision === 'revert' ? 'revert' : 'confirm',
      actorOf(req).userId,
      body?.note,
    );
  }

  @Patch(':userId')
  async update(
    @Req() req: AuthedRequest,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body()
    body: {
      organizationId: string;
      fullname?: string;
      password?: string;
      isActive?: boolean;
      permissions?: unknown;
    },
  ) {
    await this.staff.assertOrgAdmin(actorOf(req), body.organizationId);
    return this.staff.update(userId, body);
  }

  @Delete(':userId')
  async remove(
    @Req() req: AuthedRequest,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('organizationId') organizationId: string,
  ) {
    await this.staff.assertOrgAdmin(actorOf(req), organizationId);
    return this.staff.remove(userId, organizationId);
  }
}
