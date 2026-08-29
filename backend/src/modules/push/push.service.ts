import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as webpush from 'web-push';
import { PrismaService } from 'database/prisma.service';

export type PushPayload = {
  title: string;
  body: string;
  tag?: string;
  url?: string;
};

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private ready = false;

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@collabora.local';
    if (!publicKey || !privateKey) {
      this.logger.warn(
        'VAPID keys missing — Web Push disabled (set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)',
      );
      return;
    }
    webpush.setVapidDetails(subject, publicKey, privateKey);
    this.ready = true;
  }

  getPublicKey(): string | null {
    return process.env.VAPID_PUBLIC_KEY || null;
  }

  async saveSubscription(data: {
    memberId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string;
  }) {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: data.endpoint },
      create: {
        memberId: data.memberId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        userAgent: data.userAgent || null,
      },
      update: {
        memberId: data.memberId,
        p256dh: data.p256dh,
        auth: data.auth,
        userAgent: data.userAgent || null,
      },
    });
  }

  async removeSubscription(endpoint: string, memberId?: string) {
    if (memberId) {
      await this.prisma.pushSubscription.deleteMany({
        where: { endpoint, memberId },
      });
      return;
    }
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
  }

  async sendToMember(memberId: string, payload: PushPayload) {
    if (!this.ready || !memberId) return;
    const rows = await this.prisma.pushSubscription.findMany({
      where: { memberId },
    });
    if (!rows.length) return;

    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      tag: payload.tag || 'collabora',
      url: payload.url || '/m',
    });

    await Promise.all(
      rows.map(async (row) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: row.endpoint,
              keys: { p256dh: row.p256dh, auth: row.auth },
            },
            body,
            { urgency: 'high', TTL: 60 * 60 },
          );
        } catch (err: unknown) {
          const status =
            err && typeof err === 'object' && 'statusCode' in err
              ? (err as { statusCode?: number }).statusCode
              : undefined;
          if (status === 404 || status === 410) {
            await this.prisma.pushSubscription
              .delete({ where: { id: row.id } })
              .catch(() => undefined);
          } else {
            this.logger.warn(
              `Push failed for ${row.id}: ${
                err instanceof Error ? err.message : String(err)
              }`,
            );
          }
        }
      }),
    );
  }
}
