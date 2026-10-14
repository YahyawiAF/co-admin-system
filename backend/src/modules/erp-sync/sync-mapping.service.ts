import { Injectable } from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';

/**
 * Co-admin entity id ↔ supply-chain-pro entity id. `entityType` is a free-form string —
 * besides the queueable SyncEntityType values it also tracks per-row mappings that
 * never get their own outbox entry, such as 'abonnementPayment' and 'journalPayment'.
 */
@Injectable()
export class SyncMappingService {
  constructor(private readonly prisma: PrismaService) {}

  get(entityType: string, entityId: string) {
    return this.prisma.syncMapping.findUnique({
      where: { entityType_entityId: { entityType, entityId } },
    });
  }

  set(entityType: string, entityId: string, externalId: string) {
    return this.prisma.syncMapping.upsert({
      where: { entityType_entityId: { entityType, entityId } },
      create: { entityType, entityId, externalId },
      update: { externalId, syncedAt: new Date() },
    });
  }
}
