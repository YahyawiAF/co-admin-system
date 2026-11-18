import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from 'common/guards/accessToken.guard';
import { PrismaService } from 'database/prisma.service';
import { PushService } from './push.service';

type AuthedRequest = { user?: { userId?: string; sub?: string } };

/** Admin/staff browsers subscribe here to get alerts while the admin tab is closed. */
@Controller('admin/push')
@ApiTags('push')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class AdminPushController {
  constructor(
    private readonly push: PushService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('vapid-public-key')
  key() {
    return { publicKey: this.push.isEnabled() ? this.push.getPublicKey() : null };
  }

  @Post('subscribe')
  async subscribe(
    @Req() req: AuthedRequest,
    @Body()
    body: {
      organizationId: string;
      endpoint: string;
      keys: { p256dh: string; auth: string };
      userAgent?: string;
    },
  ) {
    const userId = (req.user?.userId || req.user?.sub) as string;
    await this.assertInOrg(userId, body.organizationId);
    return this.push.saveAdminSubscription({
      userId,
      organizationId: body.organizationId,
      endpoint: body.endpoint,
      p256dh: body.keys?.p256dh,
      auth: body.keys?.auth,
      userAgent: body.userAgent,
    });
  }

  @Post('unsubscribe')
  unsubscribe(@Req() req: AuthedRequest, @Body() body: { endpoint: string }) {
    const userId = (req.user?.userId || req.user?.sub) as string;
    return this.push.removeAdminSubscription(body.endpoint, userId);
  }

  private async assertInOrg(userId: string, organizationId?: string) {
    if (!organizationId) throw new ForbiddenException('organizationId requis');
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (user?.role === Role.SUPER_ADMIN) return;
    const m = await this.prisma.organizationMembership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
    if (!m) throw new ForbiddenException("Vous n'avez pas accès à cette organisation");
  }
}
