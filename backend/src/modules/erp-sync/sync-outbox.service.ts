import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';

export type SyncEntityType =
  | 'member'
  | 'price'
  | 'abonnement'
  | 'journal'
  | 'product'
  | 'dailyProduct';
export type SyncOperation = 'CREATE' | 'UPDATE';

/**
 * Durable queue of entities still needing a push to supply-chain-pro.
 * Called right after the owning service's own Prisma write; never throws —
 * a sync hiccup must never fail the primary co-admin request.
 */
@Injectable()
export class SyncOutboxService {
  private readonly logger = new Logger(SyncOutboxService.name);

  constructor(private readonly prisma: PrismaService) {}

  async enqueue(
    entityType: SyncEntityType,
    entityId: string,
    operation: SyncOperation,
  ): Promise<void> {
    try {
      await this.prisma.syncOutbox.create({
        data: { entityType, entityId, operation },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to enqueue ${entityType}:${entityId} for ERP sync — ${(error as Error).message}`,
      );
    }
  }
}
