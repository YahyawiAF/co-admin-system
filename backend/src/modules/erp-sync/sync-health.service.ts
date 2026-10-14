import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';
import { ErpClientService } from './erp-client.service';

const FAILURE_LIST_LIMIT = 100;

/** Read/repair view over SyncOutbox for admins — no need to query the tables by hand. */
@Injectable()
export class SyncHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly erp: ErpClientService,
  ) {}

  async getHealth() {
    const [grouped, oldestPending, lastSynced, failures, retrying] =
      await Promise.all([
        this.prisma.syncOutbox.groupBy({
          by: ['entityType', 'status'],
          _count: { _all: true },
        }),
        this.prisma.syncOutbox.findFirst({
          where: { status: 'PENDING' },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        }),
        this.prisma.syncOutbox.findFirst({
          where: { status: 'SYNCED' },
          orderBy: { updatedAt: 'desc' },
          select: { updatedAt: true },
        }),
        this.prisma.syncOutbox.findMany({
          where: { status: 'FAILED' },
          orderBy: { updatedAt: 'desc' },
          take: FAILURE_LIST_LIMIT,
        }),
        // Still PENDING but already failed at least once — failing, not yet given up on.
        this.prisma.syncOutbox.findMany({
          where: { status: 'PENDING', attempts: { gt: 0 } },
          orderBy: { updatedAt: 'desc' },
          take: FAILURE_LIST_LIMIT,
        }),
      ]);

    const counts: Record<string, Record<string, number>> = {};
    const totals: Record<string, number> = {};
    for (const g of grouped) {
      counts[g.entityType] ??= {};
      counts[g.entityType][g.status] = g._count._all;
      totals[g.status] = (totals[g.status] ?? 0) + g._count._all;
    }

    return {
      enabled: this.erp.isEnabled(),
      healthy: !totals.FAILED && retrying.length === 0,
      totals,
      counts,
      oldestPendingAt: oldestPending?.createdAt ?? null,
      lastSyncedAt: lastSynced?.updatedAt ?? null,
      failures,
      retrying,
    };
  }

  async retry(id: string) {
    const row = await this.prisma.syncOutbox.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Sync outbox row ${id} not found`);
    return this.prisma.syncOutbox.update({
      where: { id },
      data: { status: 'PENDING', attempts: 0 },
    });
  }

  async retryAllFailed() {
    const { count } = await this.prisma.syncOutbox.updateMany({
      where: { status: 'FAILED' },
      data: { status: 'PENDING', attempts: 0 },
    });
    return { requeued: count };
  }

  /**
   * Marks FAILED rows as SUPERSEDED when a later row for the same entity has since
   * synced. The processor does this going forward; this clears up history from before.
   */
  async resolveSuperseded() {
    const count = await this.prisma.$executeRaw`
      UPDATE sync_outbox f
      SET status = 'SUPERSEDED', "updatedAt" = now()
      WHERE f.status = 'FAILED'
        AND EXISTS (
          SELECT 1 FROM sync_outbox s
          WHERE s."entityType" = f."entityType"
            AND s."entityId" = f."entityId"
            AND s.status = 'SYNCED'
            AND s."createdAt" > f."createdAt"
        )`;
    return { superseded: count };
  }
}
