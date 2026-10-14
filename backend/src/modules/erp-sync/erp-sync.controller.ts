import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from 'common/guards/accessToken.guard';
import { RolesGuard } from 'common/guards/auth.guard';
import { Roles } from 'common/decorator/roles.decorator';
import { SyncHealthService } from './sync-health.service';

@Controller('erp-sync')
@ApiTags('ERP sync')
@ApiBearerAuth()
@Roles([Role.ADMIN])
@UseGuards(JwtAuthGuard, RolesGuard)
export class ErpSyncController {
  constructor(private readonly health: SyncHealthService) {}

  @Get('health')
  @ApiOperation({ summary: 'Queue counts, unresolved failures and their last error' })
  getHealth() {
    return this.health.getHealth();
  }

  @Post('outbox/retry-failed')
  @ApiOperation({ summary: 'Re-queue every FAILED row with a fresh attempt budget' })
  retryAllFailed() {
    return this.health.retryAllFailed();
  }

  @Post('outbox/resolve-superseded')
  @ApiOperation({ summary: 'Mark FAILED rows SUPERSEDED when the entity has since synced' })
  resolveSuperseded() {
    return this.health.resolveSuperseded();
  }

  @Post('outbox/:id/retry')
  @ApiOperation({ summary: 'Re-queue one outbox row with a fresh attempt budget' })
  retry(@Param('id') id: string) {
    return this.health.retry(id);
  }
}
