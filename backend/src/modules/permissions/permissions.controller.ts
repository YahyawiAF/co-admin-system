import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { JwtAuthGuard } from '../../../common/guards/accessToken.guard';
import { RolesGuard } from '../../../common/guards/auth.guard';
import { Roles } from '../../../common/decorator/roles.decorator';
import { Role } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@Controller('permissions')
@ApiTags('permissions')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @Roles([Role.SUPER_ADMIN, Role.ADMIN])
  async getAllPermissions() {
    return this.permissionsService.getAllPermissions();
  }

  @Get('user/:userId')
  @Roles([Role.SUPER_ADMIN, Role.ADMIN])
  async getUserPermissions(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.permissionsService.getUserPermissions(userId);
  }

  @Get('role/:role')
  @Roles([Role.SUPER_ADMIN, Role.ADMIN])
  async getRolePermissions(@Param('role') role: Role) {
    return this.permissionsService.getRolePermissions(role);
  }

  @Post('user/:userId/assign')
  @Roles([Role.SUPER_ADMIN])
  async assignPermissionToUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body('permissionId') permissionId: string,
  ) {
    return this.permissionsService.assignPermissionToUser(userId, permissionId);
  }

  @Delete('user/:userId/remove')
  @Roles([Role.SUPER_ADMIN])
  async removePermissionFromUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body('permissionId') permissionId: string,
  ) {
    return this.permissionsService.removePermissionFromUser(userId, permissionId);
  }

  @Post('initialize')
  @Roles([Role.SUPER_ADMIN])
  async initializePermissions() {
    return this.permissionsService.initializePermissions();
  }
}
